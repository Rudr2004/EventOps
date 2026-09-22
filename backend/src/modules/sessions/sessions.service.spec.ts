import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionsService } from './sessions.service.js';
import { SessionStatus } from './session-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const EVENT_ID = new Types.ObjectId().toString();
const SPEAKER_ID = new Types.ObjectId().toString();
const MANAGER_ID = new Types.ObjectId().toString();

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: MANAGER_ID, email: 'manager@example.com', role: Role.EVENT_MANAGER, ...overrides };
}

function buildCalendarRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    eventId: new Types.ObjectId(EVENT_ID),
    eventName: 'Tech Summit',
    title: 'Opening Keynote',
    room: 'Main Hall',
    startTime: new Date('2026-10-01T09:00:00.000Z'),
    endTime: new Date('2026-10-01T10:00:00.000Z'),
    status: SessionStatus.SCHEDULED,
    speakers: [new Types.ObjectId(SPEAKER_ID)],
    ...overrides,
  };
}

function buildSession(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    event: new Types.ObjectId(EVENT_ID),
    title: 'Existing Session',
    description: '',
    room: 'Main Hall',
    startTime: new Date('2026-10-01T09:00:00.000Z'),
    endTime: new Date('2026-10-01T10:00:00.000Z'),
    speakers: [new Types.ObjectId(SPEAKER_ID)],
    status: SessionStatus.SCHEDULED,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildDeps(existingConflict: unknown = null) {
  const sessionModel = {
    create: vi.fn().mockImplementation((doc) => Promise.resolve(buildSession(doc))),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ exec: () => Promise.resolve([]) }),
    }),
    findById: vi.fn(),
    findOne: vi.fn().mockReturnValue({ exec: () => Promise.resolve(existingConflict) }),
  };
  const eventsService = { findById: vi.fn().mockResolvedValue({ id: EVENT_ID }) };
  const speakersService = { findById: vi.fn().mockResolvedValue({ id: SPEAKER_ID }) };

  return { sessionModel, eventsService, speakersService };
}

describe('SessionsService', () => {
  describe('create - validation', () => {
    it('rejects an end time that is not after the start time', async () => {
      const { sessionModel, eventsService, speakersService } = buildDeps();
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Bad Session',
          room: 'Main Hall',
          startTime: '2026-10-01T10:00:00.000Z',
          endTime: '2026-10-01T09:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a start time in the past', async () => {
      const { sessionModel, eventsService, speakersService } = buildDeps();
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Backdated Session',
          room: 'Main Hall',
          startTime: '2020-01-01T09:00:00.000Z',
          endTime: '2020-01-01T10:00:00.000Z',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(sessionModel.create).not.toHaveBeenCalled();
    });

    it('allows a start time in the future', async () => {
      const { sessionModel, eventsService, speakersService } = buildDeps(null);
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Future Session',
          room: 'Main Hall',
          startTime: '2099-01-01T09:00:00.000Z',
          endTime: '2099-01-01T10:00:00.000Z',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('create - room overlap', () => {
    it('rejects a session that overlaps another session in the same room', async () => {
      const conflicting = buildSession();
      const { sessionModel, eventsService, speakersService } = buildDeps(conflicting);
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Overlapping Session',
          room: 'Main Hall',
          startTime: '2026-10-01T09:30:00.000Z',
          endTime: '2026-10-01T10:30:00.000Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a session that overlaps another session in the same room booked under a different event', async () => {
      const conflictingFromOtherEvent = buildSession({ event: new Types.ObjectId() });
      const { sessionModel, eventsService, speakersService } = buildDeps(conflictingFromOtherEvent);
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Cross-Event Room Clash',
          room: 'Main Hall',
          startTime: '2026-10-01T09:30:00.000Z',
          endTime: '2026-10-01T10:30:00.000Z',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('does not scope the room-conflict query by event', async () => {
      const { sessionModel, eventsService, speakersService } = buildDeps(null);
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await service.create(EVENT_ID, {
        title: 'Any Session',
        room: 'Main Hall',
        startTime: '2026-10-01T09:00:00.000Z',
        endTime: '2026-10-01T10:00:00.000Z',
      });

      const roomConflictCall = sessionModel.findOne.mock.calls[0][0];
      expect(roomConflictCall).not.toHaveProperty('event');
      expect(roomConflictCall.room).toBe('Main Hall');
    });

    it('allows a back-to-back session in the same room with no time overlap', async () => {
      const { sessionModel, eventsService, speakersService } = buildDeps(null);
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Back to back',
          room: 'Main Hall',
          startTime: '2026-10-01T10:00:00.000Z',
          endTime: '2026-10-01T11:00:00.000Z',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('create - speaker double-booking', () => {
    it('rejects a session when a speaker is already booked in an overlapping window elsewhere', async () => {
      const conflicting = buildSession({ room: 'Room B' });
      const sessionModel = {
        create: vi.fn(),
        findOne: vi
          .fn()
          // first call checks room conflict -> none
          .mockReturnValueOnce({ exec: () => Promise.resolve(null) })
          // second call checks speaker conflict -> found
          .mockReturnValueOnce({ exec: () => Promise.resolve(conflicting) }),
      };
      const eventsService = { findById: vi.fn().mockResolvedValue({ id: EVENT_ID }) };
      const speakersService = { findById: vi.fn().mockResolvedValue({ id: SPEAKER_ID }) };
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Speaker Conflict',
          room: 'Room A',
          startTime: '2026-10-01T09:30:00.000Z',
          endTime: '2026-10-01T10:30:00.000Z',
          speakers: [SPEAKER_ID],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('create - speaker validation', () => {
    it('propagates a not-found error when an assigned speaker does not exist', async () => {
      const { sessionModel, eventsService } = buildDeps(null);
      const speakersService = { findById: vi.fn().mockRejectedValue(new Error('Speaker not found')) };
      const service = new SessionsService(sessionModel as any, eventsService as any, speakersService as any);

      await expect(
        service.create(EVENT_ID, {
          title: 'Missing Speaker',
          room: 'Main Hall',
          startTime: '2026-10-01T09:00:00.000Z',
          endTime: '2026-10-01T10:00:00.000Z',
          speakers: [new Types.ObjectId().toString()],
        }),
      ).rejects.toThrow('Speaker not found');
    });
  });

  describe('getCalendar', () => {
    it('groups sessions by calendar day and then by room, sorted chronologically', async () => {
      const earlySession = buildCalendarRow({
        room: 'Room B',
        startTime: new Date('2026-10-01T08:00:00.000Z'),
        endTime: new Date('2026-10-01T09:00:00.000Z'),
      });
      const lateSession = buildCalendarRow({
        room: 'Main Hall',
        startTime: new Date('2026-10-01T09:00:00.000Z'),
        endTime: new Date('2026-10-01T10:00:00.000Z'),
      });
      const nextDaySession = buildCalendarRow({
        room: 'Main Hall',
        startTime: new Date('2026-10-02T09:00:00.000Z'),
        endTime: new Date('2026-10-02T10:00:00.000Z'),
      });

      const sessionModel = {
        aggregate: vi.fn().mockResolvedValue([earlySession, lateSession, nextDaySession]),
      };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const speakersService = {};
      const service = new SessionsService(
        sessionModel as any,
        eventsService as any,
        speakersService as any,
      );

      const result = await service.getCalendar({}, buildActor({ role: Role.ADMIN }));

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-10-01');
      expect(result[0].rooms.map((r) => r.room)).toEqual(['Main Hall', 'Room B']);
      expect(result[0].rooms.find((r) => r.room === 'Main Hall')?.sessions).toHaveLength(1);
      expect(result[1].date).toBe('2026-10-02');
    });

    it('does not scope the query for an Admin', async () => {
      const sessionModel = { aggregate: vi.fn().mockResolvedValue([]) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new SessionsService(sessionModel as any, eventsService as any, {} as any);

      await service.getCalendar({}, buildActor({ role: Role.ADMIN }));

      expect(eventsService.findOwnedEventIds).not.toHaveBeenCalled();
      const pipeline = sessionModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match).toEqual({});
    });

    it('scopes the query to owned events for an Event Manager', async () => {
      const ownedIds = [new Types.ObjectId(EVENT_ID)];
      const sessionModel = { aggregate: vi.fn().mockResolvedValue([]) };
      const eventsService = { findOwnedEventIds: vi.fn().mockResolvedValue(ownedIds) };
      const service = new SessionsService(sessionModel as any, eventsService as any, {} as any);

      await service.getCalendar({}, buildActor({ role: Role.EVENT_MANAGER, userId: MANAGER_ID }));

      expect(eventsService.findOwnedEventIds).toHaveBeenCalledWith(MANAGER_ID);
      const pipeline = sessionModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match).toEqual({ event: { $in: ownedIds } });
    });

    it('applies from/to/room filters to the match stage', async () => {
      const sessionModel = { aggregate: vi.fn().mockResolvedValue([]) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new SessionsService(sessionModel as any, eventsService as any, {} as any);

      await service.getCalendar(
        { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z', room: 'Main Hall' },
        buildActor({ role: Role.ADMIN }),
      );

      const pipeline = sessionModel.aggregate.mock.calls[0][0];
      expect(pipeline[0].$match).toEqual({
        room: 'Main Hall',
        startTime: {
          $gte: new Date('2026-10-01T00:00:00.000Z'),
          $lte: new Date('2026-10-08T00:00:00.000Z'),
        },
      });
    });

    it('returns an empty array when there are no matching sessions', async () => {
      const sessionModel = { aggregate: vi.fn().mockResolvedValue([]) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new SessionsService(sessionModel as any, eventsService as any, {} as any);

      const result = await service.getCalendar({}, buildActor({ role: Role.ADMIN }));

      expect(result).toEqual([]);
    });
  });
});
