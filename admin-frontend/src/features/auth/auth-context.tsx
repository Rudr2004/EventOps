import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { tokenStorage } from '../../lib/token-storage';
import { extractErrorMessage } from '../../lib/extract-error-message';
import { Role, type LoginPayload, type User } from '../../types/auth';

interface AuthContextValue {
  user: User | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
  isLoginPending: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ME_QUERY_KEY = ['auth', 'me'] as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const hasTokens = Boolean(tokenStorage.getAccessToken());

  const meQuery = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    enabled: hasTokens,
    retry: false,
  });

  // Defense in depth: even if a non-Admin somehow authenticates against this
  // panel, the derived `user`/`isAuthenticated` below already treat them as
  // logged out — this effect also clears the stored tokens so a stale
  // non-Admin session isn't silently retried on every reload. The real
  // boundary is the API's RolesGuard; this only prevents ever rendering
  // Admin screens to a non-Admin session.
  useEffect(() => {
    if (meQuery.data && meQuery.data.role !== Role.ADMIN) {
      tokenStorage.clear();
      queryClient.setQueryData(ME_QUERY_KEY, undefined);
    }
  }, [meQuery.data, queryClient]);

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const result = await authApi.login(payload);
      if (result.user.role !== Role.ADMIN) {
        throw new Error('This login is for Admin accounts only.');
      }
      return result;
    },
    onSuccess: (result) => {
      tokenStorage.setTokens(result.accessToken, result.refreshToken);
      queryClient.setQueryData(ME_QUERY_KEY, result.user);
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data?.role === Role.ADMIN ? meQuery.data : undefined,
      isLoading: hasTokens && meQuery.isLoading,
      isAuthenticated: meQuery.data?.role === Role.ADMIN,
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          tokenStorage.clear();
          queryClient.setQueryData(ME_QUERY_KEY, undefined);
          queryClient.clear();
        }
      },
      loginError: loginMutation.error ? extractErrorMessage(loginMutation.error) : null,
      isLoginPending: loginMutation.isPending,
    }),
    [meQuery.data, meQuery.isLoading, hasTokens, loginMutation, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
