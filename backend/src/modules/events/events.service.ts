import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { Event, EventDocument } from './schemas/event.schema.js';
import {
  EventStatusHistory,
  EventStatusHistoryDocument,
} from './schemas/event-status-history.schema.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { QueryEventsDto } from './dto/query-events.dto.js';
import { EventStatus, isValidEventTransition } from './event-status.enum.js';
import { resolveSortField, type PaginatedResult } from '../../common/dto/pagination-query.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { Role } from '../../common/enums/role.enum.js';

const SORTABLE_FIELDS = ['startDate', 'endDate', 'name', 'status', 'createdAt'] as const;

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventStatusHistory.name)
    private readonly historyModel: Model<EventStatusHistoryDocument>,
  ) {}

  async create(dto: CreateEventDto, owner: AuthenticatedUser): Promise<EventDocument> {
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException('endDate must be after startDate');
    }

    return this.eventModel.create({
      name: dto.name,
      description: dto.description ?? '',
      venue: dto.venue,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      owner: new Types.ObjectId(owner.userId),
      status: EventStatus.DRAFT,
    });
  }

  async findAll(query: QueryEventsDto): Promise<PaginatedResult<EventDocument>> {
    const filter: QueryFilter<EventDocument> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.owner) {
      filter.owner = new Types.ObjectId(query.owner);
    }
    if (query.startDateFrom || query.startDateTo) {
      filter.startDate = {};
      if (query.startDateFrom) {
        filter.startDate.$gte = new Date(query.startDateFrom);
      }
      if (query.startDateTo) {
        filter.startDate.$lte = new Date(query.startDateTo);
      }
    }
    if (query.search) {
      filter.$text = { $search: query.search };
    }

    const sortField = resolveSortField(query.sortBy, SORTABLE_FIELDS, 'startDate');
    const sortOrder = query.sortOrder === 'desc' ? -1 : 1;

    const [items, total] = await Promise.all([
      this.eventModel
        .find(filter)
        .skip(query.skip)
        .limit(query.limit)
        .sort({ [sortField]: sortOrder })
        .exec(),
      this.eventModel.countDocuments(filter).exec(),
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

  async findById(id: string): Promise<EventDocument> {
    const event = await this.eventModel.findById(id).exec();
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  async update(id: string, dto: UpdateEventDto, actor: AuthenticatedUser): Promise<EventDocument> {
    const event = await this.findById(id);
    this.assertCanModify(event, actor);

    if (event.status === EventStatus.ARCHIVED) {
      throw new BadRequestException('Archived events cannot be modified');
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : event.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : event.endDate;
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    if (dto.name !== undefined) event.name = dto.name;
    if (dto.description !== undefined) event.description = dto.description;
    if (dto.venue !== undefined) event.venue = dto.venue;
    if (dto.startDate !== undefined) event.startDate = startDate;
    if (dto.endDate !== undefined) event.endDate = endDate;

    await event.save();
    return event;
  }

  async updateStatus(
    id: string,
    targetStatus: EventStatus,
    actor: AuthenticatedUser,
  ): Promise<EventDocument> {
    const event = await this.findById(id);
    this.assertCanModify(event, actor);

    if (!isValidEventTransition(event.status, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition event from '${event.status}' to '${targetStatus}'`,
      );
    }

    if (targetStatus === EventStatus.ARCHIVED) {
      event.isArchived = true;
    }

    return this.recordTransition(event, targetStatus, actor, '');
  }

  async archive(id: string, actor: AuthenticatedUser): Promise<EventDocument> {
    const event = await this.findById(id);
    this.assertCanModify(event, actor);

    if (event.status !== EventStatus.COMPLETED) {
      throw new BadRequestException('Only completed events can be archived');
    }

    event.isArchived = true;
    return this.recordTransition(event, EventStatus.ARCHIVED, actor, '');
  }

  /**
   * Applies a status change and writes a single audit row for it. Used for
   * both ordinary lifecycle transitions here and the approval-specific
   * submit/approve/reject transitions in ApprovalsService, so every status
   * change — not only approvals — ends up in the same auditable history.
   */
  async recordTransition(
    event: EventDocument,
    newStatus: EventStatus,
    actor: AuthenticatedUser,
    comment: string,
  ): Promise<EventDocument> {
    const previousStatus = event.status;
    event.status = newStatus;
    await event.save();

    await this.historyModel.create({
      event: event._id,
      actor: new Types.ObjectId(actor.userId),
      previousStatus,
      newStatus,
      comment,
    });

    return event;
  }

  private assertCanModify(event: EventDocument, actor: AuthenticatedUser): void {
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (actor.role === Role.EVENT_MANAGER && event.owner.toString() === actor.userId) {
      return;
    }
    throw new ForbiddenException('You do not have permission to modify this event');
  }
}
