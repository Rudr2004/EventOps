import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IncidentsService } from './incidents.service.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { UpdateIncidentDto } from './dto/update-incident.dto.js';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto.js';
import { QueryIncidentsDto } from './dto/query-incidents.dto.js';
import { toIncidentResponse } from './incidents.mapper.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@ApiTags('Incidents')
@ApiBearerAuth()
@Controller()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post('events/:eventId/incidents')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const incident = await this.incidentsService.create(eventId, dto, user);
    return toIncidentResponse(incident);
  }

  @Get('incidents')
  async findAll(@Query() query: QueryIncidentsDto) {
    const result = await this.incidentsService.findAll(query);
    return {
      items: result.items.map(toIncidentResponse),
      meta: result.meta,
    };
  }

  @Get('incidents/:id')
  async findOne(@Param('id') id: string) {
    const incident = await this.incidentsService.findById(id);
    return toIncidentResponse(incident);
  }

  @Patch('incidents/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const incident = await this.incidentsService.update(id, dto, user);
    return toIncidentResponse(incident);
  }

  @Patch('incidents/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const incident = await this.incidentsService.updateStatus(id, dto.status, user);
    return toIncidentResponse(incident);
  }

  @Get('incidents/:id/timeline')
  async getTimeline(@Param('id') id: string) {
    const incident = await this.incidentsService.getTimeline(id);
    return toIncidentResponse(incident).activity;
  }
}
