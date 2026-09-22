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
  let otherManagerToken: string;
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

    const otherManagerEmail = uniqueEmail('sessions-other-manager');
    createdUserEmails.push(otherManagerEmail);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Other Sessions Manager', email: otherManagerEmail, password: 'StrongP@ssw0rd' });
    await connection
      .collection('users')
      .updateOne({ email: otherManagerEmail }, { $set: { role: 'event_manager' } });
    const otherLoginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherManagerEmail, password: 'StrongP@ssw0rd' });
    otherManagerToken = (otherLoginRes.body.data as AuthResult).accessToken;
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

  it('rejects a session with a start time in the past', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Backdated Session',
        room: 'Room E',
        startTime: '2020-01-01T09:00:00.000Z',
        endTime: '2020-01-01T10:00:00.000Z',
      })
      .expect(400);
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

  it('rejects a session that overlaps another event\'s session in the same physical room', async () => {
    const otherEventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({
        name: 'Cross-Event Room Conflict Event',
        venue: 'Convention Center',
        startDate: '2027-01-01T08:00:00.000Z',
        endDate: '2027-01-03T18:00:00.000Z',
      })
      .expect(201);
    const otherEventId = otherEventRes.body.data.id;
    createdEventIds.push(otherEventId);

    // "Main Hall" is already booked 09:00-10:00 on the first event ("Opening Keynote").
    // A different event trying to book the same physical room in an overlapping
    // window must be rejected too - a room can't be in two places at once.
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${otherEventId}/sessions`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({
        title: 'Conflicting Cross-Event Session',
        room: 'Main Hall',
        startTime: '2027-01-01T09:30:00.000Z',
        endTime: '2027-01-01T10:30:00.000Z',
      })
      .expect(409);

    expect(res.body.success).toBe(false);
  });

  describe('row-level read scoping', () => {
    it('hides sessions on an event another Event Manager does not own (404 on the list route)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/events/${eventId}/sessions`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .expect(404);
    });

    it('hides a single session from an Event Manager who does not own its event (404)', async () => {
      const sessionId = createdSessionIds[0];
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .expect(404);
    });

    it('still lets the owning Event Manager fetch a session by id', async () => {
      const sessionId = createdSessionIds[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(sessionId);
    });
  });

  describe('GET /schedule/calendar', () => {
    it('groups this event\'s sessions by day and room with the event name attached', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schedule/calendar?from=2027-01-01T00:00:00.000Z&to=2027-01-02T00:00:00.000Z`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const days = res.body.data as Array<{
        date: string;
        rooms: Array<{ room: string; sessions: Array<{ id: string; eventName: string; eventId: string }> }>;
      }>;
      expect(days.length).toBeGreaterThan(0);

      const day = days.find((d) => d.date === '2027-01-01');
      expect(day).toBeDefined();

      const mainHall = day?.rooms.find((r) => r.room === 'Main Hall');
      expect(mainHall).toBeDefined();
      expect(mainHall?.sessions.length).toBeGreaterThanOrEqual(2);
      expect(mainHall?.sessions[0].eventId).toBe(eventId);
      expect(mainHall?.sessions[0].eventName).toBe('Sessions E2E Event');

      // Sessions within a room are sorted chronologically.
      const startTimes = mainHall!.sessions.map((s) => new Date((s as any).startTime).getTime());
      expect(startTimes).toEqual([...startTimes].sort((a, b) => a - b));
    });

    it('filters the calendar by room', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schedule/calendar?room=Main Hall`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const days = res.body.data as Array<{ rooms: Array<{ room: string; sessions: unknown[] }> }>;
      expect(days.length).toBeGreaterThan(0);
      const totalSessions = days.flatMap((d) => d.rooms).flatMap((r) => r.sessions);
      expect(totalSessions.length).toBeGreaterThanOrEqual(2);
      for (const day of days) {
        for (const roomGroup of day.rooms) {
          expect(roomGroup.room).toBe('Main Hall');
        }
      }

      const otherRoomRes = await request(app.getHttpServer())
        .get(`/api/v1/schedule/calendar?room=Room Nobody Booked`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
      expect(otherRoomRes.body.data).toEqual([]);
    });

    it('hides another Event Manager\'s sessions from the calendar', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/schedule/calendar?from=2027-01-01T00:00:00.000Z&to=2027-01-02T00:00:00.000Z`)
        .set('Authorization', `Bearer ${otherManagerToken}`)
        .expect(200);

      const days = res.body.data as Array<{ rooms: Array<{ sessions: Array<{ eventId: string }> }> }>;
      const allSessionEventIds = days.flatMap((d) => d.rooms.flatMap((r) => r.sessions.map((s) => s.eventId)));
      expect(allSessionEventIds).not.toContain(eventId);
    });
  });
});
