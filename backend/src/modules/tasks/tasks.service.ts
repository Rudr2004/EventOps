import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { Task, TaskDocument } from './schemas/task.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { QueryTasksDto } from './dto/query-tasks.dto.js';
import { isValidTaskTransition, TaskPriority, TaskStatus } from './task-enums.js';
import { EventsService } from '../events/events.service.js';
import { EventStatus } from '../events/event-status.enum.js';
import { UsersService } from '../users/users.service.js';
import { Role } from '../../common/enums/role.enum.js';
import { resolveSortField, type PaginatedResult } from '../../common/dto/pagination-query.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const SORTABLE_FIELDS = ['dueDate', 'priority', 'status', 'createdAt'] as const;

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  async create(eventId: string, dto: CreateTaskDto, actor: AuthenticatedUser): Promise<TaskDocument> {
    const event = await this.eventsService.findById(eventId);

    if (event.status === EventStatus.COMPLETED || event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException(
        `Cannot create tasks on an event that is ${event.status}`,
      );
    }

    if (dto.assignee) {
      await this.assertAssigneeIsOperationsMember(dto.assignee);
    }

    const task = await this.taskModel.create({
      event: new Types.ObjectId(eventId),
      session: dto.session ? new Types.ObjectId(dto.session) : null,
      title: dto.title,
      description: dto.description ?? '',
      assignee: dto.assignee ? new Types.ObjectId(dto.assignee) : null,
      priority: dto.priority ?? TaskPriority.P3,
      status: TaskStatus.TODO,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      comments: [],
      activity: [
        {
          actor: new Types.ObjectId(actor.userId),
          action: 'created',
          detail: '',
        },
      ],
    });

    return task;
  }

  async findAll(query: QueryTasksDto): Promise<PaginatedResult<TaskDocument>> {
    const rawFilter: Record<string, unknown> = {};

    if (query.event) rawFilter.event = new Types.ObjectId(query.event);
    if (query.assignee) rawFilter.assignee = new Types.ObjectId(query.assignee);
    if (query.status) rawFilter.status = query.status;
    if (query.priority) rawFilter.priority = query.priority;

    const dueDateFilter: Record<string, Date> = {};
    if (query.dueDateFrom) dueDateFilter.$gte = new Date(query.dueDateFrom);
    if (query.dueDateTo) dueDateFilter.$lte = new Date(query.dueDateTo);
    if (Object.keys(dueDateFilter).length > 0) {
      rawFilter.dueDate = dueDateFilter;
    }

    if (query.overdue === 'true') {
      rawFilter.dueDate = { ...dueDateFilter, $lt: new Date() };
      rawFilter.status = rawFilter.status ?? { $ne: TaskStatus.DONE };
    } else if (query.overdue === 'false') {
      rawFilter.$or = [{ dueDate: null }, { dueDate: { $gte: new Date() } }, { status: TaskStatus.DONE }];
    }

    const filter = rawFilter as QueryFilter<TaskDocument>;

    const sortField = resolveSortField(query.sortBy, SORTABLE_FIELDS, 'dueDate');
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      this.taskModel
        .find(filter)
        .skip(query.skip)
        .limit(query.limit)
        .sort({ [sortField]: sortOrder, createdAt: -1 })
        .exec(),
      this.taskModel.countDocuments(filter).exec(),
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

  async findById(id: string): Promise<TaskDocument> {
    const task = await this.taskModel.findById(id).exec();
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actor: AuthenticatedUser): Promise<TaskDocument> {
    const task = await this.findById(id);
    this.assertCanManage(actor);

    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.session !== undefined) {
      task.session = dto.session ? new Types.ObjectId(dto.session) : null;
    }
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.assignee !== undefined) {
      if (dto.assignee) {
        await this.assertAssigneeIsOperationsMember(dto.assignee);
      }
      const previousAssignee = task.assignee?.toString() ?? 'unassigned';
      task.assignee = dto.assignee ? new Types.ObjectId(dto.assignee) : null;
      task.activity.push({
        actor: new Types.ObjectId(actor.userId),
        action: 'reassigned',
        detail: `from ${previousAssignee} to ${dto.assignee ?? 'unassigned'}`,
      } as never);
    }

    await task.save();
    return task;
  }

  async updateStatus(id: string, status: TaskStatus, actor: AuthenticatedUser): Promise<TaskDocument> {
    const task = await this.findById(id);
    this.assertCanUpdateStatus(task, actor);

    if (!isValidTaskTransition(task.status, status)) {
      throw new BadRequestException(`Cannot transition task from '${task.status}' to '${status}'`);
    }

    const previousStatus = task.status;
    task.status = status;
    task.activity.push({
      actor: new Types.ObjectId(actor.userId),
      action: 'status_changed',
      detail: `${previousStatus} -> ${status}`,
    } as never);

    await task.save();
    return task;
  }

  async addComment(id: string, text: string, actor: AuthenticatedUser): Promise<TaskDocument> {
    const task = await this.findById(id);
    this.assertCanComment(task, actor);

    task.comments.push({
      author: new Types.ObjectId(actor.userId),
      text,
    } as never);
    task.activity.push({
      actor: new Types.ObjectId(actor.userId),
      action: 'commented',
      detail: '',
    } as never);

    await task.save();
    return task;
  }

  private assertCanManage(actor: AuthenticatedUser): void {
    if (actor.role !== Role.ADMIN && actor.role !== Role.EVENT_MANAGER) {
      throw new ForbiddenException('You do not have permission to manage this task');
    }
  }

  private assertCanUpdateStatus(task: TaskDocument, actor: AuthenticatedUser): void {
    if (actor.role === Role.ADMIN || actor.role === Role.EVENT_MANAGER) {
      return;
    }
    if (actor.role === Role.OPERATIONS_MEMBER && task.assignee?.toString() === actor.userId) {
      return;
    }
    throw new ForbiddenException('You do not have permission to update this task');
  }

  private assertCanComment(task: TaskDocument, actor: AuthenticatedUser): void {
    this.assertCanUpdateStatus(task, actor);
  }

  private async assertAssigneeIsOperationsMember(assigneeId: string): Promise<void> {
    const assignee = await this.usersService.findById(assigneeId);
    if (assignee.role !== Role.OPERATIONS_MEMBER) {
      throw new BadRequestException('Tasks can only be assigned to an Operations Member');
    }
  }
}
