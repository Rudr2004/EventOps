import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { TaskPriority, TaskStatus } from '../task-enums.js';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ _id: true, timestamps: true })
export class TaskComment {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  author: Types.ObjectId;

  @Prop({ required: true, trim: true })
  text: string;
}

export const TaskCommentSchema = SchemaFactory.createForClass(TaskComment);

@Schema({ _id: false, timestamps: { createdAt: true, updatedAt: false } })
export class TaskActivityEntry {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  actor: Types.ObjectId;

  @Prop({ required: true, trim: true })
  action: string;

  @Prop({ trim: true, default: '' })
  detail: string;
}

export const TaskActivityEntrySchema = SchemaFactory.createForClass(TaskActivityEntry);

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Event', required: true, index: true })
  event: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Session', default: null })
  session: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null, index: true })
  assignee: Types.ObjectId | null;

  @Prop({ type: String, enum: TaskPriority, default: TaskPriority.P3, index: true })
  priority: TaskPriority;

  @Prop({ type: String, enum: TaskStatus, default: TaskStatus.TODO, index: true })
  status: TaskStatus;

  @Prop({ type: Date, default: null })
  dueDate: Date | null;

  @Prop({ type: [TaskCommentSchema], default: [] })
  comments: TaskComment[];

  @Prop({ type: [TaskActivityEntrySchema], default: [] })
  activity: TaskActivityEntry[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ event: 1, status: 1 });
TaskSchema.index({ assignee: 1, status: 1 });
TaskSchema.index({ dueDate: 1 });
