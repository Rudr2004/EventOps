import { apiClient } from './client';
import type {
  CreateTaskPayload,
  TaskItem,
  TaskStatus,
  TasksQueryParams,
  UpdateTaskPayload,
} from '../types/task';
import type { PaginatedResponse } from '../types/event';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const tasksApi = {
  list: async (params: TasksQueryParams): Promise<PaginatedResponse<TaskItem>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<TaskItem>>>('/tasks', {
      params,
    });
    return data.data;
  },

  getById: async (id: string): Promise<TaskItem> => {
    const { data } = await apiClient.get<ApiEnvelope<TaskItem>>(`/tasks/${id}`);
    return data.data;
  },

  create: async (eventId: string, payload: CreateTaskPayload): Promise<TaskItem> => {
    const { data } = await apiClient.post<ApiEnvelope<TaskItem>>(
      `/events/${eventId}/tasks`,
      payload,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateTaskPayload): Promise<TaskItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<TaskItem>>(`/tasks/${id}`, payload);
    return data.data;
  },

  updateStatus: async (id: string, status: TaskStatus): Promise<TaskItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<TaskItem>>(`/tasks/${id}/status`, {
      status,
    });
    return data.data;
  },

  addComment: async (id: string, text: string): Promise<TaskItem> => {
    const { data } = await apiClient.post<ApiEnvelope<TaskItem>>(`/tasks/${id}/comments`, {
      text,
    });
    return data.data;
  },
};
