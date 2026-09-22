import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventsService } from '../events/events.service.js';
import { EventStatus } from '../events/event-status.enum.js';
import type { EventDocument } from '../events/schemas/event.schema.js';
import {
  EventStatusHistory,
  EventStatusHistoryDocument,
} from '../events/schemas/event-status-history.schema.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

@Injectable()
export class ApprovalsService {
  constructor(
    @InjectModel(EventStatusHistory.name)
    private readonly historyModel: Model<EventStatusHistoryDocument>,
    private readonly eventsService: EventsService,
  ) {}

  async submit(eventId: string, actor: AuthenticatedUser): Promise<EventDocument> {
    const event = await this.eventsService.findById(eventId);

    if (actor.role !== Role.EVENT_MANAGER || event.owner.toString() !== actor.userId) {
      throw new ForbiddenException(
        'Only the owning Event Manager can submit this event for approval',
      );
    }

    if (event.status !== EventStatus.PLANNING) {
      throw new BadRequestException(
        `Cannot submit an event for approval from status '${event.status}'`,
      );
    }

    return this.eventsService.recordTransition(event, EventStatus.APPROVAL_PENDING, actor, '');
  }

  async approve(
    eventId: string,
    comment: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<EventDocument> {
    const event = await this.eventsService.findById(eventId);
    this.assertIsAdmin(actor);

    if (event.status !== EventStatus.APPROVAL_PENDING) {
      throw new BadRequestException(`Cannot approve an event from status '${event.status}'`);
    }

    return this.eventsService.recordTransition(event, EventStatus.APPROVED, actor, comment ?? '');
  }

  async reject(eventId: string, reason: string, actor: AuthenticatedUser): Promise<EventDocument> {
    const event = await this.eventsService.findById(eventId);
    this.assertIsAdmin(actor);

    if (event.status !== EventStatus.APPROVAL_PENDING) {
      throw new BadRequestException(`Cannot reject an event from status '${event.status}'`);
    }

    return this.eventsService.recordTransition(event, EventStatus.PLANNING, actor, reason);
  }

  async getHistory(eventId: string): Promise<EventStatusHistoryDocument[]> {
    await this.eventsService.findById(eventId);
    return this.historyModel.find({ event: eventId }).sort({ createdAt: 1 }).exec();
  }

  private assertIsAdmin(actor: AuthenticatedUser): void {
    if (actor.role !== Role.ADMIN) {
      throw new ForbiddenException('Only an Admin can approve or reject an event');
    }
  }
}
