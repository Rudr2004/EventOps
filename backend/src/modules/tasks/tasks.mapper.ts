import type { TaskDocument } from './schemas/task.schema.js';
import { TaskStatus } from './task-enums.js';

export interface TaskCommentResponse {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
}

export interface TaskActivityResponse {
  actor: string;
  action: string;
  detail: string;
  createdAt: Date;
}

export interface TaskResponse {
  id: string;
  event: string;
  session: string | null;
  title: string;
  description: string;
  assignee: string | null;
  priority: string;
  status: string;
  dueDate: Date | null;
  isOverdue: boolean;
  comments: TaskCommentResponse[];
  activity: TaskActivityResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export function toTaskResponse(task: TaskDocument): TaskResponse {
  const isOverdue =
    task.status !== TaskStatus.DONE && Boolean(task.dueDate) && task.dueDate!.getTime() < Date.now();

  return {
    id: task._id.toString(),
    event: task.event.toString(),
    session: task.session ? task.session.toString() : null,
    title: task.title,
    description: task.description,
    assignee: task.assignee ? task.assignee.toString() : null,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    isOverdue,
    comments: task.comments.map((comment) => ({
      id: (comment as unknown as { _id: { toString(): string } })._id.toString(),
      author: comment.author.toString(),
      text: comment.text,
      createdAt: (comment as unknown as { createdAt: Date }).createdAt,
    })),
    activity: task.activity.map((entry) => ({
      actor: entry.actor.toString(),
      action: entry.action,
      detail: entry.detail,
      createdAt: (entry as unknown as { createdAt: Date }).createdAt,
    })),
    createdAt: (task as unknown as { createdAt: Date }).createdAt,
    updatedAt: (task as unknown as { updatedAt: Date }).updatedAt,
  };
}
