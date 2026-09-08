import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { SpeakersModule } from './modules/speakers/speakers.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { ApprovalsModule } from './modules/approvals/approvals.module.js';
import { IncidentsModule } from './modules/incidents/incidents.module.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import type { AppConfig } from './config/configuration.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<AppConfig['mongodbUri']>('app.mongodbUri'),
      }),
    }),
    AuthModule,
    UsersModule,
    HealthModule,
    EventsModule,
    SpeakersModule,
    SessionsModule,
    TasksModule,
    ApprovalsModule,
    IncidentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
