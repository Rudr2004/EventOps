import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../../api/users.api';
import { useAuth } from '../../auth/auth-context';
import { Role } from '../../../types/auth';

/**
 * Resolves a user id to a display name. GET /users is restricted to
 * Admin/Event Manager, so an Operations Member or Viewer can only ever
 * resolve their own id (via the authenticated session) — anyone else's
 * id falls back to a shortened id rather than an unauthorized lookup.
 */
export function useUserDisplayName() {
  const { user } = useAuth();
  const canLookup = user?.role === Role.ADMIN || user?.role === Role.EVENT_MANAGER;

  const usersQuery = useQuery({
    queryKey: ['users', 'all-for-display'],
    queryFn: () => usersApi.list({ page: 1, limit: 100 }),
    enabled: canLookup,
    staleTime: 60_000,
  });

  const nameById = new Map<string, string>();
  for (const u of usersQuery.data?.items ?? []) {
    nameById.set(u.id, u.name);
  }
  if (user) {
    nameById.set(user.id, `${user.name} (you)`);
  }

  return (userId: string | null): string => {
    if (!userId) return 'Unassigned';
    return nameById.get(userId) ?? `User ${userId.slice(-6)}`;
  };
}
