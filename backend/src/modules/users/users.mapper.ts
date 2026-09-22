import type { UserDocument } from './schemas/user.schema.js';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: (user as unknown as { createdAt: Date }).createdAt,
    updatedAt: (user as unknown as { updatedAt: Date }).updatedAt,
  };
}
