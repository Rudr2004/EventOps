import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api';
import { useAuth } from '../../features/auth/auth-context';

/**
 * Resolves a user id to a display name. Admin can always list every user,
 * so this simply fetches the full directory once and caches it — unlike the
 * User-facing app, there's no role restriction to work around here.
 */
export function useUserDisplayName() {
  const { user } = useAuth();

  const usersQuery = useQuery({
    queryKey: ['users', 'all-for-display'],
    queryFn: () => usersApi.list({ page: 1, limit: 200 }),
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
