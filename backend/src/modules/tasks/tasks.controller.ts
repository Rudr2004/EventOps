import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import { AddCommentDto } from './dto/add-comment.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { toTaskResponse } from './tasks.mapper.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post('events/:eventId/tasks')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const task = await this.tasksService.create(eventId, dto, user);
    return toTaskResponse(task);
  }

  @Get('tasks')
  async findAll(@Query() query: QueryTasksDto) {
    const result = await this.tasksService.findAll(query);
    return {
      items: result.items.map(toTaskResponse),
      meta: result.meta,
    };
  }

  @Get('tasks/:id')
  async findOne(@Param('id') id: string) {
    const task = await this.tasksService.findById(id);
    return toTaskResponse(task);
  }

  @Patch('tasks/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const task = await this.tasksService.update(id, dto, user);
    return toTaskResponse(task);
  }

  @Patch('tasks/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const task = await this.tasksService.updateStatus(id, dto.status, user);
    return toTaskResponse(task);
  }

  @Post('tasks/:id/comments')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.EVENT_MANAGER, Role.OPERATIONS_MEMBER)
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const task = await this.tasksService.addComment(id, dto.text, user);
    return toTaskResponse(task);
  }
}
