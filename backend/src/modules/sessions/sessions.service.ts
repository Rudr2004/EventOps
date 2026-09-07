import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Session, SessionDocument } from './schemas/session.schema.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { UpdateSessionDto } from './dto/update-session.dto.js';
import { SessionStatus } from './session-status.enum.js';
import { EventsService } from '../events/events.service.js';
import { SpeakersService } from '../speakers/speakers.service.js';

interface TimeWindow {
  eventId: string;
  room: string;
  startTime: Date;
  endTime: Date;
  speakerIds: string[];
  excludeSessionId?: string;
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

    const speakerIds = dto.speakers ?? [];
    await this.assertSpeakersExist(speakerIds);

    await this.assertNoConflicts({ eventId, room: dto.room, startTime, endTime, speakerIds });

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

  async findByEvent(eventId: string): Promise<SessionDocument[]> {
    await this.eventsService.findById(eventId);
    return this.sessionModel.find({ event: eventId }).sort({ startTime: 1 }).exec();
  }

  async findById(id: string): Promise<SessionDocument> {
    const session = await this.sessionModel.findById(id).exec();
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
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
      eventId: session.event.toString(),
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
        event: window.eventId,
        room: window.room,
        status: { $ne: SessionStatus.CANCELLED },
        ...overlapFilter,
      })
      .exec();

    if (roomConflict) {
      throw new ConflictException(
        `Room '${window.room}' is already booked for an overlapping session in this event`,
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
