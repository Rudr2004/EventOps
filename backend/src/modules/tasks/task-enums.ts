export enum TaskPriority {
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  REVIEW = 'review',
  DONE = 'done',
}

export const ALLOWED_TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.REVIEW, TaskStatus.TODO],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [],
};

export function isValidTaskTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TASK_TRANSITIONS[from]?.includes(to) ?? false;
}
