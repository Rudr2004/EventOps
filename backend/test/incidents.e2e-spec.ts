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

describe('Incidents (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let opsToken: string;
  let opsUserId: string;
  let otherOpsToken: string;
  let viewerToken: string;
  let viewerUserId: string;
  let eventId: string;
  const createdEventIds: string[] = [];
  const createdIncidentIds: string[] = [];
  const createdUserEmails: string[] = [];

  async function registerWithRole(prefix: string, role: string): Promise<AuthResult> {
    const email = uniqueEmail(prefix);
    createdUserEmails.push(email);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: prefix, email, password: 'StrongP@ssw0rd' });
    if (role !== 'viewer') {
      await connection.collection('users').updateOne({ email }, { $set: { role } });
    }
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'StrongP@ssw0rd' });
    return loginRes.body.data as AuthResult;
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

    const manager = await registerWithRole('incidents-manager', 'event_manager');
    managerToken = manager.accessToken;

    const ops = await registerWithRole('incidents-ops', 'operations_member');
    opsToken = ops.accessToken;
    opsUserId = ops.user.id;

    const otherOps = await registerWithRole('incidents-other-ops', 'operations_member');
    otherOpsToken = otherOps.accessToken;

    const viewer = await registerWithRole('incidents-viewer', 'viewer');
    viewerToken = viewer.accessToken;
    viewerUserId = viewer.user.id;

    const eventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Incidents E2E Event',
        venue: 'Ops Center',
        startDate: '2027-06-01T08:00:00.000Z',
        endDate: '2027-06-03T18:00:00.000Z',
      });
    eventId = eventRes.body.data.id;
    createdEventIds.push(eventId);
  });

  afterAll(async () => {
    if (createdIncidentIds.length > 0) {
      await connection
        .collection('incidents')
        .deleteMany({ _id: { $in: createdIncidentIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdEventIds.length > 0) {
      await connection
        .collection('events')
        .deleteMany({ _id: { $in: createdEventIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('rejects a Viewer creating an incident (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Should fail', severity: 'high' })
      .expect(403);
  });

  it('rejects an Operations Member creating an incident (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ title: 'Should fail', severity: 'high' })
      .expect(403);
  });

  it('rejects an incident assigned to a non-Operations-Member', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Bad assignee', severity: 'medium', assignee: viewerUserId })
      .expect(400);
  });

  it('creates a critical incident assigned to an Operations Member (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Main stage power failure',
        description: 'Generator tripped mid-show',
        severity: 'critical',
        assignee: opsUserId,
      })
      .expect(201);

    expect(res.body.data.status).toBe('open');
    expect(res.body.data.severity).toBe('critical');
    expect(res.body.data.assignee).toBe(opsUserId);
    createdIncidentIds.push(res.body.data.id);
  });

  it('lists incidents filtered by severity', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/incidents?severity=critical')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(
      res.body.data.items.every((i: { severity: string }) => i.severity === 'critical'),
    ).toBe(true);
  });

  it('allows the assigned Operations Member to move the incident to Investigating', async () => {
    const incidentId = createdIncidentIds[0];
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'investigating' })
      .expect(200);

    expect(res.body.data.status).toBe('investigating');
  });

  it('rejects a different Operations Member updating status on an incident not assigned to them', async () => {
    const incidentId = createdIncidentIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${otherOpsToken}`)
      .send({ status: 'mitigated' })
      .expect(403);
  });

  it('rejects skipping straight to Resolved', async () => {
    const incidentId = createdIncidentIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'resolved' })
      .expect(400);
  });

  it('walks the incident to Mitigated then Resolved, stamping resolvedAt', async () => {
    const incidentId = createdIncidentIds[0];

    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'mitigated' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'resolved' })
      .expect(200);

    expect(res.body.data.status).toBe('resolved');
    expect(res.body.data.resolvedAt).toBeTruthy();
  });

  it('rejects any further transition once Resolved', async () => {
    const incidentId = createdIncidentIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'investigating' })
      .expect(400);
  });

  it('exposes the full activity timeline', async () => {
    const incidentId = createdIncidentIds[0];
    const res = await request(app.getHttpServer())
      .get(`/api/v1/incidents/${incidentId}/timeline`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    const actions = (res.body.data as Array<{ action: string }>).map((e) => e.action);
    expect(actions).toEqual(
      expect.arrayContaining(['created', 'status_changed']),
    );
    expect(actions.filter((a) => a === 'status_changed').length).toBeGreaterThanOrEqual(3);
  });
});
