import { isValidTaskTransition, TaskStatus } from './task-enums.js';

describe('isValidTaskTransition', () => {
  it('allows the standard forward progression', () => {
    expect(isValidTaskTransition(TaskStatus.TODO, TaskStatus.IN_PROGRESS)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.REVIEW)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.REVIEW, TaskStatus.DONE)).toBe(true);
  });

  it('allows moving to Blocked from In Progress and back', () => {
    expect(isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED)).toBe(true);
    expect(isValidTaskTransition(TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS)).toBe(true);
  });

  it('allows sending a task back from Review to In Progress', () => {
    expect(isValidTaskTransition(TaskStatus.REVIEW, TaskStatus.IN_PROGRESS)).toBe(true);
  });

  it('allows an In Progress task to move back to Todo', () => {
    expect(isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.TODO)).toBe(true);
  });

  it('rejects skipping straight from Todo to Done', () => {
    expect(isValidTaskTransition(TaskStatus.TODO, TaskStatus.DONE)).toBe(false);
  });

  it('rejects skipping straight from Todo to Blocked or Review', () => {
    expect(isValidTaskTransition(TaskStatus.TODO, TaskStatus.BLOCKED)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.TODO, TaskStatus.REVIEW)).toBe(false);
  });

  it('treats Done as terminal', () => {
    expect(isValidTaskTransition(TaskStatus.DONE, TaskStatus.TODO)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.DONE, TaskStatus.IN_PROGRESS)).toBe(false);
  });

  it('rejects a no-op transition to the same status', () => {
    expect(isValidTaskTransition(TaskStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS)).toBe(false);
  });

  it('rejects Blocked jumping directly to Review or Done', () => {
    expect(isValidTaskTransition(TaskStatus.BLOCKED, TaskStatus.REVIEW)).toBe(false);
    expect(isValidTaskTransition(TaskStatus.BLOCKED, TaskStatus.DONE)).toBe(false);
  });
});
