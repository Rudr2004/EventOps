import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { EventsService } from './events.service.js';
import { EventStatus } from './event-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const OWNER_ID = new Types.ObjectId().toString();
const OTHER_MANAGER_ID = new Types.ObjectId().toString();

function buildEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    name: 'Tech Summit',
    description: '',
    venue: 'Hall A',
    startDate: new Date('2026-10-01T09:00:00.000Z'),
    endDate: new Date('2026-10-02T09:00:00.000Z'),
    owner: new Types.ObjectId(OWNER_ID),
    status: EventStatus.DRAFT,
    isArchived: false,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: OWNER_ID, email: 'owner@example.com', role: Role.EVENT_MANAGER, ...overrides };
}

function buildHistoryModel() {
  return { create: vi.fn().mockResolvedValue(undefined) };
}

describe('EventsService', () => {
  describe('create', () => {
    it('rejects an end date that is not after the start date', async () => {
      const eventModel = { create: vi.fn() };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(
        service.create(
          {
            name: 'Tech Summit',
            venue: 'Hall A',
            startDate: '2026-10-02T09:00:00.000Z',
            endDate: '2026-10-01T09:00:00.000Z',
          },
          buildActor(),
        ),
      ).rejects.toThrow(BadRequestException);

      expect(eventModel.create).not.toHaveBeenCalled();
    });

    it('creates the event in Draft status owned by the creator', async () => {
      const eventModel = { create: vi.fn().mockResolvedValue(buildEvent()) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await service.create(
        {
          name: 'Tech Summit',
          venue: 'Hall A',
          startDate: '2026-10-01T09:00:00.000Z',
          endDate: '2026-10-02T09:00:00.000Z',
        },
        buildActor(),
      );

      expect(eventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: EventStatus.DRAFT }),
      );
    });
  });

  describe('update (authorization)', () => {
    it('allows the owning Event Manager to update their event', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.update('event-id', { name: 'Updated Name' }, buildActor());

      expect(result.name).toBe('Updated Name');
      expect(event.save).toHaveBeenCalled();
    });

    it('denies an Event Manager who does not own the event', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(
        service.update('event-id', { name: 'Hijacked' }, buildActor({ userId: OTHER_MANAGER_ID })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an Admin to update any event regardless of ownership', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.update(
        'event-id',
        { name: 'Admin Edit' },
        buildActor({ userId: OTHER_MANAGER_ID, role: Role.ADMIN }),
      );

      expect(result.name).toBe('Admin Edit');
    });

    it('rejects updates to an archived event', async () => {
      const event = buildEvent({ status: EventStatus.ARCHIVED });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(service.update('event-id', { name: 'x' }, buildActor())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateStatus', () => {
    it('rejects an invalid lifecycle transition', async () => {
      const event = buildEvent({ status: EventStatus.DRAFT });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(
        service.updateStatus('event-id', EventStatus.LIVE, buildActor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('applies a valid transition', async () => {
      const event = buildEvent({ status: EventStatus.DRAFT });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.updateStatus('event-id', EventStatus.PLANNING, buildActor());

      expect(result.status).toBe(EventStatus.PLANNING);
    });

    it('writes an audit history row recording the transition', async () => {
      const event = buildEvent({ status: EventStatus.DRAFT });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const historyModel = buildHistoryModel();
      const service = new EventsService(eventModel as any, historyModel as any);
      const actor = buildActor();

      await service.updateStatus('event-id', EventStatus.PLANNING, actor);

      expect(historyModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previousStatus: EventStatus.DRAFT,
          newStatus: EventStatus.PLANNING,
          comment: '',
        }),
      );
    });
  });

  describe('archive', () => {
    it('rejects archiving an event that is not Completed', async () => {
      const event = buildEvent({ status: EventStatus.LIVE });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(service.archive('event-id', buildActor())).rejects.toThrow(BadRequestException);
    });

    it('archives a Completed event', async () => {
      const event = buildEvent({ status: EventStatus.COMPLETED });
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.archive('event-id', buildActor());

      expect(result.status).toBe(EventStatus.ARCHIVED);
      expect(result.isArchived).toBe(true);
    });
  });
});
