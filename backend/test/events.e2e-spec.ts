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

describe('Events (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let managerId: string;
  let viewerToken: string;
  const createdEventIds: string[] = [];
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

    const managerEmail = uniqueEmail('manager');
    createdUserEmails.push(managerEmail);
    const managerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Manager User', email: managerEmail, password: 'StrongP@ssw0rd' });
    const managerAuth = managerRes.body.data as AuthResult;
    managerId = managerAuth.user.id;
    await connection
      .collection('users')
      .updateOne({ email: managerEmail }, { $set: { role: 'event_manager' } });
    const managerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: managerEmail, password: 'StrongP@ssw0rd' });
    managerToken = (managerLogin.body.data as AuthResult).accessToken;

    const viewerEmail = uniqueEmail('viewer');
    createdUserEmails.push(viewerEmail);
    const viewerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Viewer User', email: viewerEmail, password: 'StrongP@ssw0rd' });
    viewerToken = (viewerRes.body.data as AuthResult).accessToken;
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await connection.collection('events').deleteMany({
        _id: { $in: createdEventIds.map((id) => new Types.ObjectId(id)) },
      });
    }
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('rejects unauthenticated event creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/events')
      .send({
        name: 'No Auth Event',
        venue: 'Hall A',
        startDate: '2026-11-01T09:00:00.000Z',
        endDate: '2026-11-02T09:00:00.000Z',
      })
      .expect(401);
  });

  it('rejects a Viewer creating an event (RBAC)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        name: 'Viewer Attempt',
        venue: 'Hall A',
        startDate: '2026-11-01T09:00:00.000Z',
        endDate: '2026-11-02T09:00:00.000Z',
      })
      .expect(403);
  });

  it('rejects invalid payloads with a 400 and validation message', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'ab', venue: 'Hall A' })
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.message).toBeDefined();
  });

  it('rejects an end date before the start date', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Backwards Dates',
        venue: 'Hall A',
        startDate: '2026-11-02T09:00:00.000Z',
        endDate: '2026-11-01T09:00:00.000Z',
      })
      .expect(400);
  });

  it('allows an Event Manager to create an event (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'E2E Tech Summit',
        description: 'Created by e2e test',
        venue: 'Hall A',
        startDate: '2026-11-01T09:00:00.000Z',
        endDate: '2026-11-02T09:00:00.000Z',
      })
      .expect(201);

    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.owner).toBe(managerId);
    createdEventIds.push(res.body.data.id);
  });

  it('lists events with pagination metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/events?page=1&limit=5')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(res.body.data.items).toBeInstanceOf(Array);
    expect(res.body.data.meta).toEqual(
      expect.objectContaining({ page: 1, limit: 5, total: expect.any(Number) }),
    );
  });

  it('walks an event through its valid lifecycle transitions', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Lifecycle Event',
        venue: 'Hall B',
        startDate: '2026-12-01T09:00:00.000Z',
        endDate: '2026-12-02T09:00:00.000Z',
      })
      .expect(201);
    const eventId = createRes.body.data.id as string;
    createdEventIds.push(eventId);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'planning' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'approval_pending' })
      .expect(200);

    const rejectedRes = await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'live' })
      .expect(400);
    expect(rejectedRes.body.success).toBe(false);
  });

  it('rejects a Viewer attempting to change event status (RBAC)', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Viewer Boundary Event',
        venue: 'Hall C',
        startDate: '2026-12-05T09:00:00.000Z',
        endDate: '2026-12-06T09:00:00.000Z',
      })
      .expect(201);
    const eventId = createRes.body.data.id as string;
    createdEventIds.push(eventId);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'planning' })
      .expect(403);
  });
});
