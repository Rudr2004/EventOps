import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AnalyticsService } from './analytics.service.js';
import { EventStatus } from '../events/event-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const MANAGER_ID = new Types.ObjectId().toString();
const OTHER_MANAGER_ID = new Types.ObjectId().toString();
const OWNED_EVENT_ID = new Types.ObjectId();
const OTHER_EVENT_ID = new Types.ObjectId();

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: MANAGER_ID, email: 'manager@example.com', role: Role.EVENT_MANAGER, ...overrides };
}

function buildModels() {
  const eventModel = {
    find: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        exec: () => Promise.resolve([{ _id: OWNED_EVENT_ID }]),
      }),
    }),
    aggregate: vi.fn().mockResolvedValue([]),
    countDocuments: vi.fn().mockResolvedValue(0),
  };
  const historyModel = {
    find: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ exec: () => Promise.resolve([]) }) }),
  };
  const taskModel = { aggregate: vi.fn().mockResolvedValue([]) };
  const incidentModel = { aggregate: vi.fn().mockResolvedValue([]) };
  const sessionModel = { aggregate: vi.fn().mockResolvedValue([]) };

  return { eventModel, historyModel, taskModel, incidentModel, sessionModel };
}

describe('AnalyticsService', () => {
  describe('event-scoping (RBAC)', () => {
    it('confines an Event Manager to their own events when no event is requested', async () => {
      const models = buildModels();
      const service = new AnalyticsService(
        models.eventModel as any,
        models.historyModel as any,
        models.taskModel as any,
        models.incidentModel as any,
        models.sessionModel as any,
      );

      await service.getOverview(buildActor());

      expect(models.eventModel.find).toHaveBeenCalledWith({ owner: new Types.ObjectId(MANAGER_ID) });
    });

    it('rejects an Event Manager requesting analytics for an event they do not own', async () => {
      const models = buildModels();
      const service = new AnalyticsService(
        models.eventModel as any,
        models.historyModel as any,
        models.taskModel as any,
        models.incidentModel as any,
        models.sessionModel as any,
      );

      await expect(
        service.getOverview(buildActor(), OTHER_EVENT_ID.toString()),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows an Event Manager to request analytics for an event they do own', async () => {
      const models = buildModels();
      const service = new AnalyticsService(
        models.eventModel as any,
        models.historyModel as any,
        models.taskModel as any,
        models.incidentModel as any,
        models.sessionModel as any,
      );

      await expect(
        service.getOverview(buildActor(), OWNED_EVENT_ID.toString()),
      ).resolves.toBeDefined();
    });

    it('does not restrict an Admin to any owned-event set', async () => {
      const models = buildModels();
      const service = new AnalyticsService(
        models.eventModel as any,
        models.historyModel as any,
        models.taskModel as any,
        models.incidentModel as any,
        models.sessionModel as any,
      );

      await service.getOverview(buildActor({ userId: OTHER_MANAGER_ID, role: Role.ADMIN }));

      expect(models.eventModel.find).not.toHaveBeenCalled();
    });
  });

  describe('event health score', () => {
    function buildHealthModels(overdueTasks: number, incidents: { count: number; criticalCount: number }) {
      const eventModel = {
        find: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            exec: () =>
              Promise.resolve([
                { _id: OWNED_EVENT_ID, name: 'Test Event', status: EventStatus.LIVE },
              ]),
          }),
        }),
      };
      const taskModel = {
        aggregate: vi.fn().mockResolvedValue(
          overdueTasks > 0 ? [{ _id: OWNED_EVENT_ID, count: overdueTasks }] : [],
        ),
      };
      const incidentModel = {
        aggregate: vi.fn().mockResolvedValue(
          incidents.count > 0
            ? [{ _id: OWNED_EVENT_ID, count: incidents.count, criticalCount: incidents.criticalCount }]
            : [],
        ),
      };
      return { eventModel, taskModel, incidentModel };
    }

    it('scores a healthy event at 100', async () => {
      const { eventModel, taskModel, incidentModel } = buildHealthModels(0, { count: 0, criticalCount: 0 });
      const service = new AnalyticsService(
        eventModel as any,
        {} as any,
        taskModel as any,
        incidentModel as any,
        {} as any,
      );

      const [result] = await service.getEventHealth(buildActor({ role: Role.ADMIN }));

      expect(result.healthScore).toBe(100);
    });

    it('penalizes overdue tasks more lightly than incidents', async () => {
      const { eventModel, taskModel, incidentModel } = buildHealthModels(2, { count: 0, criticalCount: 0 });
      const service = new AnalyticsService(
        eventModel as any,
        {} as any,
        taskModel as any,
        incidentModel as any,
        {} as any,
      );

      const [result] = await service.getEventHealth(buildActor({ role: Role.ADMIN }));

      expect(result.healthScore).toBe(90);
    });

    it('penalizes a critical incident far more heavily than overdue tasks', async () => {
      const { eventModel, taskModel, incidentModel } = buildHealthModels(0, { count: 1, criticalCount: 1 });
      const service = new AnalyticsService(
        eventModel as any,
        {} as any,
        taskModel as any,
        incidentModel as any,
        {} as any,
      );

      const [result] = await service.getEventHealth(buildActor({ role: Role.ADMIN }));

      expect(result.healthScore).toBe(80);
      expect(result.criticalIncidentCount).toBe(1);
    });

    it('never scores below zero even with many compounding issues', async () => {
      const { eventModel, taskModel, incidentModel } = buildHealthModels(50, { count: 10, criticalCount: 10 });
      const service = new AnalyticsService(
        eventModel as any,
        {} as any,
        taskModel as any,
        incidentModel as any,
        {} as any,
      );

      const [result] = await service.getEventHealth(buildActor({ role: Role.ADMIN }));

      expect(result.healthScore).toBe(0);
    });
  });
});
