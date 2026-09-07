import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { SessionStatus } from '../session-status.enum.js';

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ required: true, trim: true, index: true })
  room: string;

  @Prop({ required: true })
  startTime: Date;

  @Prop({ required: true })
  endTime: Date;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Speaker' }], default: [] })
  speakers: Types.ObjectId[];

  @Prop({ type: String, enum: SessionStatus, default: SessionStatus.SCHEDULED })
  status: SessionStatus;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

SessionSchema.index({ event: 1, startTime: 1 });
SessionSchema.index({ room: 1, startTime: 1, endTime: 1 });
