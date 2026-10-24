import type { Role } from '../entities/user.entity.js';

export interface AuthUser {
  id: string;
  role: Role;
}
