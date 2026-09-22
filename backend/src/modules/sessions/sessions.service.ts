import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { QueryCalendarDto } from './dto/query-calendar.dto.js';
import { SessionStatus } from './session-status.enum.js';
import { EventsService } from '../events/events.service.js';
import { SpeakersService } from '../speakers/speakers.service.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

interface TimeWindow {
  room: string;
  startTime: Date;
  endTime: Date;
  speakerIds: string[];
  excludeSessionId?: string;
}

export interface CalendarSessionEntry {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  room: string;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  speakers: string[];
}

export interface CalendarRoomGroup {
  room: string;
  sessions: CalendarSessionEntry[];
}

export interface CalendarDayGroup {
  date: string;
  rooms: CalendarRoomGroup[];
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    private readonly eventsService: EventsService,
    private readonly speakersService: SpeakersService,
  ) {}

  async create(eventId: string, dto: CreateSessionDto): Promise<SessionDocument> {
    await this.eventsService.findById(eventId);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (startTime < new Date()) {
      throw new BadRequestException('startTime cannot be in the past');
    }

    const speakerIds = dto.speakers ?? [];
    await this.assertSpeakersExist(speakerIds);

    await this.assertNoConflicts({ room: dto.room, startTime, endTime, speakerIds });

    return this.sessionModel.create({
      event: new Types.ObjectId(eventId),
      title: dto.title,
      description: dto.description ?? '',
      room: dto.room,
      startTime,
      endTime,
      speakers: speakerIds.map((id) => new Types.ObjectId(id)),
      status: SessionStatus.SCHEDULED,
    });
  }

  async findByEvent(eventId: string, actor: AuthenticatedUser): Promise<SessionDocument[]> {
    await this.eventsService.findByIdScoped(eventId, actor);
    return this.sessionModel.find({ event: eventId }).sort({ startTime: 1 }).exec();
  }

  async findById(id: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(id).exec();
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  async findByIdScoped(id: string, actor: AuthenticatedUser): Promise<SessionDocument> {
    const session = await this.findById(id);
    await this.eventsService.findByIdScoped(session.event.toString(), actor);
    return session;
  }

  /**
   * Cross-event schedule for a calendar/timeline UI: sessions grouped by
   * calendar day (UTC) and then by room, sorted chronologically within
   * each room. Scoped the same way as event visibility elsewhere — an
   * Event Manager only sees sessions on events they own; other roles see
   * everything, matching the read-only "all events" rule for Ops
   * Member/Viewer/Admin.
   */
  async getCalendar(
    query: QueryCalendarDto,
    actor: AuthenticatedUser,
  ): Promise<CalendarDayGroup[]> {
    const match: Record<string, unknown> = {};

    if (query.from || query.to) {
      match.startTime = {};
      if (query.from) {
        (match.startTime as Record<string, Date>).$gte = new Date(query.from);
      }
      if (query.to) {
        (match.startTime as Record<string, Date>).$lte = new Date(query.to);
      }
    }
    if (query.room) {
      match.room = query.room;
    }
    if (actor.role === Role.EVENT_MANAGER) {
      const ownedEventIds = await this.eventsService.findOwnedEventIds(actor.userId);
      match.event = { $in: ownedEventIds };
    }

    const rows = await this.sessionModel.aggregate<{
      _id: Types.ObjectId;
      eventId: Types.ObjectId;
      eventName: string;
      title: string;
      room: string;
      startTime: Date;
      endTime: Date;
      status: SessionStatus;
      speakers: Types.ObjectId[];
    }>([
      { $match: match },
      { $sort: { startTime: 1 } },
      {
        $lookup: {
          from: 'events',
          localField: 'event',
          foreignField: '_id',
          as: 'eventDoc',
        },
      },
      { $unwind: '$eventDoc' },
      {
        $project: {
          _id: 1,
          eventId: '$event',
          eventName: '$eventDoc.name',
          title: 1,
          room: 1,
          startTime: 1,
          endTime: 1,
          status: 1,
          speakers: 1,
        },
      },
    ]);

    const dayMap = new Map<string, Map<string, CalendarSessionEntry[]>>();

    for (const row of rows) {
      const dayKey = row.startTime.toISOString().slice(0, 10);
      const entry: CalendarSessionEntry = {
        id: row._id.toString(),
        eventId: row.eventId.toString(),
        eventName: row.eventName,
        title: row.title,
        room: row.room,
        startTime: row.startTime,
        endTime: row.endTime,
        status: row.status,
        speakers: row.speakers.map((s) => s.toString()),
      };

      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, new Map());
      }
      const roomMap = dayMap.get(dayKey)!;
      if (!roomMap.has(row.room)) {
        roomMap.set(row.room, []);
      }
      roomMap.get(row.room)!.push(entry);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, roomMap]) => ({
        date,
        rooms: Array.from(roomMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([room, sessions]) => ({ room, sessions })),
      }));
  }

  async update(id: string, dto: UpdateSessionDto): Promise<SessionDocument> {
    const session = await this.findById(id);

    const startTime = dto.startTime ? new Date(dto.startTime) : session.startTime;
    const endTime = dto.endTime ? new Date(dto.endTime) : session.endTime;
    if (endTime <= startTime) {
      throw new BadRequestException('endTime must be after startTime');
    }

    const room = dto.room ?? session.room;
    const speakerIds = dto.speakers ?? session.speakers.map((s) => s.toString());

    if (dto.speakers) {
      await this.assertSpeakersExist(dto.speakers);
    }

    await this.assertNoConflicts({
      room,
      startTime,
      endTime,
      speakerIds,
      excludeSessionId: session._id.toString(),
    });

    if (dto.title !== undefined) session.title = dto.title;
    if (dto.description !== undefined) session.description = dto.description;
    if (dto.room !== undefined) session.room = dto.room;
    if (dto.startTime !== undefined) session.startTime = startTime;
    if (dto.endTime !== undefined) session.endTime = endTime;
    if (dto.speakers !== undefined) {
      session.speakers = dto.speakers.map((sid) => new Types.ObjectId(sid));
    }

    await session.save();
    return session;
  }

  async updateStatus(id: string, status: SessionStatus): Promise<SessionDocument> {
    const session = await this.findById(id);
    session.status = status;
    await session.save();
    return session;
  }

  private async assertSpeakersExist(speakerIds: string[]): Promise<void> {
    await Promise.all(speakerIds.map((id) => this.speakersService.findById(id)));
  }

  private async assertNoConflicts(window: TimeWindow): Promise<void> {
    const overlapFilter = {
      startTime: { $lt: window.endTime },
      endTime: { $gt: window.startTime },
      ...(window.excludeSessionId ? { _id: { $ne: window.excludeSessionId } } : {}),
    };

    const roomConflict = await this.sessionModel
      .findOne({
        room: window.room,
        status: { $ne: SessionStatus.CANCELLED },
        ...overlapFilter,
      })
      .exec();

    if (roomConflict) {
      throw new ConflictException(
        `Room '${window.room}' is already booked for an overlapping session`,
      );
    }

    if (window.speakerIds.length > 0) {
      const speakerConflict = await this.sessionModel
        .findOne({
          speakers: { $in: window.speakerIds.map((id) => new Types.ObjectId(id)) },
          status: { $ne: SessionStatus.CANCELLED },
          ...overlapFilter,
        })
        .exec();

      if (speakerConflict) {
        throw new ConflictException(
          'One or more speakers are already booked for an overlapping session',
        );
      }
    }
  }
}
