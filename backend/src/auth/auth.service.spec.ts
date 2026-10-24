import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { AuthService } from './auth.service.js';
import { SignupDto } from './dto/create-auth.dto.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

describe('AuthService', () => {
  let service: AuthService;
  const users = {
    existsBy: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: {} },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normalizes email and stores only a password hash at signup', async () => {
    users.existsBy.mockResolvedValue(false);
    users.create.mockImplementation((user) => user);
    users.save.mockImplementation(async (user) => ({ ...user, id: 'user-id' }));
    const dto: SignupDto = {
      email: '  Alice@Example.com ',
      password: 'safe-password',
    };

    const result = await service.signup(dto);
    const savedUser = users.save.mock.calls[0][0];

    expect(users.existsBy).toHaveBeenCalledWith({ email: 'alice@example.com' });
    expect(result).toEqual({
      id: 'user-id',
      email: 'alice@example.com',
      role: 'USER',
    });
    expect(savedUser.passwordHash).not.toBe(dto.password);
    await expect(compare(dto.password, savedUser.passwordHash)).resolves.toBe(
      true,
    );
  });

  it('rejects duplicate email addresses', async () => {
    users.existsBy.mockResolvedValue(true);

    await expect(
      service.signup({ email: 'alice@example.com', password: 'safe-password' }),
    ).rejects.toThrow('Email already in use');
    expect(users.save).not.toHaveBeenCalled();
  });
});
