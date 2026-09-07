import { apiClient } from './client';
import type {
  CreateEventPayload,
  EventItem,
  EventsQueryParams,
  EventStatus,
  PaginatedResponse,
  UpdateEventPayload,
} from '../types/event';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export const eventsApi = {
  list: async (params: EventsQueryParams): Promise<PaginatedResponse<EventItem>> => {
    const { data } = await apiClient.get<ApiEnvelope<PaginatedResponse<EventItem>>>('/events', {
      params,
    });
    return data.data;
  },

  getById: async (id: string): Promise<EventItem> => {
    const { data } = await apiClient.get<ApiEnvelope<EventItem>>(`/events/${id}`);
    return data.data;
  },

  create: async (payload: CreateEventPayload): Promise<EventItem> => {
    const { data } = await apiClient.post<ApiEnvelope<EventItem>>('/events', payload);
    return data.data;
  },

  update: async (id: string, payload: UpdateEventPayload): Promise<EventItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<EventItem>>(`/events/${id}`, payload);
    return data.data;
  },

  updateStatus: async (id: string, status: EventStatus): Promise<EventItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<EventItem>>(`/events/${id}/status`, {
      status,
    });
    return data.data;
  },

  archive: async (id: string): Promise<EventItem> => {
    const { data } = await apiClient.patch<ApiEnvelope<EventItem>>(`/events/${id}/archive`);
    return data.data;
  },
};
