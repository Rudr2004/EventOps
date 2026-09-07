import { BadRequestException, ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionsService } from './sessions.service.js';
import { SessionStatus } from './session-status.enum.js';

const EVENT_ID = new Types.ObjectId().toString();
const SPEAKER_ID = new Types.ObjectId().toString();

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
  });

  describe('create - room overlap', () => {
    it('rejects a session that overlaps another session in the same room and event', async () => {
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
});
