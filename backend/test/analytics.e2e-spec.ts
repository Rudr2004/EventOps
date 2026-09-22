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

describe('Analytics (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let otherManagerToken: string;
  let adminToken: string;
  let opsUserId: string;
  let opsToken: string;
  let viewerToken: string;
  let eventId: string;
  let otherManagerEventId: string;
  const createdEventIds: string[] = [];
  const createdTaskIds: string[] = [];
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

    const manager = await registerWithRole('analytics-manager', 'event_manager');
    managerToken = manager.accessToken;

    const otherManager = await registerWithRole('analytics-other-manager', 'event_manager');
    otherManagerToken = otherManager.accessToken;

    const admin = await registerWithRole('analytics-admin', 'admin');
    adminToken = admin.accessToken;

    const ops = await registerWithRole('analytics-ops', 'operations_member');
    opsToken = ops.accessToken;
    opsUserId = ops.user.id;

    const viewer = await registerWithRole('analytics-viewer', 'viewer');
    viewerToken = viewer.accessToken;

    const eventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Analytics E2E Event',
        venue: 'Ops Center',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      });
    eventId = eventRes.body.data.id;
    createdEventIds.push(eventId);

    const otherEventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${otherManagerToken}`)
      .send({
        name: 'Other Manager Event',
        venue: 'Elsewhere',
        startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      });
    otherManagerEventId = otherEventRes.body.data.id;
    createdEventIds.push(otherManagerEventId);

    // One overdue task, assigned to the ops member.
    const overdueTaskRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Overdue task',
        assignee: opsUserId,
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
    createdTaskIds.push(overdueTaskRes.body.data.id);

    // One done task, same assignee, for completion-rate math.
    const doneTaskRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Done task', assignee: opsUserId });
    createdTaskIds.push(doneTaskRes.body.data.id);
    const doneTaskId = doneTaskRes.body.data.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${doneTaskId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'in_progress' });
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${doneTaskId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'review' });
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${doneTaskId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'done' });

    // One unresolved critical incident.
    const incidentRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Critical incident', severity: 'critical', assignee: opsUserId });
    createdIncidentIds.push(incidentRes.body.data.id);

    // One resolved incident, to exercise average-resolution-time math.
    const resolvedIncidentRes = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/incidents`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Resolved incident', severity: 'low', assignee: opsUserId });
    createdIncidentIds.push(resolvedIncidentRes.body.data.id);
    const resolvedIncidentId = resolvedIncidentRes.body.data.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${resolvedIncidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'investigating' });
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${resolvedIncidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'mitigated' });
    await request(app.getHttpServer())
      .patch(`/api/v1/incidents/${resolvedIncidentId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'resolved' });

    // One room-utilization data point.
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/sessions`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Analytics Session',
        room: 'Analytics Room',
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      });

    // Full approval cycle, to exercise turnaround-time math.
    await request(app.getHttpServer())
      .patch(`/api/v1/events/${eventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'planning' });
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
  });

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await connection
        .collection('tasks')
        .deleteMany({ _id: { $in: createdTaskIds.map((id) => new Types.ObjectId(id)) } });
    }
    if (createdIncidentIds.length > 0) {
      await connection
        .collection('incidents')
        .deleteMany({ _id: { $in: createdIncidentIds.map((id) => new Types.ObjectId(id)) } });
    }
    await connection.collection('sessions').deleteMany({ title: 'Analytics Session' });
    if (createdEventIds.length > 0) {
      const objectIds = createdEventIds.map((id) => new Types.ObjectId(id));
      await connection.collection('events').deleteMany({ _id: { $in: objectIds } });
      await connection.collection('eventstatushistories').deleteMany({ event: { $in: objectIds } });
    }
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('rejects a Viewer from accessing analytics (RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('rejects an Operations Member from accessing analytics (RBAC)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${opsToken}`)
      .expect(403);
  });

  it('rejects an Event Manager requesting another manager\'s event analytics', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/analytics/overview?event=${otherManagerEventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(400);
  });

  it('returns overview counts scoped to the requested event', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/overview?event=${eventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data.eventsByStatus.approved).toBe(1);
    expect(res.body.data.upcomingEvents.next7Days).toBe(1);
    expect(res.body.data.tasks.open).toBe(1);
    expect(res.body.data.tasks.overdue).toBe(1);
  });

  it('computes workload and completion rate per assignee', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/workload?event=${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const opsWorkload = (res.body.data as Array<{ assignee: string }>).find(
      (w) => w.assignee === opsUserId,
    );
    expect(opsWorkload).toBeDefined();
    expect(opsWorkload?.total).toBe(2);
    expect(opsWorkload?.done).toBe(1);
    expect(opsWorkload?.completionRate).toBe(50);
  });

  it('computes incident severity/status breakdown and average resolution time', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/incidents?event=${eventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data.bySeverity.critical).toBe(1);
    expect(res.body.data.bySeverity.low).toBe(1);
    expect(res.body.data.byStatus.resolved).toBe(1);
    expect(res.body.data.byStatus.open).toBe(1);
    expect(res.body.data.averageResolutionHours).toBeGreaterThanOrEqual(0);
  });

  it('computes room utilization', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/room-utilization?event=${eventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    const room = (res.body.data as Array<{ room: string }>).find((r) => r.room === 'Analytics Room');
    expect(room).toBeDefined();
    expect(room).toMatchObject({ sessionCount: 1, totalMinutes: 60 });
  });

  it('computes approval turnaround time from submit to approve', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/approval-turnaround?event=${eventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data.sampleSize).toBeGreaterThanOrEqual(1);
    expect(res.body.data.averageHours).toBeGreaterThanOrEqual(0);
  });

  it('pairs each submission with the next decision after a reject-and-resubmit cycle', async () => {
    const cycleEventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Turnaround Resubmission Event',
        venue: 'Ops Center',
        startDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    const cycleEventId = cycleEventRes.body.data.id;
    createdEventIds.push(cycleEventId);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${cycleEventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'planning' })
      .expect(200);

    // First cycle: submit, then reject back to Planning.
    await request(app.getHttpServer())
      .post(`/api/v1/events/${cycleEventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${cycleEventId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Needs more detail' })
      .expect(201);

    // Second cycle: resubmit, then approve.
    await request(app.getHttpServer())
      .post(`/api/v1/events/${cycleEventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/events/${cycleEventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/approval-turnaround?event=${cycleEventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    // Two submit -> decide pairs (reject, then approve), each measured against
    // its own submission, not the very first one.
    expect(res.body.data.sampleSize).toBe(2);
    expect(res.body.data.averageHours).toBeGreaterThanOrEqual(0);
  });

  describe('GET /analytics/scheduling-conflicts', () => {
    const createdSessionIds: string[] = [];

    afterAll(async () => {
      if (createdSessionIds.length > 0) {
        await connection
          .collection('sessions')
          .deleteMany({ _id: { $in: createdSessionIds.map((id) => new Types.ObjectId(id)) } });
      }
    });

    // Room conflicts are rejected at write time (SessionsService), so a
    // real conflict can only exist from data inserted outside the API -
    // exactly what this test simulates to exercise the reporting endpoint.
    async function insertSession(eventIdForSession: string, room: string, startTime: string, endTime: string) {
      const doc = {
        event: new Types.ObjectId(eventIdForSession),
        title: `Conflict Probe ${room} ${startTime}`,
        description: '',
        room,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        speakers: [],
        status: 'scheduled',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await connection.collection('sessions').insertOne(doc);
      createdSessionIds.push(result.insertedId.toString());
      return result.insertedId.toString();
    }

    it('reports a conflict between two sessions booked in the same room across different events', async () => {
      await insertSession(eventId, 'Conflict Room', '2027-03-01T09:00:00.000Z', '2027-03-01T10:00:00.000Z');
      await insertSession(
        otherManagerEventId,
        'Conflict Room',
        '2027-03-01T09:30:00.000Z',
        '2027-03-01T10:30:00.000Z',
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/scheduling-conflicts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const conflicts = res.body.data as Array<{
        room: string;
        sessions: Array<{ eventId: string; eventName: string }>;
      }>;
      const conflict = conflicts.find((c) => c.room === 'Conflict Room');
      expect(conflict).toBeDefined();
      expect(conflict?.sessions).toHaveLength(2);
      const involvedEventIds = conflict?.sessions.map((s) => s.eventId) ?? [];
      expect(involvedEventIds).toContain(eventId);
      expect(involvedEventIds).toContain(otherManagerEventId);
      expect(conflict?.sessions.every((s) => s.eventName && s.eventName !== 'Unknown event')).toBe(true);
    });

    it('does not report non-overlapping sessions in the same room as a conflict', async () => {
      await insertSession(eventId, 'Quiet Room', '2027-03-02T09:00:00.000Z', '2027-03-02T10:00:00.000Z');
      await insertSession(eventId, 'Quiet Room', '2027-03-02T10:00:00.000Z', '2027-03-02T11:00:00.000Z');

      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/scheduling-conflicts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const conflicts = res.body.data as Array<{ room: string }>;
      expect(conflicts.find((c) => c.room === 'Quiet Room')).toBeUndefined();
    });

    it('scopes an Event Manager to conflicts involving at least one of their own sessions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/analytics/scheduling-conflicts')
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      const conflicts = res.body.data as Array<{ room: string }>;
      expect(conflicts.some((c) => c.room === 'Conflict Room')).toBe(true);
    });

    it('rejects a Viewer from accessing scheduling conflicts (RBAC)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/analytics/scheduling-conflicts')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });

  it('computes an event health score reflecting overdue tasks and a critical incident', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/event-health?event=${eventId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    const health = (res.body.data as Array<{ eventId: string }>).find((h) => h.eventId === eventId);
    expect(health).toBeDefined();
    expect(health?.overdueTaskCount).toBe(1);
    expect(health?.criticalIncidentCount).toBe(1);
    expect(health?.healthScore).toBeLessThan(100);
  });
});
