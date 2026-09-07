import { apiClient } from './client';
import type { PaginatedResponse } from '../types/event';
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
};
