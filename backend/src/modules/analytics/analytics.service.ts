import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from '../events/schemas/event.schema.js';
import { EventStatusHistory, EventStatusHistoryDocument } from '../events/schemas/event-status-history.schema.js';
import { Task, TaskDocument } from '../tasks/schemas/task.schema.js';
import { Incident, IncidentDocument } from '../incidents/schemas/incident.schema.js';
import { Session, SessionDocument } from '../sessions/schemas/session.schema.js';
import { EventStatus } from '../events/event-status.enum.js';
import { TaskStatus } from '../tasks/task-enums.js';
import { IncidentStatus } from '../incidents/incident-enums.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

export interface OverviewResponse {
  eventsByStatus: Record<string, number>;
  upcomingEvents: { next7Days: number; next30Days: number };
  tasks: { open: number; overdue: number };
}

export interface WorkloadEntry {
  assignee: string;
  total: number;
  done: number;
  completionRate: number;
  byStatus: Record<string, number>;
}

export interface IncidentAnalyticsResponse {
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
  averageResolutionHours: number | null;
}

export interface ApprovalTurnaroundResponse {
  averageHours: number | null;
  sampleSize: number;
}

export interface RoomUtilizationEntry {
  room: string;
  sessionCount: number;
  totalMinutes: number;
}

export interface EventHealthEntry {
  eventId: string;
  eventName: string;
  status: string;
  overdueTaskCount: number;
  unresolvedIncidentCount: number;
  criticalIncidentCount: number;
  healthScore: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    @InjectModel(EventStatusHistory.name)
    private readonly historyModel: Model<EventStatusHistoryDocument>,
    @InjectModel(Task.name) private readonly taskModel: Model<TaskDocument>,
    @InjectModel(Incident.name) private readonly incidentModel: Model<IncidentDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
  ) {}

  /**
   * Resolves which event ids the actor is allowed to see analytics for.
   * Admin sees everything (or one event if explicitly requested); an Event
   * Manager is always confined to events they own, regardless of what's
   * requested, so a manager can never pull another manager's numbers by
   * guessing an event id.
   */
  private async resolveScopedEventIds(
    actor: AuthenticatedUser,
    requestedEventId?: string,
  ): Promise<Types.ObjectId[] | null> {
    if (actor.role === Role.EVENT_MANAGER) {
      const ownedEvents = await this.eventModel
        .find({ owner: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      const ownedIds = ownedEvents.map((e) => e._id);

      if (requestedEventId) {
        const matches = ownedIds.some((id) => id.toString() === requestedEventId);
        if (!matches) {
          throw new BadRequestException('You do not have access to analytics for this event');
        }
        return [new Types.ObjectId(requestedEventId)];
      }

      return ownedIds;
    }

    if (requestedEventId) {
      return [new Types.ObjectId(requestedEventId)];
    }

    return null;
  }

  async getOverview(actor: AuthenticatedUser, requestedEventId?: string): Promise<OverviewResponse> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const eventMatch = eventIds ? { _id: { $in: eventIds } } : {};
    const taskEventMatch = eventIds ? { event: { $in: eventIds } } : {};

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [statusCounts, upcoming7, upcoming30, taskCounts] = await Promise.all([
      this.eventModel.aggregate([
        { $match: eventMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.eventModel.countDocuments({
        ...eventMatch,
        startDate: { $gte: now, $lte: in7Days },
      }),
      this.eventModel.countDocuments({
        ...eventMatch,
        startDate: { $gte: now, $lte: in30Days },
      }),
      this.taskModel.aggregate([
        { $match: taskEventMatch },
        {
          $facet: {
            open: [{ $match: { status: { $ne: TaskStatus.DONE } } }, { $count: 'count' }],
            overdue: [
              {
                $match: {
                  status: { $ne: TaskStatus.DONE },
                  dueDate: { $ne: null, $lt: now },
                },
              },
              { $count: 'count' },
            ],
          },
        },
      ]),
    ]);

    const eventsByStatus: Record<string, number> = {};
    for (const status of Object.values(EventStatus)) {
      eventsByStatus[status] = 0;
    }
    for (const row of statusCounts) {
      eventsByStatus[row._id] = row.count;
    }

    return {
      eventsByStatus,
      upcomingEvents: { next7Days: upcoming7, next30Days: upcoming30 },
      tasks: {
        open: taskCounts[0]?.open[0]?.count ?? 0,
        overdue: taskCounts[0]?.overdue[0]?.count ?? 0,
      },
    };
  }

  async getWorkload(actor: AuthenticatedUser, requestedEventId?: string): Promise<WorkloadEntry[]> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const match: Record<string, unknown> = { assignee: { $ne: null } };
    if (eventIds) {
      match.event = { $in: eventIds };
    }

    const rows = await this.taskModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { assignee: '$assignee', status: '$status' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.assignee',
          total: { $sum: '$count' },
          byStatus: { $push: { status: '$_id.status', count: '$count' } },
        },
      },
      { $sort: { total: -1 } },
    ]);

    return rows.map((row) => {
      const byStatus: Record<string, number> = {};
      for (const entry of row.byStatus as { status: string; count: number }[]) {
        byStatus[entry.status] = entry.count;
      }
      const done = byStatus[TaskStatus.DONE] ?? 0;
      return {
        assignee: row._id.toString(),
        total: row.total,
        done,
        completionRate: row.total > 0 ? Math.round((done / row.total) * 1000) / 10 : 0,
        byStatus,
      };
    });
  }

  async getIncidentAnalytics(
    actor: AuthenticatedUser,
    requestedEventId?: string,
  ): Promise<IncidentAnalyticsResponse> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const match: Record<string, unknown> = eventIds ? { event: { $in: eventIds } } : {};

    const [severityRows, statusRows, resolutionRows] = await Promise.all([
      this.incidentModel.aggregate([
        { $match: match },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      this.incidentModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      this.incidentModel.aggregate([
        { $match: { ...match, status: IncidentStatus.RESOLVED, resolvedAt: { $ne: null } } },
        {
          $project: {
            resolutionHours: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
            },
          },
        },
        { $group: { _id: null, avgHours: { $avg: '$resolutionHours' } } },
      ]),
    ]);

    const bySeverity: Record<string, number> = {};
    for (const row of severityRows) bySeverity[row._id] = row.count;

    const byStatus: Record<string, number> = {};
    for (const row of statusRows) byStatus[row._id] = row.count;

    return {
      bySeverity,
      byStatus,
      averageResolutionHours: resolutionRows[0]
        ? Math.round(resolutionRows[0].avgHours * 10) / 10
        : null,
    };
  }

  async getApprovalTurnaround(
    actor: AuthenticatedUser,
    requestedEventId?: string,
  ): Promise<ApprovalTurnaroundResponse> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const match: Record<string, unknown> = {
      previousStatus: EventStatus.APPROVAL_PENDING,
      newStatus: { $in: [EventStatus.APPROVED, EventStatus.PLANNING] },
    };
    if (eventIds) {
      match.event = { $in: eventIds };
    }

    const submittedMatch: Record<string, unknown> = { newStatus: EventStatus.APPROVAL_PENDING };
    if (eventIds) {
      submittedMatch.event = { $in: eventIds };
    }

    const [submissions, decisions] = await Promise.all([
      this.historyModel.find(submittedMatch).select('event createdAt').exec(),
      this.historyModel.find(match).select('event createdAt').exec(),
    ]);

    const earliestSubmissionByEvent = new Map<string, Date>();
    for (const row of submissions) {
      const key = row.event.toString();
      const createdAt = (row as unknown as { createdAt: Date }).createdAt;
      const existing = earliestSubmissionByEvent.get(key);
      if (!existing || createdAt < existing) {
        earliestSubmissionByEvent.set(key, createdAt);
      }
    }

    const turnaroundHours: number[] = [];
    for (const decision of decisions) {
      const key = decision.event.toString();
      const submittedAt = earliestSubmissionByEvent.get(key);
      const decidedAt = (decision as unknown as { createdAt: Date }).createdAt;
      if (submittedAt && decidedAt >= submittedAt) {
        turnaroundHours.push((decidedAt.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
      }
    }

    if (turnaroundHours.length === 0) {
      return { averageHours: null, sampleSize: 0 };
    }

    const average = turnaroundHours.reduce((sum, h) => sum + h, 0) / turnaroundHours.length;
    return { averageHours: Math.round(average * 10) / 10, sampleSize: turnaroundHours.length };
  }

  async getRoomUtilization(
    actor: AuthenticatedUser,
    requestedEventId?: string,
  ): Promise<RoomUtilizationEntry[]> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const match: Record<string, unknown> = eventIds ? { event: { $in: eventIds } } : {};

    const rows = await this.sessionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$room',
          sessionCount: { $sum: 1 },
          totalMinutes: {
            $sum: { $divide: [{ $subtract: ['$endTime', '$startTime'] }, 1000 * 60] },
          },
        },
      },
      { $sort: { totalMinutes: -1 } },
    ]);

    return rows.map((row) => ({
      room: row._id,
      sessionCount: row.sessionCount,
      totalMinutes: Math.round(row.totalMinutes),
    }));
  }

  async getEventHealth(actor: AuthenticatedUser, requestedEventId?: string): Promise<EventHealthEntry[]> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const eventMatch = eventIds ? { _id: { $in: eventIds } } : {};

    const events = await this.eventModel.find(eventMatch).select('name status').exec();
    if (events.length === 0) {
      return [];
    }

    const now = new Date();
    const idsForFacets = events.map((e) => e._id);

    const [overdueTaskRows, incidentRows] = await Promise.all([
      this.taskModel.aggregate([
        {
          $match: {
            event: { $in: idsForFacets },
            status: { $ne: TaskStatus.DONE },
            dueDate: { $ne: null, $lt: now },
          },
        },
        { $group: { _id: '$event', count: { $sum: 1 } } },
      ]),
      this.incidentModel.aggregate([
        { $match: { event: { $in: idsForFacets }, status: { $ne: IncidentStatus.RESOLVED } } },
        {
          $group: {
            _id: '$event',
            count: { $sum: 1 },
            criticalCount: {
              $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const overdueByEvent = new Map<string, number>(
      overdueTaskRows.map((r) => [r._id.toString(), r.count]),
    );
    const incidentsByEvent = new Map<string, { count: number; criticalCount: number }>(
      incidentRows.map((r) => [r._id.toString(), { count: r.count, criticalCount: r.criticalCount }]),
    );

    return events.map((event) => {
      const id = event._id.toString();
      const overdueTaskCount = overdueByEvent.get(id) ?? 0;
      const incidentInfo = incidentsByEvent.get(id) ?? { count: 0, criticalCount: 0 };

      const healthScore = this.computeHealthScore({
        overdueTaskCount,
        unresolvedIncidentCount: incidentInfo.count,
        criticalIncidentCount: incidentInfo.criticalCount,
        eventStatus: event.status,
      });

      return {
        eventId: id,
        eventName: event.name,
        status: event.status,
        overdueTaskCount,
        unresolvedIncidentCount: incidentInfo.count,
        criticalIncidentCount: incidentInfo.criticalCount,
        healthScore,
      };
    });
  }

  /**
   * 100 = perfectly healthy. Deducts for overdue tasks and unresolved
   * incidents (critical incidents weighted far heavier than a plain
   * overdue task), and for an event stuck in Approval Pending, which is an
   * operational risk of its own (an unresolved blocker to going Live).
   * Floored at 0 — this is a relative signal, not a real percentage.
   */
  private computeHealthScore(input: {
    overdueTaskCount: number;
    unresolvedIncidentCount: number;
    criticalIncidentCount: number;
    eventStatus: string;
  }): number {
    let score = 100;
    score -= input.overdueTaskCount * 5;
    score -= (input.unresolvedIncidentCount - input.criticalIncidentCount) * 8;
    score -= input.criticalIncidentCount * 20;
    if (input.eventStatus === EventStatus.APPROVAL_PENDING) {
      score -= 10;
    }
    return Math.max(0, Math.round(score));
  }
}
