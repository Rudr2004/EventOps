import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Types, type Connection } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter.js';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor.js';

interface AuthResult {
  accessToken: string;
  user: { id: string; role: string };
}

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

describe('Sessions & Speakers (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let eventId: string;
  let speakerId: string;
  const createdEventIds: string[] = [];
  const createdSpeakerIds: string[] = [];
  const createdSessionIds: string[] = [];
  const createdUserEmails: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    connection = app.get(getConnectionToken());

    const managerEmail = uniqueEmail('sessions-manager');
    createdUserEmails.push(managerEmail);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Sessions Manager', email: managerEmail, password: 'StrongP@ssw0rd' });
    await connection
      .collection('users')
      .updateOne({ email: managerEmail }, { $set: { role: 'event_manager' } });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password: 'StrongP@ssw0rd' });
    managerToken = (loginRes.body.data as AuthResult).accessToken;

    const eventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Sessions E2E Event',
        venue: 'Convention Center',
        startDate: '2027-01-01T08:00:00.000Z',
        endDate: '2027-01-03T18:00:00.000Z',
      });
    eventId = eventRes.body.data.id;
    createdEventIds.push(eventId);

    const speakerRes = await request(app.getHttpServer())
      .post('/api/v1/speakers')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Grace Hopper', title: 'Rear Admiral' });
    speakerId = speakerRes.body.data.id;
    createdSpeakerIds.push(speakerId);
  });

  afterAll(async () => {
    if (createdSessionIds.length > 0) {
      await connection
        .collection('sessions')
        .deleteMany({ _id: { $in: createdSessionIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdEventIds.length > 0) {
      await connection
        .collection('events')
        .deleteMany({ _id: { $in: createdEventIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdSpeakerIds.length > 0) {
      await connection
        .collection('speakers')
        .deleteMany({ _id: { $in: createdSpeakerIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('creates a session under an event (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Opening Keynote',
        room: 'Main Hall',
        startTime: '2027-01-01T09:00:00.000Z',
        endTime: '2027-01-01T10:00:00.000Z',
        speakers: [speakerId],
      })
      .expect(201);

    expect(res.body.data.event).toBe(eventId);
    expect(res.body.data.speakers).toEqual([speakerId]);
    createdSessionIds.push(res.body.data.id);
  });

  it('lists sessions scoped to the event they were created under', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].event).toBe(eventId);
  });

  it('rejects a session that overlaps another in the same room', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Room Clash',
        room: 'Main Hall',
        startTime: '2027-01-01T09:30:00.000Z',
        endTime: '2027-01-01T10:30:00.000Z',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
  });

  it('rejects a session that double-books a speaker in a different room', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Speaker Clash',
        room: 'Room B',
        startTime: '2027-01-01T09:30:00.000Z',
        endTime: '2027-01-01T10:30:00.000Z',
        speakers: [speakerId],
      })
      .expect(409);
  });

  it('allows a back-to-back session in the same room with no time overlap', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Follow-up Session',
        room: 'Main Hall',
        startTime: '2027-01-01T10:00:00.000Z',
        endTime: '2027-01-01T11:00:00.000Z',
      })
      .expect(201);

    createdSessionIds.push(res.body.data.id);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(listRes.body.data).toHaveLength(2);
  });

  it('rejects an invalid time range', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Backwards Session',
        room: 'Room C',
        startTime: '2027-01-01T10:00:00.000Z',
        endTime: '2027-01-01T09:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects assigning a non-existent speaker', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Ghost Speaker Session',
        room: 'Room D',
        startTime: '2027-01-01T13:00:00.000Z',
        endTime: '2027-01-01T14:00:00.000Z',
        speakers: [new Types.ObjectId().toString()],
      })
      .expect(404);
  });
});
