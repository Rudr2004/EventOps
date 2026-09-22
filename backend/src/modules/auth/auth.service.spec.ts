import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { Role } from '../../common/enums/role.enum.js';

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: { toString: () => 'user-1' },
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: Role.VIEWER,
    isActive: true,
    passwordHash: '',
    refreshTokenHash: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersService: {
    findByEmailWithSecrets: ReturnType<typeof vi.fn>;
    findByIdWithRefreshToken: ReturnType<typeof vi.fn>;
    setRefreshTokenHash: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let jwtService: JwtService;
  let configService: ConfigService;
  let authService: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmailWithSecrets: vi.fn(),
      findByIdWithRefreshToken: vi.fn(),
      setRefreshTokenHash: vi.fn(),
      create: vi.fn(),
    };
    jwtService = new JwtService({});
    configService = {
      get: () => ({
        accessSecret: 'access-secret',
        accessExpiresIn: '15m',
        refreshSecret: 'refresh-secret',
        refreshExpiresIn: '7d',
      }),
    } as unknown as ConfigService;

    authService = new AuthService(usersService as unknown as UsersService, jwtService, configService);
  });

  describe('login', () => {
    it('throws Unauthorized for an unknown email', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(null);

      await expect(authService.login('missing@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the account is deactivated', async () => {
      usersService.findByEmailWithSecrets.mockResolvedValue(buildUser({ isActive: false }));

      await expect(authService.login('jane@example.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws Unauthorized when the password does not match', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      usersService.findByEmailWithSecrets.mockResolvedValue(buildUser({ passwordHash }));

      await expect(authService.login('jane@example.com', 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns tokens and persists a refresh token hash on success', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 4);
      usersService.findByEmailWithSecrets.mockResolvedValue(buildUser({ passwordHash }));

      const result = await authService.login('jane@example.com', 'correct-password');

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('jane@example.com');
      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', expect.any(String));
    });
  });

  describe('refresh', () => {
    it('throws Unauthorized when no refresh token is stored', async () => {
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser({ refreshTokenHash: null }));

      await expect(authService.refresh('user-1', 'some-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws Unauthorized when the provided token does not match the stored hash', async () => {
      const refreshTokenHash = await bcrypt.hash('stored-token', 4);
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser({ refreshTokenHash }));

      await expect(authService.refresh('user-1', 'different-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a new token pair when the refresh token matches', async () => {
      const refreshTokenHash = await bcrypt.hash('stored-token', 4);
      usersService.findByIdWithRefreshToken.mockResolvedValue(buildUser({ refreshTokenHash }));

      const result = await authService.refresh('user-1', 'stored-token');

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(usersService.setRefreshTokenHash).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('clears the stored refresh token hash', async () => {
      await authService.logout('user-1');

      expect(usersService.setRefreshTokenHash).toHaveBeenCalledWith('user-1', null);
    });
  });
});
