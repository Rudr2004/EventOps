import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import { TaskPriority, TaskStatus } from './task-enums.js';
import { EventStatus } from '../events/event-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const EVENT_ID = new Types.ObjectId().toString();
const ASSIGNEE_ID = new Types.ObjectId().toString();
const OTHER_OPS_ID = new Types.ObjectId().toString();

function buildTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    event: new Types.ObjectId(EVENT_ID),
    session: null,
    title: 'Confirm catering',
    description: '',
    assignee: new Types.ObjectId(ASSIGNEE_ID),
    priority: TaskPriority.P2,
    status: TaskStatus.TODO,
    dueDate: null,
    comments: [],
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

describe('TasksService', () => {
  describe('create', () => {
    it('rejects creating a task on a Completed event', async () => {
      const taskModel = { create: vi.fn() };
      const eventsService = { findById: vi.fn().mockResolvedValue({ status: EventStatus.COMPLETED }) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.create(EVENT_ID, { title: 'Late task' }, buildActor({ role: Role.EVENT_MANAGER })),
      ).rejects.toThrow(BadRequestException);
      expect(taskModel.create).not.toHaveBeenCalled();
    });

    it('rejects creating a task on an Archived event', async () => {
      const taskModel = { create: vi.fn() };
      const eventsService = { findById: vi.fn().mockResolvedValue({ status: EventStatus.ARCHIVED }) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.create(EVENT_ID, { title: 'Late task' }, buildActor({ role: Role.EVENT_MANAGER })),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a task on a Live event', async () => {
      const taskModel = { create: vi.fn().mockResolvedValue(buildTask()) };
      const eventsService = { findById: vi.fn().mockResolvedValue({ status: EventStatus.LIVE }) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await service.create(EVENT_ID, { title: 'Setup AV' }, buildActor({ role: Role.EVENT_MANAGER }));

      expect(taskModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: TaskStatus.TODO }),
      );
    });

    it('rejects assigning a task to a user who is not an Operations Member', async () => {
      const taskModel = { create: vi.fn() };
      const eventsService = { findById: vi.fn().mockResolvedValue({ status: EventStatus.LIVE }) };
      const usersService = buildUsersService(Role.VIEWER);
      const service = new TasksService(taskModel as any, eventsService as any, usersService as any);

      await expect(
        service.create(
          EVENT_ID,
          { title: 'Setup AV', assignee: ASSIGNEE_ID },
          buildActor({ role: Role.EVENT_MANAGER }),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(taskModel.create).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus - authorization', () => {
    it('allows the assigned Operations Member to update status', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.updateStatus(
        'task-id',
        TaskStatus.IN_PROGRESS,
        buildActor(),
      );

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('denies an Operations Member who is not the assignee', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.updateStatus(
          'task-id',
          TaskStatus.IN_PROGRESS,
          buildActor({ userId: OTHER_OPS_ID }),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an Admin to update status regardless of assignment', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.updateStatus(
        'task-id',
        TaskStatus.IN_PROGRESS,
        buildActor({ userId: OTHER_OPS_ID, role: Role.ADMIN }),
      );

      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('rejects an invalid status transition', async () => {
      const task = buildTask({ status: TaskStatus.TODO });
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(service.updateStatus('task-id', TaskStatus.DONE, buildActor())).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update - authorization', () => {
    it('denies an Operations Member from editing task details', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.update('task-id', { title: 'Hijacked title' }, buildActor()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an Event Manager to edit task details', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.update(
        'task-id',
        { title: 'Updated title' },
        buildActor({ role: Role.EVENT_MANAGER }),
      );

      expect(result.title).toBe('Updated title');
    });
  });

  describe('addComment - authorization', () => {
    it('allows the assignee to comment', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.addComment('task-id', 'Working on it', buildActor());

      expect(result.comments).toHaveLength(1);
    });

    it('denies a non-assignee Operations Member from commenting', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findById: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.addComment('task-id', 'Not mine', buildActor({ userId: OTHER_OPS_ID })),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
