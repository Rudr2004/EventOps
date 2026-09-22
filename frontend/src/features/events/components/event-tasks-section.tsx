import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../../../api/tasks.api';
import { usersApi } from '../../../api/users.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { TaskCard } from '../../tasks/components/task-card';
import { TaskDetail } from '../../tasks/components/task-detail';
import { TaskForm } from '../../tasks/components/task-form';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { TASK_BOARD_COLUMNS, TASK_STATUS_LABELS, type TaskItem, type TaskStatus } from '../../../types/task';

interface EventTasksSectionProps {
  eventId: string;
}

export function EventTasksSection({ eventId }: EventTasksSectionProps) {
  const { user } = useAuth();
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const opsMembersQuery = useQuery({
    queryKey: ['users', { role: Role.OPERATIONS_MEMBER }],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: Role.OPERATIONS_MEMBER }),
    enabled: canManage,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'event-section', eventId, { assigneeFilter }],
    queryFn: () =>
      tasksApi.list({
        page: 1,
        limit: 100,
        event: eventId,
        assignee: assigneeFilter || undefined,
      }),
  });

  const tasks = tasksQuery.data?.items ?? [];
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const tasksByStatus = new Map<TaskStatus, TaskItem[]>();
  for (const column of TASK_BOARD_COLUMNS) {
    tasksByStatus.set(
      column,
      tasks.filter((t) => t.status === column),
    );
  }

  return (
    <section className="schedule-section">
      <div className="page-header">
        <h2>Tasks</h2>
        {canManage && (
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            New Task
          </button>
        )}
      </div>

      {canManage && (
        <div className="filters-bar">
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="">All assignees</option>
            {opsMembersQuery.data?.items.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {tasksQuery.isLoading && <LoadingState label="Loading tasks…" />}
      {tasksQuery.isError && <ErrorState message="Could not load tasks for this event." />}
      {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 && (
        <EmptyState message="No tasks yet for this event." />
      )}

      {!tasksQuery.isLoading && tasks.length > 0 && (
        <div className="task-board">
          {TASK_BOARD_COLUMNS.map((column) => (
            <div className="task-column" key={column}>
              <div className="task-column-header">
                <span>{TASK_STATUS_LABELS[column]}</span>
                <span className="task-column-count">{tasksByStatus.get(column)?.length ?? 0}</span>
              </div>
              <div className="task-column-body">
                {tasksByStatus.get(column)?.map((task, index) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={index}
                    onClick={() => setSelectedTaskId(task.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isCreateOpen} title="New Task" onClose={() => setIsCreateOpen(false)}>
        <TaskForm
          eventId={eventId}
          onSuccess={() => setIsCreateOpen(false)}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={selectedTaskId !== null}
        title={selectedTask?.title ?? ''}
        onClose={() => setSelectedTaskId(null)}
      >
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            canManage={canManage}
            canUpdateStatus={
              user?.role === Role.OPERATIONS_MEMBER && selectedTask.assignee === user.id
            }
          />
        )}
      </Modal>
    </section>
  );
}
