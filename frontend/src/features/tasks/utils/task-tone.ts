import { TaskPriority, TaskStatus } from '../../../types/task';

type BadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export function priorityTone(priority: TaskPriority): BadgeTone {
  switch (priority) {
    case TaskPriority.P1:
      return 'danger';
    case TaskPriority.P2:
      return 'warning';
    default:
      return 'neutral';
  }
}

export function taskStatusTone(status: TaskStatus): BadgeTone {
  switch (status) {
    case TaskStatus.DONE:
      return 'success';
    case TaskStatus.BLOCKED:
      return 'danger';
    case TaskStatus.REVIEW:
      return 'warning';
    case TaskStatus.IN_PROGRESS:
      return 'info';
    default:
      return 'neutral';
  }
}
