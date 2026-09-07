import { apiClient } from './client';
import type { CreateSessionPayload, SessionItem, SessionStatus, UpdateSessionPayload } from '../types/session';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const sessionsApi = {
  listByEvent: async (eventId: string): Promise<SessionItem[]> => {
    const { data } = await apiClient.get<ApiEnvelope<SessionItem[]>>(
      `/events/${eventId}/sessions`,
    );
    return data.data;
  },

  getById: async (id: string): Promise<SessionItem> => {
    const { data } = await apiClient.get<ApiEnvelope<SessionItem>>(`/sessions/${id}`);
    return data.data;
  },

  create: async (eventId: string, payload: CreateSessionPayload): Promise<SessionItem> => {
    const { data } = await apiClient.post<ApiEnvelope<SessionItem>>(
      `/events/${eventId}/sessions`,
      payload,
    );
    return data.data;
  },

  update: async (id: string, payload: UpdateSessionPayload): Promise<SessionItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<SessionItem>>(`/sessions/${id}`, payload);
    return data.data;
  },

  updateStatus: async (id: string, status: SessionStatus): Promise<SessionItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<SessionItem>>(`/sessions/${id}/status`, {
      status,
    });
    return data.data;
  },
};
