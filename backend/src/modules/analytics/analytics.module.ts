import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service.js';
import { AnalyticsController } from './analytics.controller.js';
import { Event, EventSchema } from '../events/schemas/event.schema.js';
import {
  EventStatusHistory,
  EventStatusHistorySchema,
} from '../events/schemas/event-status-history.schema.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { Incident, IncidentSchema } from '../incidents/schemas/incident.schema.js';
import { Session, SessionSchema } from '../sessions/schemas/session.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Event.name, schema: EventSchema },
      { name: EventStatusHistory.name, schema: EventStatusHistorySchema },
      { name: Task.name, schema: TaskSchema },
      { name: Incident.name, schema: IncidentSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
