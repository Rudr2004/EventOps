import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { EventStatus } from '../event-status.enum.js';

export type EventDocument = HydratedDocument<Event>;

@Schema({ timestamps: true })
export class Event {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, trim: true })
  venue: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  endDate: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  owner: Types.ObjectId;

  @Prop({ type: String, enum: EventStatus, default: EventStatus.DRAFT, index: true })
  status: EventStatus;

  @Prop({ default: false })
  isArchived: boolean;
}

export const EventSchema = SchemaFactory.createForClass(Event);

EventSchema.index({ status: 1, startDate: 1 });
EventSchema.index({ name: 'text', description: 'text', venue: 'text' });
