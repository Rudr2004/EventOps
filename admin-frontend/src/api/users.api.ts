import { apiClient } from './client';
import type { PaginatedResponse } from '../types/pagination';
import type { Role, User } from '../types/auth';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const usersApi = {
  list: async (params: { page?: number; limit?: number; role?: Role }): Promise<PaginatedResponse<User>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<User>>>('/users', {
      params,
    });
    return data.data;
  },

  updateRole: async (id: string, role: Role): Promise<User> => {
    const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${id}/role`, { role });
    return data.data;
  },

  updateStatus: async (id: string, isActive: boolean): Promise<User> => {
    const { data } = await apiClient.patch<ApiEnvelope<User>>(`/users/${id}/status`, { isActive });
    return data.data;
  },
};
