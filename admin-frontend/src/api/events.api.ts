import { apiClient } from './client';
import type { EventItem, EventStatus } from '../types/event';
import type { PaginatedResponse } from '../types/pagination';

interface ApiEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
}

export interface EventsQueryParams {
  page?: number;
  limit?: number;
  status?: EventStatus;
  search?: string;
  owner?: string;
  startDateFrom?: string;
  startDateTo?: string;
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
};
