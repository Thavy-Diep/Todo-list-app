import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { Response } from 'express';
import {
  IsNull,
  MoreThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { SignupDto } from './dto/create-auth.dto.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Role, User } from './entities/user.entity.js';
import { AuthUser } from './types/auth-user.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

interface JwtPayload {
  sub: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.users.existsBy({ email })) {
      throw new ConflictException('Email already in use');
    }

    const user = this.users.create({
      email,
      passwordHash: await hash(dto.password, 12),
      role: Role.USER,
    });

    try {
      const savedUser = await this.users.save(user);
      return this.publicUser(savedUser);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('Email already in use');
      }
      throw error;
    }
  }

  async validate(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.users.findOne({
      where: { email: normalizedEmail },
      select: { id: true, email: true, role: true, passwordHash: true },
    });

    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(email: string, password: string, response: Response) {
    const user = await this.validate(email, password);
    return this.issueTokens(user, response);
  }

  async refresh(token: string | undefined, response: Response) {
    if (!token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      throw error;
    }

    const stored = await this.refreshTokens.findOne({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
        userId: payload.sub,
      },
      relations: { user: true },
    });

    if (!stored || stored.user.role !== payload.role) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    stored.revokedAt = new Date();
    await this.refreshTokens.save(stored);
    return this.issueTokens(stored.user, response);
  }

  async logout(user: AuthUser, response: Response): Promise<void> {
    await this.refreshTokens.update(
      { userId: user.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    this.clearRefreshCookie(response);
  }

  async issueTokens(user: User, response: Response) {
    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });

    await this.refreshTokens.save(
      this.refreshTokens.create({
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
        revokedAt: null,
        userId: user.id,
        user,
      }),
    );

    response.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    return { accessToken, user: this.publicUser(user) };
  }

  getCurrentUser(user: AuthUser) {
    return this.users.findOneOrFail({
      where: { id: user.id },
      select: { id: true, email: true, role: true },
    });
  }

  private publicUser(user: User) {
    return { id: user.id, email: user.email, role: user.role };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/auth',
      maxAge: REFRESH_LIFETIME_MS,
    };
  }

  private clearRefreshCookie(response: Response) {
    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/auth',
    });
  }
}
