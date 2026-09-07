import { apiClient } from './client';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const authApi = {
  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/register', payload);
    return data.data;
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const { data } = await apiClient.post<ApiEnvelope<AuthResponse>>('/auth/login', payload);
    return data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<ApiEnvelope<User>>('/auth/me');
    return data.data;
  },
};
