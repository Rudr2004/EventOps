import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SpeakerDocument = HydratedDocument<Speaker>;

@Schema({ timestamps: true })
export class Speaker {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ trim: true, default: '' })
  title: string;

  @Prop({ trim: true, default: '' })
  bio: string;

  @Prop({ trim: true, lowercase: true, default: '' })
  email: string;
}

export const SpeakerSchema = SchemaFactory.createForClass(Speaker);
