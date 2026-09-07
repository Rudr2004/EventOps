import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../../common/enums/role.enum.js';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, required: true, enum: Role, default: Role.VIEWER, index: true })
  role: Role;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: String, select: false, default: null })
  refreshTokenHash: string | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
