export const TaskPriority = {
  P1: 'p1',
  P2: 'p2',
  P3: 'p3',
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.P1]: 'P1',
  [TaskPriority.P2]: 'P2',
  [TaskPriority.P3]: 'P3',
};

export const TaskStatus = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  REVIEW: 'review',
  DONE: 'done',
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: 'Todo',
  [TaskStatus.IN_PROGRESS]: 'In Progress',
  [TaskStatus.BLOCKED]: 'Blocked',
  [TaskStatus.REVIEW]: 'Review',
  [TaskStatus.DONE]: 'Done',
};

export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.BLOCKED, TaskStatus.REVIEW, TaskStatus.TODO],
  [TaskStatus.BLOCKED]: [TaskStatus.IN_PROGRESS],
  [TaskStatus.REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS],
  [TaskStatus.DONE]: [],
};

export const TASK_BOARD_COLUMNS: TaskStatus[] = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
  TaskStatus.REVIEW,
  TaskStatus.DONE,
];

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface TaskActivityEntry {
  actor: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  event: string;
  session: string | null;
  title: string;
  description: string;
  assignee: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  isOverdue: boolean;
  comments: TaskComment[];
  activity: TaskActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  session?: string;
  assignee?: string;
  priority?: TaskPriority;
  dueDate?: string;
}

export type UpdateTaskPayload = Partial<CreateTaskPayload>;

export interface TasksQueryParams {
  page?: number;
  limit?: number;
  event?: string;
  assignee?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDateFrom?: string;
  dueDateTo?: string;
  overdue?: 'true' | 'false';
}
