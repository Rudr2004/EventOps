import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { toUserResponse, type UserResponse } from '../users/users.mapper.js';
import type { UserDocument } from '../users/schemas/user.schema.js';
import type { AppConfig } from '../../config/configuration.js';

const REFRESH_TOKEN_SALT_ROUNDS = 10;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: UserResponse;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.create(dto);
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmailWithSecrets(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user);
  }

  async refresh(userId: string, refreshToken: string): Promise<TokenPair> {
    const user = await this.usersService.findByIdWithRefreshToken(userId);

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.generateTokenPair(user);
    await this.persistRefreshToken(user._id.toString(), newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  private async issueTokens(user: UserDocument): Promise<AuthResult> {
    const tokens = await this.generateTokenPair(user);
    await this.persistRefreshToken(user._id.toString(), tokens.refreshToken);

    return {
      ...tokens,
      user: toUserResponse(user),
    };
  }

  private async generateTokenPair(user: UserDocument): Promise<TokenPair> {
    const jwtConfig = this.configService.get<AppConfig['jwt']>('app.jwt');
    const payload = { sub: user._id.toString(), email: user.email, role: user.role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: jwtConfig?.accessSecret,
        expiresIn: jwtConfig?.accessExpiresIn as JwtSignOptions['expiresIn'],
      }),
      this.jwtService.signAsync(payload, {
        secret: jwtConfig?.refreshSecret,
        expiresIn: jwtConfig?.refreshExpiresIn as JwtSignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async persistRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(refreshToken, REFRESH_TOKEN_SALT_ROUNDS);
    await this.usersService.setRefreshTokenHash(userId, refreshTokenHash);
  }

  verifyRefreshToken(token: string): { sub: string; email: string; role: string } {
    const jwtConfig = this.configService.get<AppConfig['jwt']>('app.jwt');
    try {
      return this.jwtService.verify(token, { secret: jwtConfig?.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
