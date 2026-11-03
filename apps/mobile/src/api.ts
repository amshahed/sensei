import type {
  AssessmentResultDto,
  AssessmentStartDto,
  AssessmentSubmitRequest,
  CheckResultDto,
  CurriculumDto,
  CurriculumNextDto,
  DueReviewItemDto,
  HealthResponse,
  LessonCompletionDto,
  LessonDetailDto,
  MeDto,
  ProgressDto,
  RelocateRequest,
  ReviewResultDto,
} from '@sensei/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/** A hung server should surface as an error, not an indefinite spinner. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Supplies the current Clerk session token for the `Authorization` header.
 * Registered by the auth layer once Clerk is initialised (see AuthGate); left
 * null in dev-stub mode, where the backend bypasses auth. Kept here rather than
 * passed per-call so screens don't each have to thread the token through.
 */
let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(
  provider: (() => Promise<string | null>) | null,
): void {
  authTokenProvider = provider;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const token = authTokenProvider ? await authTokenProvider() : null;
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
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

  /** The authenticated user; materialises the `users` row on first sign-in. */
  me(): Promise<MeDto> {
    return request<MeDto>('/me');
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

  /** Curriculum Outline (I.4.e): Module → Chapter → Lesson with states. */
  curriculum(): Promise<CurriculumDto> {
    return request<CurriculumDto>('/curriculum');
  },

  /** Just what Home's "Continue" should open. */
  curriculumNext(): Promise<CurriculumNextDto> {
    return request<CurriculumNextDto>('/curriculum/next');
  },

  /**
   * "Relocate position here": a skipped chapter to go back to, or null to
   * return to the furthest point. Returns the updated outline.
   */
  relocate(chapterId: string | null): Promise<CurriculumDto> {
    const body: RelocateRequest = { chapterId };
    return request<CurriculumDto>('/curriculum/relocate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Start a chapter Assessment — skip-test or exit (I.4.d.a). */
  startAssessment(chapterId: string): Promise<AssessmentStartDto> {
    return request<AssessmentStartDto>(
      `/chapters/${encodeURIComponent(chapterId)}/assessment`,
      { method: 'POST' },
    );
  },

  /** Submit every answer once; returns the score and corrections. */
  submitAssessment(
    attemptId: string,
    answers: AssessmentSubmitRequest['answers'],
  ): Promise<AssessmentResultDto> {
    const body: AssessmentSubmitRequest = { answers };
    return request<AssessmentResultDto>(
      `/assessments/${encodeURIComponent(attemptId)}/submit`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },
};
