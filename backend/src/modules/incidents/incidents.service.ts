import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type QueryFilter } from 'mongoose';
import { Incident, IncidentDocument } from './schemas/incident.schema.js';
import { CreateIncidentDto } from './dto/create-incident.dto.js';
import { UpdateIncidentDto } from './dto/update-incident.dto.js';
import { QueryIncidentsDto } from './dto/query-incidents.dto.js';
import { isValidIncidentTransition, IncidentStatus } from './incident-enums.js';
import { EventsService } from '../events/events.service.js';
import { UsersService } from '../users/users.service.js';
import { Role } from '../../common/enums/role.enum.js';
import { resolveSortField, type PaginatedResult } from '../../common/dto/pagination-query.dto.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const SORTABLE_FIELDS = ['severity', 'status', 'createdAt', 'resolvedAt'] as const;

@Injectable()
export class IncidentsService {
  constructor(
    @InjectModel(Incident.name) private readonly incidentModel: Model<IncidentDocument>,
    private readonly eventsService: EventsService,
    private readonly usersService: UsersService,
  ) {}

  async create(eventId: string, dto: CreateIncidentDto, actor: AuthenticatedUser): Promise<IncidentDocument> {
    await this.eventsService.findById(eventId);

    if (dto.assignee) {
      await this.assertAssigneeIsOperationsMember(dto.assignee);
    }

    return this.incidentModel.create({
      event: new Types.ObjectId(eventId),
      session: dto.session ? new Types.ObjectId(dto.session) : null,
      title: dto.title,
      description: dto.description ?? '',
      severity: dto.severity,
      status: IncidentStatus.OPEN,
      assignee: dto.assignee ? new Types.ObjectId(dto.assignee) : null,
      resolvedAt: null,
      activity: [
        {
          actor: new Types.ObjectId(actor.userId),
          action: 'created',
          detail: '',
        },
      ],
    });
  }

  async findAll(query: QueryIncidentsDto): Promise<PaginatedResult<IncidentDocument>> {
    const filter: Record<string, unknown> = {};

    if (query.event) filter.event = new Types.ObjectId(query.event);
    if (query.assignee) filter.assignee = new Types.ObjectId(query.assignee);
    if (query.severity) filter.severity = query.severity;
    if (query.status) filter.status = query.status;

    const sortField = resolveSortField(query.sortBy, SORTABLE_FIELDS, 'createdAt');
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [items, total] = await Promise.all([
      this.incidentModel
        .find(filter as QueryFilter<IncidentDocument>)
        .skip(query.skip)
        .limit(query.limit)
        .sort({ [sortField]: sortOrder })
        .exec(),
      this.incidentModel.countDocuments(filter as QueryFilter<IncidentDocument>).exec(),
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

  async findById(id: string): Promise<IncidentDocument> {
    const incident = await this.incidentModel.findById(id).exec();
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  async getTimeline(id: string): Promise<IncidentDocument> {
    return this.findById(id);
  }

  async update(id: string, dto: UpdateIncidentDto, actor: AuthenticatedUser): Promise<IncidentDocument> {
    const incident = await this.findById(id);
    this.assertCanUpdate(incident, actor);

    if (dto.title !== undefined) incident.title = dto.title;
    if (dto.description !== undefined) incident.description = dto.description;
    if (dto.severity !== undefined) incident.severity = dto.severity;
    if (dto.session !== undefined) {
      incident.session = dto.session ? new Types.ObjectId(dto.session) : null;
    }
    if (dto.assignee !== undefined) {
      if (dto.assignee) {
        await this.assertAssigneeIsOperationsMember(dto.assignee);
      }
      const previousAssignee = incident.assignee?.toString() ?? 'unassigned';
      incident.assignee = dto.assignee ? new Types.ObjectId(dto.assignee) : null;
      incident.activity.push({
        actor: new Types.ObjectId(actor.userId),
        action: 'reassigned',
        detail: `from ${previousAssignee} to ${dto.assignee ?? 'unassigned'}`,
      } as never);
    }

    await incident.save();
    return incident;
  }

  async updateStatus(id: string, status: IncidentStatus, actor: AuthenticatedUser): Promise<IncidentDocument> {
    const incident = await this.findById(id);
    this.assertCanUpdate(incident, actor);

    if (!isValidIncidentTransition(incident.status, status)) {
      throw new BadRequestException(
        `Cannot transition incident from '${incident.status}' to '${status}'`,
      );
    }

    const previousStatus = incident.status;
    incident.status = status;
    incident.resolvedAt = status === IncidentStatus.RESOLVED ? new Date() : null;
    incident.activity.push({
      actor: new Types.ObjectId(actor.userId),
      action: 'status_changed',
      detail: `${previousStatus} -> ${status}`,
    } as never);

    await incident.save();
    return incident;
  }

  private assertCanUpdate(incident: IncidentDocument, actor: AuthenticatedUser): void {
    if (actor.role === Role.ADMIN || actor.role === Role.EVENT_MANAGER) {
      return;
    }
    if (actor.role === Role.OPERATIONS_MEMBER && incident.assignee?.toString() === actor.userId) {
      return;
    }
    throw new ForbiddenException('You do not have permission to update this incident');
  }

  private async assertAssigneeIsOperationsMember(assigneeId: string): Promise<void> {
    const assignee = await this.usersService.findById(assigneeId);
    if (assignee.role !== Role.OPERATIONS_MEMBER) {
      throw new BadRequestException('Incidents can only be assigned to an Operations Member');
    }
  }
}
