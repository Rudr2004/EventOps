import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SessionsService } from './sessions.service.js';
import { SessionsController } from './sessions.controller.js';
import { Session, SessionSchema } from './schemas/session.schema.js';
import { EventsModule } from '../events/events.module.js';
import { SpeakersModule } from '../speakers/speakers.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Session.name, schema: SessionSchema }]),
    EventsModule,
    SpeakersModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
