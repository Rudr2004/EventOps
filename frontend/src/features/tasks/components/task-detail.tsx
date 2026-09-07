import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasks.api';
import { Badge } from '../../../components/ui/badge';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { useUserDisplayName } from '../hooks/use-user-display-name';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_TRANSITIONS,
  type TaskItem,
  type TaskStatus,
} from '../../../types/task';
import { priorityTone, taskStatusTone } from '../utils/task-tone';

interface TaskDetailProps {
  task: TaskItem;
  canManage: boolean;
  canUpdateStatus: boolean;
}

export function TaskDetail({ task, canManage, canUpdateStatus }: TaskDetailProps) {
  const queryClient = useQueryClient();
  const getUserDisplayName = useUserDisplayName();
  const [commentText, setCommentText] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.updateStatus(task.id, status),
    onSuccess: invalidate,
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => tasksApi.addComment(task.id, text),
    onSuccess: () => {
      setCommentText('');
      invalidate();
    },
  });

  const handleCommentSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      commentMutation.mutate(commentText.trim());
    }
  };

  const availableTransitions = TASK_STATUS_TRANSITIONS[task.status];
  const canAct = canManage || canUpdateStatus;

  return (
    <div className="task-detail">
      <div className="task-detail-badges">
        <Badge tone={taskStatusTone(task.status)}>{TASK_STATUS_LABELS[task.status]}</Badge>
        <Badge tone={priorityTone(task.priority)}>{TASK_PRIORITY_LABELS[task.priority]}</Badge>
        {task.isOverdue && <Badge tone="danger">Overdue</Badge>}
      </div>

      {task.description && <p className="task-detail-description">{task.description}</p>}

      <dl className="task-detail-meta">
        {task.dueDate && (
          <>
            <dt>Due</dt>
            <dd>{new Date(task.dueDate).toLocaleString()}</dd>
          </>
        )}
        <dt>Assignee</dt>
        <dd>{getUserDisplayName(task.assignee)}</dd>
      </dl>

      {canAct && availableTransitions.length > 0 && (
        <div className="task-detail-actions">
          {availableTransitions.map((status) => (
            <button
              key={status}
              type="button"
              className="btn-secondary"
              onClick={() => statusMutation.mutate(status)}
              disabled={statusMutation.isPending}
            >
              Move to {TASK_STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}
      {statusMutation.isError && <Alert message={extractErrorMessage(statusMutation.error)} />}

      <div className="task-activity">
        <h3>Activity</h3>
        {task.activity.length === 0 ? (
          <p className="task-activity-empty">No activity yet.</p>
        ) : (
          <ul className="task-activity-list">
            {[...task.activity].reverse().map((entry, i) => (
              <li key={i}>
                <span className="task-activity-action">{entry.action.replace('_', ' ')}</span>
                {entry.detail && <span className="task-activity-detail"> · {entry.detail}</span>}
                <span className="task-activity-time">
                  {getUserDisplayName(entry.actor)} · {new Date(entry.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="task-comments">
        <h3>Comments</h3>
        {task.comments.length === 0 ? (
          <p className="task-activity-empty">No comments yet.</p>
        ) : (
          <ul className="task-comment-list">
            {task.comments.map((comment) => (
              <li key={comment.id}>
                <p>{comment.text}</p>
                <span className="task-activity-time">
                  {getUserDisplayName(comment.author)} · {new Date(comment.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canAct && (
          <form className="task-comment-form" onSubmit={handleCommentSubmit}>
            <textarea
              rows={2}
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button type="submit" disabled={commentMutation.isPending || !commentText.trim()}>
              {commentMutation.isPending ? 'Posting…' : 'Post comment'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
