import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Event, EventDocument } from '../events/schemas/event.schema.js';
import { EventStatusHistory, EventStatusHistoryDocument } from '../events/schemas/event-status-history.schema.js';
import { Task, TaskDocument } from '../tasks/schemas/task.schema.js';
import { Incident, IncidentDocument } from '../incidents/schemas/incident.schema.js';
import { Session, SessionDocument } from '../sessions/schemas/session.schema.js';
import { SessionStatus } from '../sessions/session-status.enum.js';
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

export interface SchedulingConflictSession {
  sessionId: string;
  eventId: string;
  eventName: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

export interface SchedulingConflictEntry {
  room: string;
  sessions: [SchedulingConflictSession, SchedulingConflictSession];
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

  /**
   * Turnaround = time from a submission (-> ApprovalPending) to the *next*
   * decision (-> Approved or back to Planning) after it, per event. Pairing
   * by "next after" rather than "earliest submission" matters because a
   * rejected event can be resubmitted, so a single event can contribute
   * more than one submit -> decide pair to the sample.
   */
  async getApprovalTurnaround(
    actor: AuthenticatedUser,
    requestedEventId?: string,
  ): Promise<ApprovalTurnaroundResponse> {
    const eventIds = await this.resolveScopedEventIds(actor, requestedEventId);
    const baseMatch: Record<string, unknown> = {
      $or: [
        { newStatus: EventStatus.APPROVAL_PENDING },
        {
          previousStatus: EventStatus.APPROVAL_PENDING,
          newStatus: { $in: [EventStatus.APPROVED, EventStatus.PLANNING] },
        },
      ],
    };
    if (eventIds) {
      baseMatch.event = { $in: eventIds };
    }

    const [result] = await this.historyModel.aggregate<{
      averageHours: number | null;
      sampleSize: number;
    }>([
      { $match: baseMatch },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$event',
          entries: {
            $push: {
              isSubmission: { $eq: ['$newStatus', EventStatus.APPROVAL_PENDING] },
              createdAt: '$createdAt',
            },
          },
        },
      },
      {
        $project: {
          pairs: {
            $reduce: {
              input: '$entries',
              initialValue: { pendingSubmission: null, hours: [] },
              in: {
                $cond: [
                  '$$this.isSubmission',
                  {
                    pendingSubmission: '$$this.createdAt',
                    hours: '$$value.hours',
                  },
                  {
                    $cond: [
                      { $ne: ['$$value.pendingSubmission', null] },
                      {
                        pendingSubmission: null,
                        hours: {
                          $concatArrays: [
                            '$$value.hours',
                            [
                              {
                                $divide: [
                                  { $subtract: ['$$this.createdAt', '$$value.pendingSubmission'] },
                                  1000 * 60 * 60,
                                ],
                              },
                            ],
                          ],
                        },
                      },
                      { pendingSubmission: null, hours: '$$value.hours' },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      { $unwind: '$pairs.hours' },
      {
        $group: {
          _id: null,
          averageHours: { $avg: '$pairs.hours' },
          sampleSize: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          averageHours: { $round: [{ $multiply: ['$averageHours', 10] }, 0] },
          sampleSize: 1,
        },
      },
      {
        $project: {
          averageHours: { $divide: ['$averageHours', 10] },
          sampleSize: 1,
        },
      },
    ]);

    if (!result) {
      return { averageHours: null, sampleSize: 0 };
    }

    return { averageHours: result.averageHours, sampleSize: result.sampleSize };
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

  /**
   * Rooms double-booked across overlapping time windows. Room conflicts are
   * prevented at write time (SessionsService.assertNoConflicts) regardless
   * of event ownership, so a genuine conflict here means either legacy data
   * or a session cancelled after booking; this surfaces it for visibility.
   * Scoping: an Event Manager only sees conflicts that involve at least one
   * of their own sessions, so they can't see unrelated managers' session
   * details purely by having a room name collide.
   */
  async getSchedulingConflicts(actor: AuthenticatedUser): Promise<SchedulingConflictEntry[]> {
    const scopedEventIds = await this.resolveScopedEventIds(actor);

    const rows = await this.sessionModel.aggregate<{
      room: string;
      a: { _id: Types.ObjectId; event: Types.ObjectId; title: string; startTime: Date; endTime: Date };
      b: { _id: Types.ObjectId; event: Types.ObjectId; title: string; startTime: Date; endTime: Date };
    }>([
      { $match: { status: { $ne: SessionStatus.CANCELLED } } },
      {
        $lookup: {
          from: 'sessions',
          let: { room: '$room', startTime: '$startTime', endTime: '$endTime', selfId: '$_id' },
          pipeline: [
            {
              $match: {
                status: { $ne: SessionStatus.CANCELLED },
                $expr: {
                  $and: [
                    { $eq: ['$room', '$$room'] },
                    { $ne: ['$_id', '$$selfId'] },
                    { $lt: ['$startTime', '$$endTime'] },
                    { $gt: ['$endTime', '$$startTime'] },
                  ],
                },
              },
            },
          ],
          as: 'overlaps',
        },
      },
      { $unwind: '$overlaps' },
      // Each conflicting pair appears twice (A vs B, B vs A); keep only one
      // direction so the result contains each pair once.
      { $match: { $expr: { $lt: ['$_id', '$overlaps._id'] } } },
      {
        $project: {
          _id: 0,
          room: 1,
          a: { _id: '$_id', event: '$event', title: '$title', startTime: '$startTime', endTime: '$endTime' },
          b: {
            _id: '$overlaps._id',
            event: '$overlaps.event',
            title: '$overlaps.title',
            startTime: '$overlaps.startTime',
            endTime: '$overlaps.endTime',
          },
        },
      },
    ]);

    const scopedIdSet = scopedEventIds ? new Set(scopedEventIds.map((id) => id.toString())) : null;
    const relevant = scopedIdSet
      ? rows.filter((row) => scopedIdSet.has(row.a.event.toString()) || scopedIdSet.has(row.b.event.toString()))
      : rows;

    if (relevant.length === 0) {
      return [];
    }

    const eventIdsNeeded = new Set<string>();
    for (const row of relevant) {
      eventIdsNeeded.add(row.a.event.toString());
      eventIdsNeeded.add(row.b.event.toString());
    }
    const events = await this.eventModel
      .find({ _id: { $in: Array.from(eventIdsNeeded).map((id) => new Types.ObjectId(id)) } })
      .select('name')
      .exec();
    const eventNameById = new Map(events.map((e) => [e._id.toString(), e.name]));

    const toSessionEntry = (s: {
      _id: Types.ObjectId;
      event: Types.ObjectId;
      title: string;
      startTime: Date;
      endTime: Date;
    }): SchedulingConflictSession => ({
      sessionId: s._id.toString(),
      eventId: s.event.toString(),
      eventName: eventNameById.get(s.event.toString()) ?? 'Unknown event',
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
    });

    return relevant.map((row) => ({
      room: row.room,
      sessions: [toSessionEntry(row.a), toSessionEntry(row.b)],
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
