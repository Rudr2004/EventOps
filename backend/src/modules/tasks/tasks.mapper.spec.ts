import { Types } from 'mongoose';
import { toTaskResponse } from './tasks.mapper.js';
import { TaskPriority, TaskStatus } from './task-enums.js';

function buildTaskDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    event: new Types.ObjectId(),
    session: null,
    title: 'Task',
    description: '',
    assignee: null,
    priority: TaskPriority.P2,
    status: TaskStatus.TODO,
    dueDate: null,
    comments: [],
    activity: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

describe('toTaskResponse - overdue detection', () => {
  it('marks a task overdue when the due date is in the past and status is not Done', () => {
    const task = buildTaskDoc({ dueDate: new Date(Date.now() - 86400000), status: TaskStatus.IN_PROGRESS });
    expect(toTaskResponse(task).isOverdue).toBe(true);
  });

  it('does not mark a task overdue when the due date is in the future', () => {
    const task = buildTaskDoc({ dueDate: new Date(Date.now() + 86400000), status: TaskStatus.IN_PROGRESS });
    expect(toTaskResponse(task).isOverdue).toBe(false);
  });

  it('does not mark a task overdue when it has no due date', () => {
    const task = buildTaskDoc({ dueDate: null });
    expect(toTaskResponse(task).isOverdue).toBe(false);
  });

  it('does not mark a Done task overdue even with a past due date', () => {
    const task = buildTaskDoc({ dueDate: new Date(Date.now() - 86400000), status: TaskStatus.DONE });
    expect(toTaskResponse(task).isOverdue).toBe(false);
  });
});
