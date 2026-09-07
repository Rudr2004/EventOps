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

describe('Tasks (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let managerToken: string;
  let opsToken: string;
  let opsUserId: string;
  let otherOpsToken: string;
  let viewerToken: string;
  let adminToken: string;
  let eventId: string;
  const createdEventIds: string[] = [];
  const createdTaskIds: string[] = [];
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

    const manager = await registerWithRole('tasks-manager', 'event_manager');
    managerToken = manager.accessToken;

    const ops = await registerWithRole('tasks-ops', 'operations_member');
    opsToken = ops.accessToken;
    opsUserId = ops.user.id;

    const otherOps = await registerWithRole('tasks-other-ops', 'operations_member');
    otherOpsToken = otherOps.accessToken;

    const viewer = await registerWithRole('tasks-viewer', 'viewer');
    viewerToken = viewer.accessToken;

    const admin = await registerWithRole('tasks-admin', 'admin');
    adminToken = admin.accessToken;

    const eventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Tasks E2E Event',
        venue: 'Ops Center',
        startDate: '2027-02-01T08:00:00.000Z',
        endDate: '2027-02-03T18:00:00.000Z',
      });
    eventId = eventRes.body.data.id;
    createdEventIds.push(eventId);
  });

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await connection
        .collection('tasks')
        .deleteMany({ _id: { $in: createdTaskIds.map((id) => new Types.ObjectId(id)) } });
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

  it('rejects a Viewer creating a task (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/tasks`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ title: 'Should fail' })
      .expect(403);
  });

  it('rejects an Operations Member creating a task (RBAC)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/tasks`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ title: 'Should fail' })
      .expect(403);
  });

  it('creates a task assigned to an Operations Member (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        title: 'Confirm catering headcount',
        assignee: opsUserId,
        priority: 'p1',
        dueDate: '2020-01-01T00:00:00.000Z',
      })
      .expect(201);

    expect(res.body.data.status).toBe('todo');
    expect(res.body.data.assignee).toBe(opsUserId);
    expect(res.body.data.isOverdue).toBe(true);
    createdTaskIds.push(res.body.data.id);
  });

  it('lists tasks filtered by overdue=true', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/tasks?overdue=true')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThan(0);
    expect(res.body.data.items.every((t: { isOverdue: boolean }) => t.isOverdue)).toBe(true);
  });

  it('lists tasks filtered by assignee', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/tasks?assignee=${opsUserId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);

    expect(res.body.data.items.every((t: { assignee: string }) => t.assignee === opsUserId)).toBe(
      true,
    );
  });

  it('allows the assigned Operations Member to move the task to In Progress', async () => {
    const taskId = createdTaskIds[0];
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'in_progress' })
      .expect(200);

    expect(res.body.data.status).toBe('in_progress');
  });

  it('rejects a different Operations Member updating status on a task not assigned to them', async () => {
    const taskId = createdTaskIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${otherOpsToken}`)
      .send({ status: 'review' })
      .expect(403);
  });

  it('rejects an invalid status transition', async () => {
    const taskId = createdTaskIds[0];
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ status: 'done' })
      .expect(400);
  });

  it('allows the assignee to add a comment', async () => {
    const taskId = createdTaskIds[0];
    const res = await request(app.getHttpServer())
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${opsToken}`)
      .send({ text: 'Vendor confirmed headcount.' })
      .expect(201);

    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.comments[0].text).toBe('Vendor confirmed headcount.');
  });

  it('rejects a non-assignee Operations Member from commenting', async () => {
    const taskId = createdTaskIds[0];
    await request(app.getHttpServer())
      .post(`/api/v1/tasks/${taskId}/comments`)
      .set('Authorization', `Bearer ${otherOpsToken}`)
      .send({ text: 'Not my task' })
      .expect(403);
  });

  it('rejects creating a task on a Completed event', async () => {
    const completedEventRes = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        name: 'Already Done Event',
        venue: 'Archive Room',
        startDate: '2020-01-01T08:00:00.000Z',
        endDate: '2020-01-02T08:00:00.000Z',
      });
    const completedEventId = completedEventRes.body.data.id;
    createdEventIds.push(completedEventId);

    await request(app.getHttpServer())
      .patch(`/api/v1/events/${completedEventId}/status`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'planning' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${completedEventId}/submit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/events/${completedEventId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    for (const status of ['live', 'completed']) {
      await request(app.getHttpServer())
        .patch(`/api/v1/events/${completedEventId}/status`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status })
        .expect(200);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/events/${completedEventId}/tasks`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ title: 'Too late' })
      .expect(400);
  });
});
