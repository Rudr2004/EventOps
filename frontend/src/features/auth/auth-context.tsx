import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../api/auth.api';
import { tokenStorage } from '../../lib/token-storage';
import { extractErrorMessage } from '../../lib/extract-error-message';
import type { LoginPayload, RegisterPayload, User } from '../../types/auth';

interface AuthContextValue {
  user: User | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  loginError: string | null;
  registerError: string | null;
  isLoginPending: boolean;
  isRegisterPending: boolean;
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

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (result) => {
      tokenStorage.setTokens(result.accessToken, result.refreshToken);
      queryClient.setQueryData(ME_QUERY_KEY, result.user);
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (result) => {
      tokenStorage.setTokens(result.accessToken, result.refreshToken);
      queryClient.setQueryData(ME_QUERY_KEY, result.user);
    },
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data,
      isLoading: hasTokens && meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data),
      login: async (payload) => {
        await loginMutation.mutateAsync(payload);
      },
      register: async (payload) => {
        await registerMutation.mutateAsync(payload);
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
      registerError: registerMutation.error ? extractErrorMessage(registerMutation.error) : null,
      isLoginPending: loginMutation.isPending,
      isRegisterPending: registerMutation.isPending,
    }),
    [meQuery.data, meQuery.isLoading, hasTokens, loginMutation, registerMutation, queryClient],
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
