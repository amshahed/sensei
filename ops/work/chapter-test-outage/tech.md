# Tech plan: an outage never decides a chapter test

Unit `chapter-test-outage`. Written by the Tech Lead, 2026-11-28, against `brief.md` (P1 to P6), `decisions.md` I.4.d.b (amending I.4.d.a, with I.4.c, G.4.d and B.2.g), and the code at `main` `46cc506`. The technical decision is logged as I.4.d.c. One Developer pass, one PR, API only.

**PR #107 overlap: none.** The four files below are outside `gh pr diff 107 --name-only`. This plan doesn't touch `schema.prisma` or any migration, `packages/types`, `app.integration.spec.ts`, `auth/`, `onboarding/`, `users/` or `apps/mobile`. If #107 merges first, the only effect is on the Tester's setup: each fresh learner answers the 18+ question first (M.5.a).

---

# 0. What the code does today (verified)

- **One submit path for both kinds.** `AssessmentsService.submit()` (`assessments.service.ts` 182) grades every sampled item through `RecallGraderService.grade()` with `mapLimit`, for `SKIP` and `EXIT` alike.
- **Two kinds of `scored: false`, mixed together.**
  - *Ungraded:* a meaning answer that isn't a listed meaning, where the grader fell back and its exact match said no (`recall-grader.service.ts` 90, `fallbackMiss`). Kana, readings, blank answers and listed meanings always come back `scored: true`.
  - *Unaskable:* the item was deleted, or no longer yields a question (`assessments.service.ts` 222 to 232). It is returned with an empty prompt and `scored: false`.
- **The bug.** `total = scored.length` and `passed = correct / total >= 0.8` (237 to 246). The 80% is taken over whatever was graded. Only `total === 0` gives the 503.
- **Recording.** One transaction claims the attempt, writes the chapter mark and the partial-pass lesson skips (274 to 293). Then FSRS write-back for scored answers, then `seedUntested(…, attempt.itemIds, …)` on a pass (318 to 324), then the streak (327).
- **The P5 gap.** `seedUntested` (447) treats every sampled ID as tested. An ungraded answer is neither written nor seeded.
- **The app.** `AssessmentScreen.tsx` shows "Couldn't submit your answers", the raw status line, **Retry** (resends the same `answers`) and **Back**, for any submit error. A 503 and a 410 look the same there.
- **Nothing else reads `AssessmentAttempt`** (grep over `apps/api/src`). An attempt that stays `IN_PROGRESS` longer has no side effects.
- **The Gemini client doesn't retry.** A 429 is classified `rate_limited` and falls back at once (`gemini-llm-client.ts` 54). `GRADE_TIMEOUT_MS` is 12 s.

## Data, read-only (2026-11-28)

- **Throwaway branch** `br-winter-poetry-baq6sbs4`: chapter 4 (`cmwgrjfxf00029owlnmphx4oi`) and chapter 5 (`cmwgrjirp00029oy784mylhg5`) each have **25 VOCAB targets, all with meanings**. So a 20-question meaning test leaves 5 unsampled words, which P5's live comparison needs.
- **Default branch: not checked.** A read-only count of passed attempts holding `scored: false` answers was denied by the permission classifier. Section 3 explains why the plan doesn't depend on it.

## Spike (throwaway, scratchpad only)

- **A working grader can be faked for P3.** A `globalThis.fetch` preload that answers `generativelanguage.googleapis.com` with `{"candidates":[{"content":{"role":"model","parts":[{"text":"{\"rating\":\"Good\",\"feedback\":\"Fine.\"}"}]},"finishReason":"STOP","index":0}]}` (status 200, JSON) satisfies `@google/generative-ai`: `response.text()` returns the grade and `finishReason` is `STOP`.
- Script: `/tmp/claude-1000/-home-shahed-workspace-sensei/056c074b-2f0e-482e-8498-763615841331/scratchpad/cto-spike/fake-good.cjs`. Never committed.

---

# 1. Approach

## 1.1 The verdict as a pure function

New file `apps/api/src/assessments/assessment-verdict.ts`, next to `assessment-sample.ts` (the existing pattern for the engine's pure helpers).

```ts
export type AssessmentVerdict = 'PASSED' | 'FAILED' | 'UNDECIDED';

export function assessmentVerdict(
  counts: { right: number; ungraded: number; asked: number },
  threshold: number,
): AssessmentVerdict;
```

- `asked`: questions whose item could still be asked at submit (I.4.d.b point 5). Must be at least 1, otherwise it throws `RangeError`.
- `meets(n) = n / asked >= threshold - 1e-9`, the same tolerance as today.
- **PASSED** if `meets(right)` (I.4.d.b point 1).
- **FAILED** if not `meets(right + ungraded)` (point 2).
- **UNDECIDED** otherwise (point 3).
- `threshold` is a parameter, so the file doesn't import the service. The service passes `ASSESSMENT_PASS_THRESHOLD`.

**Why a pure function.** The rule is all boundary arithmetic. A pure function can be checked exhaustively for every test size up to 20 and every split, against the brief's definition. Mocked service tests can't do that.

## 1.2 `submit()` uses it (P1 to P4, P6)

- `GradedResult` gains an internal `asked: boolean`: `false` on the unaskable branch, `true` otherwise. The stored items are already mapped field by field and typed as the DTO, so it never reaches the wire or the JSON.
- After grading:
  - `asked = graded.filter((g) => g.asked)`.
  - **If `asked` is empty, throw `GoneException`** ("This test's questions have changed — start a new one."). Nothing is written. Starting again resamples: an empty `SKIP` is refused, and an empty `EXIT` auto-passes (I.4.d.a, already in `start()`). See 1.4.
  - `scored = asked.filter((g) => g.scored)`. `total` and `correct` are computed as today, so the shown score is unchanged.
  - `verdict = assessmentVerdict({ right: correct, ungraded: asked.length - total, asked: asked.length }, ASSESSMENT_PASS_THRESHOLD)`.
  - **If `UNDECIDED`:** log one line, `ASSESSMENT_UNDECIDED attempt=<id> kind=<kind> asked=<n> right=<n> ungraded=<n>`, with no learner answers. Then throw the existing `ServiceUnavailableException` with the existing message. This replaces the `total === 0` branch, which is a special case of it.
  - `passed = verdict === 'PASSED'`. Everything after this line is unchanged except the seed call (1.3).
- The throw comes before the claim transaction, FSRS and the streak. So an undecided submit writes nothing (P3). The attempt stays `IN_PROGRESS`, with `results` still null.
- **P4 follows from the arithmetic.** A pass means `right ≥ 0.8·asked ≥ 0.8·(asked − ungraded)`. A fail means `right + ungraded < 0.8·asked`, so `right < 0.8·(asked − ungraded)`, and `asked − ungraded` is at least 1. The shown score `correct / total` therefore always agrees with the verdict. The verdict spec checks this exhaustively.
- **P6 follows too.** With `ungraded = 0`, PASSED and FAILED are complements of `right / asked ≥ 0.8`. That is today's rule, because `total = asked` when nothing is ungraded.

## 1.3 Ungraded words are seeded on a pass (P5)

- Call `seedUntested(userId, chapterId, scored.map((g) => g.itemId), kind, now)`. Rename its parameter to `gradedItemIds`.
- An ungraded sampled item then goes through exactly the filter an unsampled one does:
  - chapter `TARGET`;
  - `EXIT`, or `mayInferMastery` (G.4.d: a skip-test never seeds kanji);
  - `recallQuestionFor` non-null;
  - `MasteryService.seedInferred` (Hard rating, the I.4.c inferred tier), which never touches an existing row.
- Still never recorded as a review: `writeBack` keeps receiving only scored answers.
- An unaskable item can't be seeded: it is gone from the chapter, or it fails the same `recallQuestionFor` filter at the same moment.

## 1.4 Technical forks decided (logged as I.4.d.c)

**A resubmit grades every answer again.** The brief leaves this to the Tech Lead (section 5).
- *Why:*
  - It is what the 503 path already does, so there is no new state, and an `IN_PROGRESS` row stays exactly as it is.
  - A result comes from one grading pass over the answers actually submitted.
  - It's the smallest design that delivers P3.
- *Cost, stated plainly:* each Retry sends every non-listed meaning answer to the grader again, not only the ungraded ones. On the free tier (15 requests a minute, no client retry), an immediate Retry can be rate-limited again and stay undecided. The learner then needs another Retry a minute later. The `ASSESSMENT_UNDECIDED` line makes that visible.
- *Rejected:* **keeping the verdicts already reached on the attempt** (in `results` while `IN_PROGRESS`) and grading only the rest. Retries would converge faster, but it means writing to an open attempt with a status-guarded update, storing ratings, invalidating changed answers, and more tests. That is real complexity for a free-tier symptom that Blocker 9 removes.
- *Revisit when:* the Alpha run or logs show the same attempt undecided on consecutive submits, or the paid tier is still not in place when real learners arrive.

**If no question can be asked any more, the submit is 410, not 503.**
- Every sampled item vanished between start and submit, which means a republish during the attempt.
- A 503 would hold the test open until it expires, against I.4.d.b point 5. A 410 tells the learner to start again, and `start()` already does the right thing with an empty chapter.
- Near impossible in practice, but it is one line, and the brief's rule otherwise has no answer for it.

## 1.5 Rejected designs

- **Counting unaskable questions as ungraded.** Then a republished word would hold the test open until it expires (I.4.d.b point 5).
- **A new result state in the DTO** (for example `passed: null`). It needs `packages/types` (PR #107) and app work. The brief keeps 503 plus Retry (3.3).
- **Persisting an `UNDECIDED` status.** That needs a schema change, and `schema.prisma` is in #107. Nothing reads it, either.
- **Integer arithmetic for the bar** (`5 * right >= 4 * asked`). It ties the code to 0.8. The existing tolerance compare is kept and checked at every boundary.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/src/assessments/assessment-verdict.ts` | **New.** `AssessmentVerdict`, `assessmentVerdict()` (1.1), with a doc comment citing I.4.d.b |
| `apps/api/src/assessments/assessment-verdict.spec.ts` | **New.** Section 4.1, verdict column |
| `apps/api/src/assessments/assessments.service.ts` | `GradedResult.asked`. `submit()` per 1.2. The seed call and the parameter rename per 1.3. Doc comments: `ASSESSMENT_PASS_THRESHOLD` ("≥80% of all questions asked, graded right; I.4.d, I.4.d.b"), `seedUntested`, and the 503 comment |
| `apps/api/src/assessments/assessments.service.spec.ts` | Two cases rewritten, new cases added (section 6, task 3) |

- **Contracts: none change.** The DTOs, routes, status codes and stored JSON shape are the same. 503 means "submit again" as before, and now covers more cases. 410 already exists for expiry.
- **New dependencies: none.**

---

# 3. Data

- **No schema change, no migration, no data backfill.**
- **What gets written differently:**
  - fewer attempts reach `PASSED` or `FAILED` during an outage: they stay `IN_PROGRESS` and expire as today;
  - on a pass, up to 19 extra `ItemMasteryState` rows, Hard-seeded like the chapter's unsampled items.
  Old code reads both without change.
- **Additive:** yes, in effect. Only rows of existing kinds, written by existing code paths, are added. Nothing is altered or removed.
- **Past passes stand.**
  - Attempts already submitted replay as stored (`storedResult`). Nothing is re-judged.
  - Repairing chapter marks earned through the loophole would be a non-additive change to live data (the stop list). The brief doesn't ask for it, and the default branch holds one test learner (checkpoint).
  - If the Lead wants the count anyway, this read-only query was denied to me: `SELECT status, kind, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(results::jsonb -> 'items') e WHERE e ->> 'scored' = 'false')) FROM "AssessmentAttempt" GROUP BY 1, 2`.
- **Tested on:** the throwaway branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`), for the Tester's curl runs only. No migration is needed. The Lead owns the branch: agents neither create nor delete branches.
- **Rollback:** revert the PR. Open attempts simply expire. Attempts decided meanwhile are ordinary `PASSED` or `FAILED` rows. The extra seeded rows are ordinary inferred-tier rows, which reviews confirm or correct. No repair is needed.

---

# 4. Promise map

Unit tests run in `pnpm test`. The curl runs are the Tester's (4.3), against the PR build on the throwaway branch with dev-stub auth.

## 4.1 Implementation and proof per promise

Service and curl counts are written right / wrong / ungraded, of 20 unless stated. Verdict-spec tuples are `(right, ungraded, asked)`. "Nothing written" means: no `assessmentAttempt.updateMany`, `userChapterMark.upsert`, `user.updateMany`, `userLessonSkip.createMany`, `recordCheckResult`, `seedInferred` or streak call.

| Promise | Implementation | Unit test (Jest) | Real API (Tester, 4.3) |
|---|---|---|---|
| **P1** A pass needs 80% of all questions graded right. 1 right and 19 ungraded never pass | 1.1 PASSED rule, 1.2 | *Verdict spec:* exhaustive equivalence (V1); `(1, 19, 20)` and `(13, 4, 20)` (the brief's minimum-share example) are UNDECIDED. *Service:* 1/0/19 `SKIP` gives 503 with nothing written (the F1 repro). 15/1/4 gives 503, where today's rule would pass it at 15 of 16. `it.each` SKIP and EXIT, 16/0/4, `passed: true` | **R1** 1/0/19 on chapter 4: PR build 503, and on `main` `passed: true, 1/1` (before and after). **R2** 16/0/4 passes |
| **P2** "Not this time" only if short even with every ungraded answer right | 1.1 FAILED rule | *Verdict:* V1, and `(10, 4, 20)` and `(11, 4, 20)` FAILED. *Service:* 10/6/4 `SKIP` gives `passed: false, correct 10, total 16`, still collapses the fully-tested all-right lesson (`skippedLessonIds: ['l1']`), and writes only the 10 right answers (no penalty). The same on `EXIT` writes 6 Agains and nothing for the 4 ungraded. 11/5/4 fails | **R3** 10/6/4 gives `passed: false, 10/16`. No chapter mark. Mastery rows only for the 10 |
| **P3** Undecided: no pass, no fail, nothing changes; the same answers resubmitted get a result | 1.1 UNDECIDED, 1.2 throw before any write, 1.4 regrade | *Verdict:* `(12, 4, 20)` and `(15, 4, 20)` UNDECIDED, and the two rewritten 2- and 4-question cases. *Service:* `it.each` SKIP and EXIT, 12/4/4 gives `ServiceUnavailableException` with nothing written, including no lesson skip, although l1 is fully tested and all right. **Resubmit:** the same attempt, still `IN_PROGRESS`, gets 503 first. One of the 12 right answers is a paraphrase the AI judges right. Then the grader also judges the 4 `zzz` right, and the identical body gives `passed: true, correct 16, total 20`, with exactly one claim. `gradeOpen` is called 5 times on each submit, so the paraphrase already judged right is graded again (pins I.4.d.c; the rejected cache would make it 4). **Unaskable:** 4 of 20 items vanish, and 13/0/3 of the 16 left passes with `total 13` (it would be 503 if vanished counted as ungraded). All 20 vanish: `GoneException`, nothing written. The existing "410s for an attempt older than the TTL" keeps the hour | **R4** 12/4/4 gives 503. Before and after snapshots of the attempt row (`IN_PROGRESS`, `results` null, `submittedAt` null), the chapter mark, lesson skips and mastery rows are identical. Restart with the fake grader and resubmit the identical body: 201, `passed: true, 16/20`, all `scored: true`, and the fetch counter moves by exactly 4 after boot. A third submit replays it. **R5** the same undecided-then-decided pair on an `EXIT` test |
| **P4** A result with ungraded answers looks as today, and the score agrees with the verdict | `total` and `correct` unchanged. DTO and stored shape unchanged. 1.2 arithmetic | *Verdict:* V2 (property over every PASSED and FAILED case up to 20 questions). *Service:* 16/0/4 has 4 results with `scored: false` in sampled order, `total 16`. The existing B.2.g case (`toEqual` on the ungraded item and the stored JSON) still passes unchanged: 2/1/1 of 4 is a fail under both rules | **R2** `correct 16, total 16`, and the 4 `scored: false` items are present with prompt and answer. **R3** `10/16` = 62.5%. The screen itself is Alpha's (brief 6) |
| **P5** On a pass, ungraded words get schedules like the chapter's untested words | 1.3 | *Service:* `it.each` SKIP and EXIT, 16/0/4. `seedInferred` gets the 4 ungraded IDs plus the 2 unsampled targets, and `recordCheckResult` has exactly the 16 right ones. Existing kanji cases (G.4.d) unchanged. "Existing row untouched" stays pinned in `mastery.service.spec` `seedInferred` | **R2** SQL: each of the 4 `zzz` words has an `ItemMasteryState` row equal to an unsampled chapter-4 word's row in `fsrs` stability, difficulty, reps, state and scheduled_days, and in `due − lastReview`. Both differ from a right-answered word's row (Good, not Hard) |
| **P6** Every answer graded: exactly as before | `ungraded = 0` reduces to today's rule (1.2) | *Verdict:* V3, `ungraded = 0` never UNDECIDED, and PASSED iff `right / asked ≥ 0.8`. *Service:* every existing pass, fail, partial-pass, kanji, listed-meaning, replay, TTL, 409 and concurrency case passes unedited. New: 16/4/0 passes and 15/5/0 fails | **R6** the same answer patterns on PR and `main`, grader off: 20/0/0 and 16/4/0 pass, 15/5/0 fails, with identical `passed`, `correct`, `total` and `skippedLessonIds`, and equal mastery-row counts |

## 4.2 Verification commands

- From the worktree: `pnpm typecheck && pnpm lint && pnpm test`.
- Targeted: `pnpm --filter api exec jest src/assessments src/mastery`.
- **Mutation runs** (Tester, to show the specs bite). Each must turn a named test red:
  - restore `passed = correct / total >= 0.8`;
  - pass `attempt.itemIds` to `seedUntested` again;
  - count unaskable questions as ungraded;
  - move the UNDECIDED throw after the claim transaction.

## 4.3 Tester's real-API runs (all on `br-winter-poetry-baq6sbs4`)

**Setup**
- Build the API from the PR worktree, and from a detached `main` worktree for R1 and R6. Set `DATABASE_URL` to the branch's direct URL. The preload refuses any other host and any pooler host, as `exact-meaning-grading/test.md` 1.1 did.
- Dev-stub auth (`CLERK_SECRET_KEY` and `CLERK_JWT_KEY` empty), with a fresh learner per run via `x-dev-user-id` (`tst-cto-*`). If #107 has merged, `POST /onboarding/age` first. Complete the intake if needed.
- If chapter 4 or 5's assessment isn't offered to a fresh learner, pass chapters 1 to 3 first by skip-test in rōmaji, as `exact-meaning-grading/test.md` 1.5 did.
- **Answers.** Item IDs come from the start response. Meanings come from read-only SQL on the branch.
  - *Right:* a listed form of the item's meaning, for example its first sense. Confirm `scored: true, correct: true` in the response.
  - *Wrong:* `""`. Graded wrong without the grader.
  - *Ungraded:* `"zzz"`. Not listed, so with the grader off it comes back `scored: false`.
- **Grader off:** `GEMINI_API_KEY` empty, for R1 to R3, R6 and the first half of R4 and R5.
- **Fake grader:** for the second half of R4 and R5.
  - Add `HANG_MODE=good` to the existing scratch preload `gemini-hang.cjs`, answering every Gemini fetch with the canned grade from section 0's spike, and keeping the `GEMINI_FETCH n` counter.
  - Start with `GEMINI_API_KEY=fake-good`. The boot model check uses one fetch, so read the counter after boot.
  - Never commit it.

**Runs** (counts are right / wrong / ungraded, on chapter 4 or 5 skip-tests unless stated)
- **R1** (P1, before and after): 1/0/19. The PR build gives 503 and writes nothing (snapshot as in R4). `main` gives `passed: true, correct 1, total 1`.
- **R2** (P1, P4, P5): 16/0/4. The response and SQL checks are in 4.1.
- **R3** (P2, P4): 10/6/4.
- **R4** (P3): 12/4/4. Snapshot before and after, then the fake grader and the identical resubmit, then a replay.
- **R5** (P3, `EXIT`): a fresh learner with chapter 4's lessons marked skipped on the branch (`UserLessonSkip` rows, as `exact-meaning-grading/test.md` 1.5 set up its EXIT tests).
  - The start response must say `kind: 'EXIT'`.
  - Submit 12/4/4: 503, and no chapter mark is written.
  - Then the fake grader and the identical resubmit give a result.
- **R6** (P6): chapter 5 on both builds: 20/0/0, 16/4/0, 15/5/0. Sampling is random, so compare verdicts and counts, not item IDs.

**Leave behind:** the `tst-cto-*` learners and their rows on the throwaway branch, listed in `test.md`. No other learner is touched.

---

# 5. Risks

| Risk | What would show it | Mitigation |
|---|---|---|
| On the free tier, a quick Retry is rate-limited again and stays undecided, because every non-listed answer is regraded (1.4) | `ASSESSMENT_UNDECIDED` repeated for one attempt, next to `GRADING_DEGRADED reason=rate_limited`. Alpha notes on repeated "Couldn't submit" | Blocker 9 (paid tier). The revisit trigger in I.4.d.c: keep the verdicts already reached on the attempt |
| More learners meet today's poor 503 screen (raw status line) | Alpha run (brief 6) | Brief 5: the Mac copy unit after #107 |
| A test of 4 or fewer questions can't pass with even one ungraded answer | Small chapters during an outage | Accepted by the brief (6). Live tests have 14 to 20 questions |
| An undecided attempt expires before grading returns | 410 on Retry. The learner starts a fresh, resampled test | Accepted (brief 5: no retention past the hour) |
| The internal `asked` field leaks into the stored JSON or the wire | Extra key in `results.items` | Items are mapped field by field and typed as the DTO. The existing B.2.g case `toEqual`s both the wire item and the stored items |
| The seed change writes rows for ungraded kanji on a skip-test | A kanji row after a passed skip-test | Kanji readings are exact-match and never ungraded. The `mayInferMastery` filter applies anyway. The existing G.4.d cases stay |
| A mocked spec passes while the real wiring differs | — | R1 to R6 on the real API and database, and the mutation runs in 4.2 |

---

# 6. Tasks (one Developer pass, one PR)

Worktree `.claude/worktrees/chapter-test-outage`, branch `fix/chapter-test-outage`, set up per `ops/PROJECT.md`.

1. **`assessment-verdict.ts` and its spec.** Implement 1.1 exactly.
   - **V1:** for `asked` 1 to 20 and every `right + ungraded ≤ asked`, the verdict equals a brute force over completions. Count `k` of the ungraded right, for `k` from 0 to `ungraded`. The verdict is PASSED if every completion meets the bar, FAILED if none does, and UNDECIDED otherwise. Use threshold 0.8.
   - **V2:** for every PASSED case, `right / (asked − ungraded) ≥ 0.8`. For every FAILED case, `asked − ungraded ≥ 1` and the ratio is below 0.8.
   - **V3:** with `ungraded = 0`, never UNDECIDED, and PASSED exactly when `right / asked ≥ 0.8`.
   - **Named cases**, written as `(right, ungraded, asked)`: `(1,19,20)` U, `(16,4,20)` P, `(15,4,20)` U, `(12,4,20)` U, `(11,4,20)` F, `(10,4,20)` F, `(13,4,20)` U, `(3,1,4)` U, `(1,1,2)` U, `(16,0,20)` P, `(15,0,20)` F.
   - `asked = 0` throws `RangeError`.
2. **`assessments.service.ts`** per 1.2 and 1.3, with the doc comments in section 2.
3. **`assessments.service.spec.ts`.**
   - **Rewrite, don't delete** (brief 6):
     - "a fallback-graded miss (grader outage) is not held against the learner" becomes "a fallback-graded miss that could still change the outcome gives no result, and nothing is written (I.4.d.b)". Same fixture (EXIT, 3 right and 1 ungraded of 4). It now expects `ServiceUnavailableException` and nothing written.
     - "excludes answers the grader could not score from the total and FSRS" becomes "an ungraded answer never helps a pass: 1 right and 1 ungraded of 2 is no result (I.4.d.b)". Same fixture, expecting 503 and nothing written.
   - **New `describe('an outage never decides a test (I.4.d.b)')`**, using a 20-question meaning fixture:
     - Grammar items `m1` to `m20`, meaning `sense <n>`. Lesson `l1` teaches `m1` to `m4`. Lesson `l2` teaches `m5` to `m20`, plus `m21` and `m22`, which are never sampled.
     - Right is `sense <n>` (listed, so it never reaches the grader), wrong is `''`, and ungraded is `'zzz'` with `gradeOpen` returning a fallback miss.
     - Put the right answers on `m1` first, so `l1` is fully tested and all right.
     - Cases: every service case in 4.1, P1 to P6.
     - In the unaskable cases, leave the vanished items out of both `itemFindMany` and the lesson-item rows, as a real deletion would. Otherwise `seedUntested` sees them as quizzable targets.
   - Every other existing case must pass **unedited**. If one doesn't, stop and say why in `dev.md`. That would be a P6 regression, not a test to adjust.
4. **`pnpm typecheck && pnpm lint && pnpm test`** green. Run `/code-review high` on the diff. Open the PR, with `dev.md` in the work unit listing the two rewritten cases, every new case, and any deviation from this plan.

Out of the Developer's pass: the curl runs and the mutation runs (Tester), the app's "no result" copy (brief 5), and any repair of past attempts (section 3).
