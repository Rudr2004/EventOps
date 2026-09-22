import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ApprovalsService } from './approvals.service.js';
import { EventStatus } from '../events/event-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const OWNER_ID = new Types.ObjectId().toString();
const OTHER_MANAGER_ID = new Types.ObjectId().toString();
const ADMIN_ID = new Types.ObjectId().toString();

function buildEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    name: 'Tech Summit',
    owner: new Types.ObjectId(OWNER_ID),
    status: EventStatus.PLANNING,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: OWNER_ID, email: 'owner@example.com', role: Role.EVENT_MANAGER, ...overrides };
}

function buildDeps(event: ReturnType<typeof buildEvent>) {
  const historyModel = {
    create: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
    }),
  };
  const eventsService = {
    findById: vi.fn().mockResolvedValue(event),
    recordTransition: vi.fn(async (evt, newStatus, actor, comment) => {
      const previousStatus = evt.status;
      evt.status = newStatus;
      await historyModel.create({
        event: evt._id,
        actor: new Types.ObjectId(actor.userId),
        previousStatus,
        newStatus,
        comment,
      });
      return evt;
    }),
  };
  return { historyModel, eventsService };
}

describe('ApprovalsService', () => {
  describe('submit', () => {
    it('allows the owning Event Manager to submit a Planning event', async () => {
      const event = buildEvent({ status: EventStatus.PLANNING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      const result = await service.submit('event-id', buildActor());

      expect(result.status).toBe(EventStatus.APPROVAL_PENDING);
    });

    it('rejects a non-owning Event Manager submitting the event', async () => {
      const event = buildEvent({ status: EventStatus.PLANNING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(
        service.submit('event-id', buildActor({ userId: OTHER_MANAGER_ID })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an Admin submitting on behalf of the owner', async () => {
      const event = buildEvent({ status: EventStatus.PLANNING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(
        service.submit('event-id', buildActor({ userId: ADMIN_ID, role: Role.ADMIN })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects submitting an event that is not in Planning', async () => {
      const event = buildEvent({ status: EventStatus.DRAFT });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(service.submit('event-id', buildActor())).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('allows an Admin to approve a pending event', async () => {
      const event = buildEvent({ status: EventStatus.APPROVAL_PENDING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      const result = await service.approve(
        'event-id',
        'Looks good',
        buildActor({ userId: ADMIN_ID, role: Role.ADMIN }),
      );

      expect(result.status).toBe(EventStatus.APPROVED);
    });

    it('rejects a non-Admin approving an event', async () => {
      const event = buildEvent({ status: EventStatus.APPROVAL_PENDING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(service.approve('event-id', undefined, buildActor())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects approving an event that is not Approval Pending', async () => {
      const event = buildEvent({ status: EventStatus.PLANNING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(
        service.approve('event-id', undefined, buildActor({ userId: ADMIN_ID, role: Role.ADMIN })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('allows an Admin to reject a pending event back to Planning', async () => {
      const event = buildEvent({ status: EventStatus.APPROVAL_PENDING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      const result = await service.reject(
        'event-id',
        'Budget missing',
        buildActor({ userId: ADMIN_ID, role: Role.ADMIN }),
      );

      expect(result.status).toBe(EventStatus.PLANNING);
      expect(historyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ comment: 'Budget missing' }),
      );
    });

    it('rejects a non-Admin rejecting an event', async () => {
      const event = buildEvent({ status: EventStatus.APPROVAL_PENDING });
      const { historyModel, eventsService } = buildDeps(event);
      const service = new ApprovalsService(historyModel as any, eventsService as any);

      await expect(
        service.reject('event-id', 'Not allowed', buildActor()),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
