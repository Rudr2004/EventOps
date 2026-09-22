import { apiClient } from './client';
import type { EventItem } from '../types/event';
import type { ApprovalHistoryEntry } from '../types/approval';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const approvalsApi = {
  submit: async (eventId: string): Promise<EventItem> => {
    const { data } = await apiClient.post<ApiEnvelope<EventItem>>(`/events/${eventId}/submit`);
    return data.data;
  },

  approve: async (eventId: string, comment?: string): Promise<EventItem> => {
    const { data } = await apiClient.post<ApiEnvelope<EventItem>>(`/events/${eventId}/approve`, {
      comment,
    });
    return data.data;
  },

  reject: async (eventId: string, reason: string): Promise<EventItem> => {
    const { data } = await apiClient.post<ApiEnvelope<EventItem>>(`/events/${eventId}/reject`, {
      reason,
    });
    return data.data;
  },

  getHistory: async (eventId: string): Promise<ApprovalHistoryEntry[]> => {
    const { data } = await apiClient.get<ApiEnvelope<ApprovalHistoryEntry[]>>(
      `/events/${eventId}/approval-history`,
    );
    return data.data;
  },
};
