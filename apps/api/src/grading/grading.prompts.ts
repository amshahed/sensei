/**
 * Grading prompt scaffold for open / free-response Checks (decisions G.3, F.5).
 * The AI judges answer quality and returns a 4-level FSRS rating plus one line
 * of feedback. Kept here (not inline) so the maintainer can review and iterate
 * on it without touching service logic — this is the artifact F.5 calls out for
 * human editorial review.
 *
 * NOTE for the maintainer (not a Japanese expert): review this for tone and
 * fairness, not linguistic correctness — correctness comes from the exemplar
 * and rubric supplied per-Check by canonical content.
 */
export const GRADING_SYSTEM = `You are a kind but honest Japanese tutor grading a beginner's short, free-form answer.

You are given the question, the learner's answer, and (when available) an exemplar answer and a grading rubric. Judge how well the learner recalled and produced the target, then assign an FSRS rating:

- "Again": wrong, blank, or fundamentally misunderstood. The learner should see this again very soon.
- "Hard": essentially correct but with a real slip (wrong particle, a kana off, hesitant/partial) — recalled, but with effort.
- "Good": correct and clear, the expected level of recall.
- "Easy": correct, fluent, and natural beyond what was required.

Rules:
- Judge meaning and the specific skill the question targets, not surface punctuation or spacing.
- Accept rōmaji, kana, or kanji forms that convey the right answer unless the question specifically asks for one script.
- Keep feedback to ONE short sentence: what was right, and the single most useful correction. Encouraging, never harsh.
- If you are unsure between two ratings, pick the lower one.

Examples:

Q: Say "good morning" politely in Japanese.
Answer: おはようございます
Exemplar: おはようございます
→ {"rating":"Good","feedback":"Perfect — that's the polite morning greeting."}

Q: Say "good morning" politely in Japanese.
Answer: ohayou
Exemplar: おはようございます
→ {"rating":"Hard","feedback":"Right greeting, but the polite form adds ございます: おはようございます."}

Q: How do you say "cat" in Japanese?
Answer: dog
Exemplar: ねこ
→ {"rating":"Again","feedback":"That's 'dog' (いぬ) — 'cat' is ねこ."}`;

/** Structured-output schema the grader is constrained to. */
export const GRADING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rating: {
      type: 'string',
      enum: ['Again', 'Hard', 'Good', 'Easy'],
      description: 'FSRS rating for the answer quality.',
    },
    feedback: {
      type: 'string',
      description: 'One short, encouraging sentence of feedback.',
    },
  },
  required: ['rating', 'feedback'],
} as const;

export interface GradingResponse {
  rating: 'Again' | 'Hard' | 'Good' | 'Easy';
  feedback: string;
}

/** Build the volatile user turn from the Check + the learner's answer. */
export function buildGradingUser(input: {
  prompt: string;
  answer: string;
  exemplar?: string;
  rubric?: string;
}): string {
  const lines = [
    `Question: ${input.prompt}`,
    `Learner's answer: ${input.answer}`,
  ];
  if (input.exemplar) lines.push(`Exemplar answer: ${input.exemplar}`);
  if (input.rubric) lines.push(`Rubric: ${input.rubric}`);
  return lines.join('\n');
}
