/**
 * Which checks are open (B.2.d): free writing that the AI grader judges against
 * a rubric and a model answer, rather than an exact match against a fixed
 * answer.
 *
 * A MULTIPLE_CHOICE check is always closed, even if its stored answer is
 * missing, so a content bug grades wrong rather than quietly routing to the
 * model. Any other format is open only when it has no fixed answer. Grading
 * (ChecksService) and the lesson payload (mapCheck) both ask here, so they can
 * never disagree about which checks are open.
 */
export function isOpenCheck(format: string, data: unknown): boolean {
  if (format === 'MULTIPLE_CHOICE') return false;
  const answer = (data as { answer?: unknown } | null | undefined)?.answer;
  return !(typeof answer === 'string' && answer.length > 0);
}
