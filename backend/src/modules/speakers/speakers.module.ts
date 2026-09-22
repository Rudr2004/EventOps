import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SpeakersService } from './speakers.service.js';
import { SpeakersController } from './speakers.controller.js';
import { Speaker, SpeakerSchema } from './schemas/speaker.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Speaker.name, schema: SpeakerSchema }])],
  controllers: [SpeakersController],
  providers: [SpeakersService],
  exports: [SpeakersService],
})
export class SpeakersModule {}
