/** What a submitted test decides (I.4.d.b). */
export type AssessmentVerdict = 'PASSED' | 'FAILED' | 'UNDECIDED';

/**
 * The verdict on a test, given how its questions came out (I.4.d.b):
 *  - `right`: answers graded right;
 *  - `ungraded`: answers the grader couldn't judge (an outage), neither right
 *    nor wrong;
 *  - `asked`: questions whose item could still be asked at submit, so `right`
 *    and `ungraded` plus the answers graded wrong. At least 1.
 *
 * PASSED only if `right` alone meets the bar over every question asked, so an
 * ungraded answer never helps a pass. FAILED only if the bar is missed even
 * with every ungraded answer counted right, so an outage never fails anyone.
 * Otherwise the ungraded answers could still change the outcome: UNDECIDED.
 * With nothing ungraded this is the plain `right / asked >= threshold`.
 */
export function assessmentVerdict(
  {
    right,
    ungraded,
    asked,
  }: { right: number; ungraded: number; asked: number },
  threshold: number,
): AssessmentVerdict {
  if (asked < 1) {
    throw new RangeError(
      `A verdict needs at least one question (asked=${asked})`,
    );
  }
  const meets = (n: number) => n / asked >= threshold - 1e-9;
  if (meets(right)) return 'PASSED';
  if (!meets(right + ungraded)) return 'FAILED';
  return 'UNDECIDED';
}
