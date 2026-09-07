import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasks.api';
import { usersApi } from '../../../api/users.api';
import { FormField } from '../../../components/layout/form-field';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { Role } from '../../../types/auth';
import { TaskPriority, TASK_PRIORITY_LABELS, type TaskItem } from '../../../types/task';

interface TaskFormProps {
  eventId: string;
  taskId?: string;
  initialValues?: Partial<TaskItem>;
  onSuccess: (task: TaskItem) => void;
  onCancel: () => void;
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 16);
}

export function TaskForm({ eventId, taskId, initialValues, onSuccess, onCancel }: TaskFormProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [assignee, setAssignee] = useState(initialValues?.assignee ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initialValues?.priority ?? TaskPriority.P3);
  const [dueDate, setDueDate] = useState(toDateTimeLocal(initialValues?.dueDate));

  const opsMembersQuery = useQuery({
    queryKey: ['users', { role: Role.OPERATIONS_MEMBER }],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: Role.OPERATIONS_MEMBER }),
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        title,
        description: description || undefined,
        assignee: assignee || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      };
      return taskId ? tasksApi.update(taskId, payload) : tasksApi.create(eventId, payload);
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onSuccess(task);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {mutation.isError && <Alert message={extractErrorMessage(mutation.error)} />}
      <FormField id="task-title" label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <div className="form-field">
        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label htmlFor="task-assignee">Assignee</label>
        <select id="task-assignee" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {opsMembersQuery.data?.items.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-field">
        <label htmlFor="task-priority">Priority</label>
        <select
          id="task-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          {Object.values(TaskPriority).map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <FormField
        id="task-due-date"
        label="Due date"
        type="datetime-local"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </button>
        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : taskId ? 'Save changes' : 'Create task'}
        </button>
      </div>
    </form>
  );
}
