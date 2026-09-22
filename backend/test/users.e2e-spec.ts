import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
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

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let connection: Connection;
  let adminToken: string;
  let adminId: string;
  let managerToken: string;
  let targetUserId: string;
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

    const admin = await registerWithRole('users-admin', 'admin');
    adminToken = admin.accessToken;
    adminId = admin.user.id;

    const manager = await registerWithRole('users-manager', 'event_manager');
    managerToken = manager.accessToken;

    const target = await registerWithRole('users-target', 'viewer');
    targetUserId = target.user.id;
  });

  afterAll(async () => {
    if (createdUserEmails.length > 0) {
      await connection.collection('users').deleteMany({ email: { $in: createdUserEmails } });
    }
    await app.close();
  });

  it('rejects a non-Admin listing users other than Event Manager (RBAC)', async () => {
    const ops = await registerWithRole('users-ops-rbac', 'operations_member');
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${ops.accessToken}`)
      .expect(403);
  });

  it('allows an Event Manager to list users (for the assignee picker)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
  });

  it('rejects an Event Manager changing a role (Admin only)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'operations_member' })
      .expect(403);
  });

  it('rejects an Admin changing their own role (self-lockout guard)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${adminId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'viewer' })
      .expect(400);
  });

  it('rejects an Admin deactivating their own account (self-lockout guard)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${adminId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(400);
  });

  it('allows an Admin to change another user\'s role (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'operations_member' })
      .expect(200);

    expect(res.body.data.role).toBe('operations_member');
  });

  it('allows an Admin to deactivate another user\'s account (happy path)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    expect(res.body.data.isActive).toBe(false);
  });

  it('reactivates the account so a deactivated test user does not linger', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true })
      .expect(200);
  });
});
