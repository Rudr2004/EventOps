import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { EventStatus } from '../event-status.enum.js';

export type EventStatusHistoryDocument = HydratedDocument<EventStatusHistory>;

/**
 * One row per event status transition — covers both ordinary lifecycle moves
 * and approval submit/approve/reject, since approval IS an event status
 * change. This is the single audit trail satisfying both "every important
 * state transition should be auditable" and the approval-history spec
 * requirement (actor, timestamp, previousStatus, newStatus, comment).
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class EventStatusHistory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  @Prop({ type: String, enum: EventStatus, required: true })
  previousStatus: EventStatus;

  @Prop({ type: String, enum: EventStatus, required: true })
  newStatus: EventStatus;

  @Prop({ trim: true, default: '' })
  comment: string;
}

export const EventStatusHistorySchema = SchemaFactory.createForClass(EventStatusHistory);

EventStatusHistorySchema.index({ event: 1, createdAt: 1 });
