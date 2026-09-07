import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserRoleDto } from './dto/update-user-role.dto.js';
import { UpdateUserStatusDto } from './dto/update-user-status.dto.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';
import { toUserResponse } from './users.mapper.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async findAll(@Query() query: QueryUsersDto) {
    const result = await this.usersService.findAll(query);
    return {
      items: result.items.map(toUserResponse),
      meta: result.meta,
    };
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return toUserResponse(user);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    const user = await this.usersService.updateRole(id, dto.role);
    return toUserResponse(user);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    const user = await this.usersService.updateStatus(id, dto.isActive);
    return toUserResponse(user);
  }
}
