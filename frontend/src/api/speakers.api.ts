import { apiClient } from './client';
import type { CreateSpeakerPayload, Speaker, UpdateSpeakerPayload } from '../types/speaker';
import type { PaginatedResponse } from '../types/event';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const speakersApi = {
  list: async (params: { page?: number; limit?: number }): Promise<PaginatedResponse<Speaker>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<Speaker>>>('/speakers', {
      params,
    });
    return data.data;
  },

  getById: async (id: string): Promise<Speaker> => {
    const { data } = await apiClient.get<ApiEnvelope<Speaker>>(`/speakers/${id}`);
    return data.data;
  },

  create: async (payload: CreateSpeakerPayload): Promise<Speaker> => {
    const { data } = await apiClient.post<ApiEnvelope<Speaker>>('/speakers', payload);
    return data.data;
  },

  update: async (id: string, payload: UpdateSpeakerPayload): Promise<Speaker> => {
    const { data } = await apiClient.patch<ApiEnvelope<Speaker>>(`/speakers/${id}`, payload);
    return data.data;
  },
};
