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

describe('Approvals (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let otherManagerToken: string;
  let adminToken: string;
  const createdEventIds: string[] = [];
  const createdUserEmails: string[] = [];

  async function registerWithRole(prefix: string, role: string): Promise<string> {
    const email = uniqueEmail(prefix);
    createdUserEmails.push(email);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: prefix, email, password: 'StrongP@ssw0rd' });
    await connection.collection('users').updateOne({ email }, { $set: { role } });
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongP@ssw0rd' });
    return (loginRes.body.data as AuthResult).accessToken;
  }

  async function createPlanningEvent(token: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Approvals E2E Event',
        venue: 'Board Room',
        startDate: '2027-03-01T08:00:00.000Z',
        endDate: '2027-03-02T08:00:00.000Z',
      });
    const eventId = res.body.data.id as string;
    createdEventIds.push(eventId);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'planning' })
      .expect(200);

    return eventId;
  }

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

    managerToken = await registerWithRole('approvals-manager', 'event_manager');
    otherManagerToken = await registerWithRole('approvals-other-manager', 'event_manager');
    adminToken = await registerWithRole('approvals-admin', 'admin');
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await connection
        .collection('events')
        .deleteMany({ _id: { $in: createdEventIds.map((id) => new Types.ObjectId(id)) } });
      await connection
        .collection('eventstatushistories')
        .deleteMany({ event: { $in: createdEventIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('rejects a non-owning Event Manager submitting the event (RBAC)', async () => {
    const eventId = await createPlanningEvent(managerToken);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .expect(403);
  });

  it('rejects an Admin submitting an event (RBAC — submit is Event Manager only)', async () => {
    const eventId = await createPlanningEvent(managerToken);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });

  it('allows the owning Event Manager to submit for approval (happy path)', async () => {
    const eventId = await createPlanningEvent(managerToken);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    expect(res.body.data.status).toBe('approval_pending');
  });

  it('rejects a non-Admin approving an event (RBAC)', async () => {
    const eventId = await createPlanningEvent(managerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ comment: 'trying to self-approve' })
      .expect(403);
  });

  it('allows an Admin to approve a pending event', async () => {
    const eventId = await createPlanningEvent(managerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ comment: 'Approved for booking' })
      .expect(201);

    expect(res.body.data.status).toBe('approved');
  });

  it('rejects approving an event twice', async () => {
    const eventId = await createPlanningEvent(managerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('returns a rejected event to Planning with the reason recorded, and requires a reason', async () => {
    const eventId = await createPlanningEvent(managerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Budget line item for catering is missing.' })
      .expect(201);

    expect(res.body.data.status).toBe('planning');
  });

  it('records full approval history with actor, timestamps, statuses and comment', async () => {
    const eventId = await createPlanningEvent(managerToken);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Needs more detail' })
      .expect(201);

    const historyRes = await request(app.getHttpServer())
      .get(`/api/v1/events/${eventId}/approval-history`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    const history = historyRes.body.data as Array<Record<string, unknown>>;
    expect(history.length).toBeGreaterThanOrEqual(2);

    const submitEntry = history.find((h) => h.newStatus === 'approval_pending');
    expect(submitEntry).toMatchObject({
      previousStatus: 'planning',
      newStatus: 'approval_pending',
    });
    expect(submitEntry?.actor).toBeTruthy();
    expect(submitEntry?.createdAt).toBeTruthy();

    const rejectEntry = history.find((h) => h.newStatus === 'planning' && h.previousStatus === 'approval_pending');
    expect(rejectEntry).toMatchObject({
      previousStatus: 'approval_pending',
      newStatus: 'planning',
      comment: 'Needs more detail',
    });
  });

  it('rejects submitting from a status other than Planning', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Still Draft Event',
        venue: 'Board Room',
        startDate: '2027-03-05T08:00:00.000Z',
        endDate: '2027-03-06T08:00:00.000Z',
      });
    const eventId = res.body.data.id as string;
    createdEventIds.push(eventId);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(400);
  });
});
