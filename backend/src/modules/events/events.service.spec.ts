import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

function buildEventModelForFindAll(items: unknown[]) {
  const query = {
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(items),
  };
  return {
    find: vi.fn().mockReturnValue(query),
    countDocuments: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(items.length) }),
  };
}

function buildPaginationQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return { page: 1, limit: 20, skip: 0, ...overrides } as any;
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

  describe('findAll (row-level scoping)', () => {
    it('does not restrict the filter for an Admin', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.ADMIN }));

      expect(eventModel.find).toHaveBeenCalledWith({});
    });

    it('does not restrict the filter for an Operations Member', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.OPERATIONS_MEMBER }));

      expect(eventModel.find).toHaveBeenCalledWith({});
    });

    it('does not restrict the filter for a Viewer', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.VIEWER }));

      expect(eventModel.find).toHaveBeenCalledWith({});
    });

    it('forces the owner filter to the actor for an Event Manager', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);
      const actor = buildActor({ role: Role.EVENT_MANAGER, userId: OWNER_ID });

      await service.findAll(buildPaginationQuery(), actor);

      expect(eventModel.find).toHaveBeenCalledWith({ owner: new Types.ObjectId(OWNER_ID) });
    });

    it('overrides a mismatched explicit owner query param for an Event Manager', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);
      const actor = buildActor({ role: Role.EVENT_MANAGER, userId: OWNER_ID });

      await service.findAll(buildPaginationQuery({ owner: OTHER_MANAGER_ID }), actor);

      expect(eventModel.find).toHaveBeenCalledWith({ owner: new Types.ObjectId(OWNER_ID) });
    });

    it('honors an explicit owner query param for an Admin', async () => {
      const eventModel = buildEventModelForFindAll([buildEvent()]);
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await service.findAll(
        buildPaginationQuery({ owner: OTHER_MANAGER_ID }),
        buildActor({ role: Role.ADMIN }),
      );

      expect(eventModel.find).toHaveBeenCalledWith({ owner: new Types.ObjectId(OTHER_MANAGER_ID) });
    });
  });

  describe('findByIdScoped', () => {
    it('allows an Admin to fetch any event', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.findByIdScoped(
        'event-id',
        buildActor({ role: Role.ADMIN, userId: OTHER_MANAGER_ID }),
      );

      expect(result).toBe(event);
    });

    it('allows the owning Event Manager to fetch their event', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.findByIdScoped('event-id', buildActor({ role: Role.EVENT_MANAGER }));

      expect(result).toBe(event);
    });

    it('hides an event from an Event Manager who does not own it (404, not 403)', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      await expect(
        service.findByIdScoped(
          'event-id',
          buildActor({ role: Role.EVENT_MANAGER, userId: OTHER_MANAGER_ID }),
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an Operations Member to fetch any event', async () => {
      const event = buildEvent();
      const eventModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(event) }) };
      const service = new EventsService(eventModel as any, buildHistoryModel() as any);

      const result = await service.findByIdScoped(
        'event-id',
        buildActor({ role: Role.OPERATIONS_MEMBER, userId: OTHER_MANAGER_ID }),
      );

      expect(result).toBe(event);
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
