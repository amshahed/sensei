import type {
  CheckResultDto,
  HealthResponse,
  LessonCompletionDto,
  LessonDetailDto,
} from '@sensei/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: API_URL,

  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  getLesson(idOrSlug: string): Promise<LessonDetailDto> {
    return request<LessonDetailDto>(`/lessons/${encodeURIComponent(idOrSlug)}`);
  },

  gradeCheck(checkId: string, answer: string): Promise<CheckResultDto> {
    return request<CheckResultDto>(
      `/checks/${encodeURIComponent(checkId)}/answer`,
      { method: 'POST', body: JSON.stringify({ answer }) },
    );
  },

  completeLesson(idOrSlug: string): Promise<LessonCompletionDto> {
    return request<LessonCompletionDto>(
      `/lessons/${encodeURIComponent(idOrSlug)}/complete`,
      { method: 'POST' },
    );
  },
};
