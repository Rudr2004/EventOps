import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { IncidentsService } from './incidents.service.js';
import { IncidentSeverity, IncidentStatus } from './incident-enums.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const EVENT_ID = new Types.ObjectId().toString();
const ASSIGNEE_ID = new Types.ObjectId().toString();
const OTHER_OPS_ID = new Types.ObjectId().toString();

function buildIncident(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    event: new Types.ObjectId(EVENT_ID),
    session: null,
    title: 'Main stage sound failure',
    description: '',
    severity: IncidentSeverity.HIGH,
    status: IncidentStatus.OPEN,
    assignee: new Types.ObjectId(ASSIGNEE_ID),
    resolvedAt: null,
    activity: [],
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildActor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return { userId: ASSIGNEE_ID, email: 'ops@example.com', role: Role.OPERATIONS_MEMBER, ...overrides };
}

function buildUsersService(assigneeRole: Role = Role.OPERATIONS_MEMBER) {
  return { findById: vi.fn().mockResolvedValue({ role: assigneeRole }) };
}

describe('IncidentsService', () => {
  describe('create', () => {
    it('creates an incident in Open status', async () => {
      const incidentModel = { create: vi.fn().mockResolvedValue(buildIncident()) };
      const eventsService = { findById: vi.fn().mockResolvedValue({}) };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      await service.create(
        EVENT_ID,
        { title: 'Generator outage', severity: IncidentSeverity.CRITICAL },
        buildActor({ role: Role.EVENT_MANAGER }),
      );

      expect(incidentModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: IncidentStatus.OPEN, severity: IncidentSeverity.CRITICAL }),
      );
    });

    it('rejects assigning to a user who is not an Operations Member', async () => {
      const incidentModel = { create: vi.fn() };
      const eventsService = { findById: vi.fn().mockResolvedValue({}) };
      const usersService = buildUsersService(Role.VIEWER);
      const service = new IncidentsService(incidentModel as any, eventsService as any, usersService as any);

      await expect(
        service.create(
          EVENT_ID,
          { title: 'Bad assignee', severity: IncidentSeverity.LOW, assignee: ASSIGNEE_ID },
          buildActor({ role: Role.EVENT_MANAGER }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(incidentModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus - authorization', () => {
    it('allows the assigned Operations Member to update status', async () => {
      const incident = buildIncident();
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      const result = await service.updateStatus('incident-id', IncidentStatus.INVESTIGATING, buildActor());

      expect(result.status).toBe(IncidentStatus.INVESTIGATING);
    });

    it('denies an Operations Member who is not the assignee', async () => {
      const incident = buildIncident();
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      await expect(
        service.updateStatus(
          'incident-id',
          IncidentStatus.INVESTIGATING,
          buildActor({ userId: OTHER_OPS_ID }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an Admin to update status regardless of assignment', async () => {
      const incident = buildIncident();
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      const result = await service.updateStatus(
        'incident-id',
        IncidentStatus.INVESTIGATING,
        buildActor({ userId: OTHER_OPS_ID, role: Role.ADMIN }),
      );

      expect(result.status).toBe(IncidentStatus.INVESTIGATING);
    });

    it('rejects an invalid status transition', async () => {
      const incident = buildIncident({ status: IncidentStatus.OPEN });
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      await expect(
        service.updateStatus('incident-id', IncidentStatus.RESOLVED, buildActor()),
      ).rejects.toThrow(BadRequestException);
    });

    it('stamps resolvedAt when moving to Resolved', async () => {
      const incident = buildIncident({ status: IncidentStatus.MITIGATED });
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      const result = await service.updateStatus('incident-id', IncidentStatus.RESOLVED, buildActor());

      expect(result.resolvedAt).toBeInstanceOf(Date);
    });

    it('clears resolvedAt when reopening from Mitigated to Investigating', async () => {
      const incident = buildIncident({ status: IncidentStatus.MITIGATED, resolvedAt: new Date() });
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      const result = await service.updateStatus('incident-id', IncidentStatus.INVESTIGATING, buildActor());

      expect(result.resolvedAt).toBeNull();
    });
  });

  describe('update - authorization', () => {
    it('denies a non-assignee Operations Member from editing incident details', async () => {
      const incident = buildIncident();
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      await expect(
        service.update(
          'incident-id',
          { title: 'Hijacked' },
          buildActor({ userId: OTHER_OPS_ID }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an Event Manager to edit incident details', async () => {
      const incident = buildIncident();
      const incidentModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(incident) }) };
      const eventsService = { findById: vi.fn() };
      const service = new IncidentsService(
        incidentModel as any,
        eventsService as any,
        buildUsersService() as any,
      );

      const result = await service.update(
        'incident-id',
        { title: 'Updated title' },
        buildActor({ role: Role.EVENT_MANAGER }),
      );

      expect(result.title).toBe('Updated title');
    });
  });
});
