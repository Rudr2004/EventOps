import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { Role } from '../../common/enums/role.enum.js';
import { resolveSortField, type PaginatedResult } from '../../common/dto/pagination-query.dto.js';
import type { QueryUsersDto } from './dto/query-users.dto.js';

const SALT_ROUNDS = 12;
const SORTABLE_FIELDS = ['name', 'email', 'role', 'createdAt'] as const;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    return this.userModel.create({
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash,
      role: Role.VIEWER,
      isActive: true,
    });
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedResult<UserDocument>> {
    const filter = query.role ? { role: query.role } : {};

    const sortField = resolveSortField(query.sortBy, SORTABLE_FIELDS, 'createdAt');
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .skip(query.skip)
        .limit(query.limit)
        .sort({ [sortField]: sortOrder })
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    return {
      items,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmailWithSecrets(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+passwordHash +refreshTokenHash')
      .exec();
  }

  async findByIdWithRefreshToken(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('+refreshTokenHash').exec();
  }

  async updateRole(id: string, role: Role): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateStatus(id: string, isActive: boolean): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(id, { isActive }, { new: true }).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async setRefreshTokenHash(id: string, refreshTokenHash: string | null): Promise<void> {
    await this.userModel.findByIdAndUpdate(id, { refreshTokenHash }).exec();
  }
}
