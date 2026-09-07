import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { tasksApi } from '../../../api/tasks.api';
import { usersApi } from '../../../api/users.api';
import { eventsApi } from '../../../api/events.api';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Modal } from '../../../components/ui/modal';
import { TaskCard } from '../components/task-card';
import { TaskDetail } from '../components/task-detail';
import { TaskForm } from '../components/task-form';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';
import { TASK_BOARD_COLUMNS, TASK_STATUS_LABELS, TaskPriority, type TaskItem, type TaskStatus } from '../../../types/task';

export function TaskBoardPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [eventFilter, setEventFilter] = useState(searchParams.get('event') ?? '');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const canManage = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const eventsQuery = useQuery({
    queryKey: ['events', { page: 1, limit: 100 }],
    queryFn: () => eventsApi.list({ page: 1, limit: 100 }),
  });

  const opsMembersQuery = useQuery({
    queryKey: ['users', { role: Role.OPERATIONS_MEMBER }],
    queryFn: () => usersApi.list({ page: 1, limit: 100, role: Role.OPERATIONS_MEMBER }),
    enabled: canManage,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'board', { eventFilter, assigneeFilter, priorityFilter, overdueOnly }],
    queryFn: () =>
      tasksApi.list({
        page: 1,
        limit: 100,
        event: eventFilter || undefined,
        assignee: assigneeFilter || undefined,
        priority: priorityFilter || undefined,
        overdue: overdueOnly ? 'true' : undefined,
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
    <motion.div
      className="tasks-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Tasks</h1>
        {canManage && eventFilter && (
          <button type="button" onClick={() => setIsCreateOpen(true)}>
            New Task
          </button>
        )}
      </div>

      <div className="filters-bar">
        <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
          <option value="">All events</option>
          {eventsQuery.data?.items.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
        <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
          <option value="">All assignees</option>
          {opsMembersQuery.data?.items.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
        >
          <option value="">All priorities</option>
          {Object.values(TaskPriority).map((p) => (
            <option key={p} value={p}>
              {p.toUpperCase()}
            </option>
          ))}
        </select>
        <label className="overdue-toggle">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          Overdue only
        </label>
      </div>

      {!eventFilter && (
        <p className="task-board-hint">Select an event above to create new tasks for it.</p>
      )}

      {tasksQuery.isLoading && <LoadingState label="Loading tasks…" />}
      {tasksQuery.isError && <ErrorState message="Could not load tasks." />}
      {!tasksQuery.isLoading && !tasksQuery.isError && tasks.length === 0 && (
        <EmptyState message="No tasks match your filters." />
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
        {eventFilter && (
          <TaskForm
            eventId={eventFilter}
            onSuccess={() => setIsCreateOpen(false)}
            onCancel={() => setIsCreateOpen(false)}
          />
        )}
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
    </motion.div>
  );
}
