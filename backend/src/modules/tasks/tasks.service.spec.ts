import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import { TaskPriority, TaskStatus } from './task-enums.js';
import { EventStatus } from '../events/event-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';

const EVENT_ID = new Types.ObjectId().toString();
const OTHER_EVENT_ID = new Types.ObjectId().toString();
const ASSIGNEE_ID = new Types.ObjectId().toString();
const OTHER_OPS_ID = new Types.ObjectId().toString();
const MANAGER_ID = new Types.ObjectId().toString();

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

function buildTaskModelForFindAll(items: unknown[]) {
  const query = {
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(items),
  };
  return {
    find: vi.fn().mockReturnValue(query),
    countDocuments: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(items.length) }),
  };
}

function buildPaginationQuery(overrides: Partial<Record<string, unknown>> = {}) {
  return { page: 1, limit: 20, skip: 0, ...overrides } as any;
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

  describe('findAll (row-level scoping)', () => {
    it('does not restrict the filter for an Admin', async () => {
      const taskModel = buildTaskModelForFindAll([buildTask()]);
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.ADMIN }));

      expect(taskModel.find).toHaveBeenCalledWith({});
      expect(eventsService.findOwnedEventIds).not.toHaveBeenCalled();
    });

    it('scopes to owned events for an Event Manager', async () => {
      const taskModel = buildTaskModelForFindAll([buildTask()]);
      const ownedIds = [new Types.ObjectId(EVENT_ID)];
      const eventsService = { findOwnedEventIds: vi.fn().mockResolvedValue(ownedIds) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.EVENT_MANAGER, userId: MANAGER_ID }));

      expect(eventsService.findOwnedEventIds).toHaveBeenCalledWith(MANAGER_ID);
      expect(taskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ event: { $in: ownedIds } }),
      );
    });

    it('scopes to the actor as assignee for an Operations Member', async () => {
      const taskModel = buildTaskModelForFindAll([buildTask()]);
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);
      const actor = buildActor({ role: Role.OPERATIONS_MEMBER, userId: ASSIGNEE_ID });

      await service.findAll(buildPaginationQuery(), actor);

      expect(taskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: new Types.ObjectId(ASSIGNEE_ID) }),
      );
    });

    it('overrides a mismatched explicit assignee query param for an Operations Member', async () => {
      const taskModel = buildTaskModelForFindAll([buildTask()]);
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);
      const actor = buildActor({ role: Role.OPERATIONS_MEMBER, userId: ASSIGNEE_ID });

      await service.findAll(buildPaginationQuery({ assignee: OTHER_OPS_ID }), actor);

      expect(taskModel.find).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: new Types.ObjectId(ASSIGNEE_ID) }),
      );
    });

    it('does not restrict the filter for a Viewer', async () => {
      const taskModel = buildTaskModelForFindAll([buildTask()]);
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await service.findAll(buildPaginationQuery(), buildActor({ role: Role.VIEWER }));

      expect(taskModel.find).toHaveBeenCalledWith({});
    });
  });

  describe('findByIdScoped', () => {
    it('allows an Admin to fetch any task', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.findByIdScoped('task-id', buildActor({ role: Role.ADMIN }));

      expect(result).toBe(task);
    });

    it('allows the assigned Operations Member to fetch the task', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.findByIdScoped('task-id', buildActor());

      expect(result).toBe(task);
    });

    it('hides a task from an Operations Member who is not the assignee (404)', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findOwnedEventIds: vi.fn() };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.findByIdScoped('task-id', buildActor({ userId: OTHER_OPS_ID })),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an Event Manager to fetch a task on an event they own', async () => {
      const task = buildTask();
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findOwnedEventIds: vi.fn().mockResolvedValue([new Types.ObjectId(EVENT_ID)]) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      const result = await service.findByIdScoped(
        'task-id',
        buildActor({ role: Role.EVENT_MANAGER, userId: MANAGER_ID }),
      );

      expect(result).toBe(task);
    });

    it('hides a task from an Event Manager who does not own the event (404)', async () => {
      const task = buildTask({ event: new Types.ObjectId(OTHER_EVENT_ID) });
      const taskModel = { findById: vi.fn().mockReturnValue({ exec: () => Promise.resolve(task) }) };
      const eventsService = { findOwnedEventIds: vi.fn().mockResolvedValue([new Types.ObjectId(EVENT_ID)]) };
      const service = new TasksService(taskModel as any, eventsService as any, buildUsersService() as any);

      await expect(
        service.findByIdScoped('task-id', buildActor({ role: Role.EVENT_MANAGER, userId: MANAGER_ID })),
      ).rejects.toThrow(NotFoundException);
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
