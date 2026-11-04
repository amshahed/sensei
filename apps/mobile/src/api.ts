import type {
  AssessmentResultDto,
  AssessmentStartDto,
  AssessmentSubmitRequest,
  CheckResultDto,
  CurriculumDto,
  CurriculumNextDto,
  DailyTargetMinutes,
  DueReviewItemDto,
  HealthResponse,
  LessonCompletionDto,
  LessonDetailDto,
  IntakeRequest,
  MeDto,
  OnboardingDto,
  PlacementAnswerDto,
  PlacementAnswerRequest,
  PlacementResultDto,
  PlacementStartDto,
  PracticeAnswerRequest,
  PracticeResultDto,
  PracticeScopesDto,
  PracticeSessionDto,
  PracticeStartRequest,
  ProgressDto,
  RelocateRequest,
  ReminderSettingsRequest,
  RemindersDto,
  ReviewResultDto,
  StreakDto,
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

/**
 * Called after any successful write outside `/reminders` — learning activity
 * that may have finished the day — so the reminders layer can re-sync
 * (K.3.g). Kept as a hook so this module doesn't depend on notifications.
 */
let activityListener: (() => void) | null = null;

export function setActivityListener(listener: (() => void) | null): void {
  activityListener = listener;
}

/** A non-2xx response; `status` lets screens tell a retryable failure from a permanent one. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** True for a 4xx: retrying the same request won't help. */
export function isPermanent(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
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
      throw new ApiError(
        `${init?.method ?? 'GET'} ${path} → ${res.status}`,
        res.status,
      );
    }
    const body = (await res.json()) as T;
    if ((init?.method ?? 'GET') !== 'GET' && !path.startsWith('/reminders')) {
      activityListener?.();
    }
    return body;
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

  /** What Practice can drill: learned items per module / chapter / type (J.1). */
  practiceScopes(): Promise<PracticeScopesDto> {
    return request<PracticeScopesDto>('/practice/scopes');
  },

  /** Start a drill over a scope, weakest first; sessionId null = nothing learned there. */
  startPractice(body: PracticeStartRequest): Promise<PracticeSessionDto> {
    return request<PracticeSessionDto>('/practice/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Answer one drill item; only the session's first answer per item counts (J.1.c). */
  answerPractice(
    sessionId: string,
    itemId: string,
    answer: string,
  ): Promise<PracticeResultDto> {
    const body: PracticeAnswerRequest = { itemId, answer };
    return request<PracticeResultDto>(
      `/practice/sessions/${encodeURIComponent(sessionId)}/answer`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  /** What onboarding still owes: the signup survey, then placement (I.3). */
  onboarding(): Promise<OnboardingDto> {
    return request<OnboardingDto>('/onboarding');
  },

  /** Submit the 3-question signup survey (once). */
  submitIntake(body: IntakeRequest): Promise<OnboardingDto> {
    return request<OnboardingDto>('/onboarding/intake', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** Start or resume the placement quiz (I.4.f). */
  startPlacement(): Promise<PlacementStartDto> {
    return request<PlacementStartDto>('/placement', { method: 'POST' });
  },

  /** Answer the next placement question; `choices: null` = "I don't know". */
  answerPlacement(
    attemptId: string,
    itemId: string,
    choices: string[] | null,
  ): Promise<PlacementAnswerDto> {
    const body: PlacementAnswerRequest = { itemId, choices };
    return request<PlacementAnswerDto>(
      `/placement/${encodeURIComponent(attemptId)}/answer`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  /** "Skip — start from the beginning" (before the first answer). */
  skipPlacement(): Promise<PlacementResultDto> {
    return request<PlacementResultDto>('/placement/skip', { method: 'POST' });
  },

  /** Learning streak + today's progress (K.2). Sends the device timezone. */
  streak(): Promise<StreakDto> {
    return request<StreakDto>(
      `/streak?tz=${encodeURIComponent(deviceTimeZone())}`,
    );
  },

  /** Change the daily target — an accepted suggestion or a manual edit (K.3.c). */
  setDailyTarget(minutes: DailyTargetMinutes): Promise<StreakDto> {
    return request<StreakDto>(
      `/streak/target?tz=${encodeURIComponent(deviceTimeZone())}`,
      { method: 'PUT', body: JSON.stringify({ minutes }) },
    );
  },

  /** "Not now" on a target suggestion. */
  dismissTargetSuggestion(): Promise<StreakDto> {
    return request<StreakDto>(
      `/streak/suggestion/dismiss?tz=${encodeURIComponent(deviceTimeZone())}`,
      { method: 'POST' },
    );
  },

  /** Reminder settings, the one-time offer, and the plan to schedule (K.3.g). */
  reminders(): Promise<RemindersDto> {
    return request<RemindersDto>(
      `/reminders?tz=${encodeURIComponent(deviceTimeZone())}`,
    );
  },

  /** Change any reminder settings (also answers the offer). */
  updateReminders(body: ReminderSettingsRequest): Promise<RemindersDto> {
    return request<RemindersDto>(
      `/reminders?tz=${encodeURIComponent(deviceTimeZone())}`,
      { method: 'PUT', body: JSON.stringify(body) },
    );
  },

  /** "Not now" on the reminders offer. */
  dismissRemindersOffer(): Promise<RemindersDto> {
    return request<RemindersDto>(
      `/reminders/offer/dismiss?tz=${encodeURIComponent(deviceTimeZone())}`,
      { method: 'POST' },
    );
  },
};

/** The device's IANA timezone: the learner's day boundary (K.3.f). */
function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
