import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto.js';
import { toSessionResponse } from './sessions.mapper.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Role } from '../../common/enums/role.enum.js';

@ApiTags('Sessions')
@ApiBearerAuth()
@Controller()
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('events/:eventId/sessions')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async create(@Param('eventId') eventId: string, @Body() dto: CreateSessionDto) {
    const session = await this.sessionsService.create(eventId, dto);
    return toSessionResponse(session);
  }

  @Get('events/:eventId/sessions')
  async findByEvent(@Param('eventId') eventId: string) {
    const sessions = await this.sessionsService.findByEvent(eventId);
    return sessions.map(toSessionResponse);
  }

  @Get('sessions/:id')
  async findOne(@Param('id') id: string) {
    const session = await this.sessionsService.findById(id);
    return toSessionResponse(session);
  }

  @Patch('sessions/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async update(@Param('id') id: string, @Body() dto: UpdateSessionDto) {
    const session = await this.sessionsService.update(id, dto);
    return toSessionResponse(session);
  }

  @Patch('sessions/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateSessionStatusDto) {
    const session = await this.sessionsService.updateStatus(id, dto.status);
    return toSessionResponse(session);
  }
}
