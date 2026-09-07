import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { UpdateEventStatusDto } from './dto/update-event-status.dto.js';
import { QueryEventsDto } from './dto/query-events.dto.js';
import { toEventResponse } from './events.mapper.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@ApiTags('Events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser) {
    const event = await this.eventsService.create(dto, user);
    return toEventResponse(event);
  }

  @Get()
  async findAll(@Query() query: QueryEventsDto) {
    const result = await this.eventsService.findAll(query);
    return {
      items: result.items.map(toEventResponse),
      meta: result.meta,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.eventsService.findById(id);
    return toEventResponse(event);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.eventsService.update(id, dto, user);
    return toEventResponse(event);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateEventStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const event = await this.eventsService.updateStatus(id, dto.status, user);
    return toEventResponse(event);
  }

  @Patch(':id/archive')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const event = await this.eventsService.archive(id, user);
    return toEventResponse(event);
  }
}
