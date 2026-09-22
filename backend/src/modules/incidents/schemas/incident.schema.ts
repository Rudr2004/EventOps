import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { IncidentSeverity, IncidentStatus } from '../incident-enums.js';

export type IncidentDocument = HydratedDocument<Incident>;

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: false } })
export class IncidentActivityEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ trim: true, default: '' })
  detail: string;
}

export const IncidentActivityEntrySchema = SchemaFactory.createForClass(IncidentActivityEntry);

@Schema({ timestamps: true })
export class Incident {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Session', default: null })
  session: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: String, enum: IncidentSeverity, required: true, index: true })
  severity: IncidentSeverity;

  @Prop({ type: String, enum: IncidentStatus, default: IncidentStatus.OPEN, index: true })
  status: IncidentStatus;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  assignee: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  @Prop({ type: [IncidentActivityEntrySchema], default: [] })
  activity: IncidentActivityEntry[];
}

export const IncidentSchema = SchemaFactory.createForClass(Incident);

IncidentSchema.index({ event: 1, status: 1 });
IncidentSchema.index({ severity: 1, status: 1 });
IncidentSchema.index({ assignee: 1, status: 1 });
