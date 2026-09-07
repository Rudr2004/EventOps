import type { Role } from '../enums/role.enum.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
}
