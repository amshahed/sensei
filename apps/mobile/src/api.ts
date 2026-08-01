import type {
  CheckResultDto,
  DueReviewItemDto,
  HealthResponse,
  LessonCompletionDto,
  LessonDetailDto,
  ProgressDto,
  ReviewResultDto,
} from '@sensei/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** A hung server should surface as an error, not an indefinite spinner. */
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  baseUrl: API_URL,

  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  getLesson(idOrSlug: string): Promise<LessonDetailDto> {
    return request<LessonDetailDto>(`/lessons/${encodeURIComponent(idOrSlug)}`);
  },

  gradeCheck(
    checkId: string,
    answer: string,
    guessed = false,
  ): Promise<CheckResultDto> {
    return request<CheckResultDto>(
      `/checks/${encodeURIComponent(checkId)}/answer`,
      { method: 'POST', body: JSON.stringify({ answer, guessed }) },
    );
  },

  completeLesson(idOrSlug: string): Promise<LessonCompletionDto> {
    return request<LessonCompletionDto>(
      `/lessons/${encodeURIComponent(idOrSlug)}/complete`,
      { method: 'POST' },
    );
  },

  dueReviews(): Promise<DueReviewItemDto[]> {
    return request<DueReviewItemDto[]>('/reviews/due');
  },

  gradeReview(itemId: string, answer: string): Promise<ReviewResultDto> {
    return request<ReviewResultDto>(
      `/reviews/${encodeURIComponent(itemId)}/answer`,
      { method: 'POST', body: JSON.stringify({ answer }) },
    );
  },

  progress(): Promise<ProgressDto> {
    return request<ProgressDto>('/progress');
  },
};
