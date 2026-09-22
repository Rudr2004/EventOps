import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { usersApi } from '../../../api/users.api';
import { Table, type TableColumn } from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { Pagination } from '../../../components/ui/pagination';
import { LoadingState, ErrorState, EmptyState } from '../../../components/ui/states';
import { Alert } from '../../../components/layout/alert';
import { extractErrorMessage } from '../../../lib/extract-error-message';
import { Role, type User } from '../../../types/auth';

const ROLE_OPTIONS = Object.values(Role);
const ROLE_LABELS: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.EVENT_MANAGER]: 'Event Manager',
  [Role.OPERATIONS_MEMBER]: 'Operations Member',
  [Role.VIEWER]: 'Viewer',
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users', { page, limit, roleFilter }],
    queryFn: () => usersApi.list({ page, limit, role: roleFilter || undefined }),
    placeholderData: (previous) => previous,
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { id: string; role: Role }) => usersApi.updateRole(vars.id, vars.role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const statusMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      usersApi.updateStatus(vars.id, vars.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const activeError = roleMutation.error ?? statusMutation.error;

  const columns: TableColumn<User>[] = [
    { key: 'name', header: 'Name', render: (u) => u.name },
    { key: 'email', header: 'Email', render: (u) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <select
          value={u.role}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => roleMutation.mutate({ id: u.id, role: e.target.value as Role })}
          disabled={roleMutation.isPending}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (u) => (
        <button
          type="button"
          className="btn-secondary"
          onClick={(e) => {
            e.stopPropagation();
            statusMutation.mutate({ id: u.id, isActive: !u.isActive });
          }}
          disabled={statusMutation.isPending}
        >
          {u.isActive ? 'Deactivate' : 'Activate'}
        </button>
      ),
    },
  ];

  return (
    <motion.div
      className="users-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="page-header">
        <h1>Users</h1>
      </div>

      <div className="filters-bar">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as Role | '')}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </div>

      {activeError && <Alert message={extractErrorMessage(activeError)} />}

      {isLoading && <LoadingState label="Loading users…" />}
      {isError && <ErrorState message="Could not load users." />}
      {!isLoading && !isError && data?.items.length === 0 && (
        <EmptyState message="No users match your filters." />
      )}
      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <Table columns={columns} rows={data.items} getRowKey={(u) => u.id} />
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </motion.div>
  );
}
