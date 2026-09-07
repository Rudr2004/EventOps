import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { Event, EventSchema } from './schemas/event.schema.js';
import {
  EventStatusHistory,
  EventStatusHistorySchema,
} from './schemas/event-status-history.schema.js';

const eventFeatures = MongooseModule.forFeature([
  { name: Event.name, schema: EventSchema },
  { name: EventStatusHistory.name, schema: EventStatusHistorySchema },
]);

@Module({
  imports: [eventFeatures],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService, eventFeatures],
})
export class EventsModule {}
