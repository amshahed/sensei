# Tech plan: an honest "couldn't grade" in reviews, practice and chapter tests

Unit `grading-fallback-honesty` (B5). Written by the Tech Lead, 2026-11-23, against `brief.md` (P1 to P6) and the code at `main` `14b71fc`. Technical decision logged as B.2.g in `decisions.md`. One Developer PR. It lands before `age-confirmation`.

---

# 0. What the code does today (verified)

- **One grading path for three surfaces.** Reviews (`reviews.service.ts`), practice (`practice.service.ts`) and chapter tests and skip-tests (`assessments.service.ts`) all grade through `RecallGraderService.grade()` (`recall/recall-grader.service.ts`). Kana are checked in rōmaji and kanji by reading, both by exact match, so they are always graded. Vocabulary meanings go to `GradingService.gradeOpen()` (Gemini).
- **Where the second line comes from.** On a fallback, `GradingService.fallback()` writes a line into `feedback`: `Not quite — the expected answer was: X.` on a miss, `Correct.` on an exact match. `RecallGraderService` passes `feedback` through whenever it is non-empty (line 79). `recallResult()` puts it on the wire, and `RecallCard.tsx` line 105 renders it under the verdict. That is both of the brief's card defects: the contradiction on an ungraded card and the repeat under "Correct!".
- **Lessons are already clean.** `ChecksService` sends `feedback` only when `gradedBy === 'ai'` (B.2.d, `checks.service.ts` 191). The rule just isn't shared.
- **"Ungraded" is already right in the data.** A fallback miss is `scored: false`. Reviews then write nothing to FSRS (the spaced-repetition schedule), so the card stays due (`reviews.service.ts` 67 to 71, pinned by `reviews.service.spec.ts` "grader down and fallback says wrong"). Practice does the same (`practice.service.ts` 216 to 217). **P4 already holds.** This unit only adds evidence for it.
- **Review end screen.** `ReviewSession.tsx` counts `correct` only for scored passes, but `total` is `queue.length` (line 116). That gives "8 of 10".
- **Chapter test results.** `assessments.service.ts` excludes unscored answers from `total` and `correct` (234 to 242), but the stored and returned `results` items drop `scored` (251 to 259). `AssessmentItemResultDto` has no `scored`. `AssessmentScreen.tsx` 200 lists `!r.correct` as "To review", so ungraded answers land there. Assessments never send `feedback` (the `results` mapping picks fields explicitly).

## Placement: checked, as the PM asked

**Placement never reaches the grader, so it can't count an ungraded answer as a miss. No new unit is needed.**
- Every placement question is multiple choice. The request carries one offered choice per part, or `null` for "I don't know" (`PlacementAnswerRequest`). `placement.service.ts` 136 to 138 marks it correct only if every choice equals the stored answer. There is no model call and no fallback.
- Nothing in `apps/api/src/placement/` or `onboarding/` imports `GradingService`, `RecallGraderService` or the LLM client. The only non-authoring callers of the grader are `ChecksService`, `RecallGraderService` (reviews, practice, assessments) and `authoring/grader-check.ts`.
- This also corrects one line in `age-confirmation/brief.md` 1 ("Placement can already send answers to the grader"). It doesn't change that unit's plan.

---

# 1. Approach

## 1.1 One rule for "is this a comment from the model?" (P1, P2)

- New exported helper `modelComment(result: OpenGradeResult): string | undefined` beside `GradingService` in `grading.service.ts`. It returns `result.feedback` only when `gradedBy === 'ai'` and the text is non-empty, and `undefined` otherwise.
- `ChecksService` (line 191) and `RecallGraderService` (the meaning case) both use it. The B.2.d rule then lives in one place, as `isOpenCheck` does for open checks.
- Effect on the wire, for reviews and practice:
  - Fallback miss: `scored: false`, no `feedback` key. The card shows only its "doesn't count" line (P1).
  - Fallback exact match: `correct: true, scored: true`, no `feedback`. The card shows "Correct!" once (P2).
  - A model grade: unchanged, with the model's comment (P6).
- **Rejected:**
  - **Blank the fallback strings at the source** (`GradingService.fallback` returns `feedback: ''`). It's tidier, but it changes the shared `OpenGradeResult` contract and churns the fallback assertions in `grading.service.spec.ts` and `checks.service.spec.ts`, and no learner would see a difference. The helper gives one rule with a smaller diff.
  - **Filter only in the app.** The text would still go out on the wire, and the next client would show it again.

## 1.2 The card renders a comment only under a verdict (P1, P2)

`RecallCard.tsx`: render `result.feedback` only when `result.scored`. The server never sends a comment on an unscored result after 1.1, so this is a guard on the card's own contract, not a second source of truth. Nothing else on the card changes:
- the unscored line stays exactly as it is: grey `ui.hint` text, "Couldn't grade that right now, so it doesn't count. Answer: X", with the answer once and no red or green;
- the scored states stay exactly as they are (P6).

## 1.3 The review score counts graded cards only (P3)

`ReviewSession.tsx`:
- The `review` phase carries `graded` beside `correct`. On `onNext(result)`, `graded += result?.scored ? 1 : 0`. A card skipped after a 4xx (`result === null`) wasn't graded either, so it counts as ungraded.
- `done` gets `total: graded`.
- Done screen:
  - `total > 0`: "You got X of Y right." The wording is unchanged and Y is the graded count, so 10 cards with 2 ungraded reads "of 8".
  - `total === 0`: no score line. Body: "Nothing could be graded this time, so nothing counted. These cards will come back in your next review." The second sentence is true by P4. The PM may change the copy at review without changing this plan.
- No "2 couldn't be graded" line (brief 3.3).

## 1.4 Chapter test results carry `scored` and list ungraded answers on their own (P5)

API:
- `AssessmentItemResultDto` gains `scored: boolean`, with the same meaning as on `ReviewResultDto`.
- `assessments.service.ts` writes `scored` into `stored.items`, so it is also stored in `AssessmentAttempt.results` and returned on a replayed submit.
- `storedResult()` (the replay path) maps each stored item to `scored: item.scored ?? true`. An attempt stored before this change can't tell an ungraded answer from a miss, so it replays as today. The live database has 0 attempts (read-only query, 2026-11-23), so this is a type-safety default, not a live case.
- Score, pass mark, FSRS write-back, skipped lessons and the 503 when nothing could be graded are untouched (P6, brief 5).

App, `AssessmentScreen.tsx` result phase:
- `missed = results.filter(r => r.scored !== false && !r.correct)`. This is the "To review" list, unchanged in look.
- `ungraded = results.filter(r => r.scored === false)`. It's rendered after "To review", only when non-empty:
  - one plain line in `ui.body`: "Couldn't grade these right now, so they don't count:";
  - each row is the existing `missedRow` layout: the prompt, then `You: <answer or —> · Answer: <correctAnswer or —>`, in `ui.hint`, with no verdict, red or green.
- The same component renders chapter tests and skip-tests, so both are covered.
- `!== false` and `=== false` rather than truthiness, so an API without the field behaves as today. There's no such build, but it costs nothing.

## 1.5 What is deliberately not changed

- `GradingService` and its fallback rules, `ReviewResultDto`, the practice end screen, lesson checks, placement.
- "Try again" after "couldn't grade", and grader comments in "To review" (brief 5).

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/src/grading/grading.service.ts` | Export `modelComment()` (1.1) |
| `apps/api/src/checks/checks.service.ts` | Use `modelComment()` in place of the inline `gradedBy === 'ai'` test. No behaviour change |
| `apps/api/src/recall/recall-grader.service.ts` | Meaning case: `feedback` from `modelComment()` |
| `apps/api/src/assessments/assessments.service.ts` | `scored` in `stored.items` and in `storedResult()` with the `?? true` default |
| `packages/types/src/index.ts` | `AssessmentItemResultDto.scored: boolean`, with a doc comment |
| `apps/mobile/src/recall/RecallCard.tsx` | Comment only when `scored` (1.2) |
| `apps/mobile/src/review/ReviewSession.tsx` | `graded` tally, `total: graded`, the none-graded copy (1.3) |
| `apps/mobile/src/assessment/AssessmentScreen.tsx` | Split `missed` and `ungraded`, and the new list (1.4) |
| Specs | See section 4 |

No new dependencies.

---

# 3. Data

- **No schema change, no migration, no change to any live row.**
- `AssessmentAttempt.results` (JSON) gains a `scored` key per item on new submits. **Additive**: old code ignores the key, and new code defaults a missing key to `true`.
- **Rollback:** revert the PR. Attempts stored meanwhile keep a `scored` key that old code ignores. Nothing to undo in data.
- **Test data** lives on the existing throwaway branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`). It has the same migrations as live (through `20261104230000_reminders`) and lesson 120. No new branch is needed. The Tester sets `DATABASE_URL` to that branch's direct (non-pooler) URL in the environment, ahead of `--env-file`. **Never the default branch.** The Alpha run needs it clean.
  - **Due reviews for a fresh learner.** Run as `DEV_USER_ID=tester-b5`:
    1. Answer the checks of one vocabulary lesson and one kana lesson through `POST /checks/:id/answer`, which creates mastery rows.
    2. On the throwaway branch only, make them due: `UPDATE "ItemMasteryState" SET due = now() - interval '1 minute' WHERE "userId" = 'tester-b5' AND "itemId" IN (<10 chosen ids>)`.
  - **Chapter tests:** `POST /chapters/:id/assessment` for a chapter with vocabulary.

---

# 4. Promise map

Test locations:
- **Jest**: unit and integration tests in `pnpm test`, in CI. New integration cases override `LLM_CLIENT` with a disabled stub (`enabled: false`, and `parseJson` rejects), so the fallback is deterministic even where an `.env` holds a Gemini key.
- **Tester-API**: a local API from the PR against the throwaway branch, dev-stub auth. "Grader off" means `GEMINI_API_KEY` empty. With the grader off, the fallback is deterministic:
  - a vocabulary meaning typed exactly as stored is graded correct;
  - any other non-blank meaning is ungraded;
  - a blank is a graded miss;
  - kana and kanji are always graded.
- **Tester-sim**: `Sensei 22a SE3` with the harness-plus-screenshot method of `open-check-followup/test.md` 1.3. A throwaway, uncommitted harness sets answers through the card's own state and submits through its own handler. Each shot is taken with `xcrun simctl io screenshot`, untouched.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P1** Ungraded review or practice card: one plain "doesn't count" line, the answer once, no "Correct!"/"Not quite", no red or green | 1.1 no fallback comment on the wire. 1.2 comment only under a verdict. Existing unscored line | <ul><li>Jest `recall-grader.service.spec.ts`: a fallback miss whose `feedback` is "Not quite — the expected answer was: cat." returns `scored: false` and **no `feedback` key**</li><li>Jest `grading.service.spec.ts`: `modelComment` returns the text for `ai`, and `undefined` for `fallback` and for empty text</li><li>Jest integration: `POST /reviews/:itemId/answer` and `POST /practice/sessions/:id/answer` with a non-exact meaning, LLM disabled, return `scored: false` and no `feedback` in the body</li><li>Tester-sim, grader off: one review card and one practice card answered with a non-exact meaning (e.g. "raw fish rice" for すし). The screenshot shows only the grey line with the answer once</li></ul> |
| **P2** Verdict said once; any comment is about what I wrote | 1.1, 1.2 | <ul><li>Jest `recall-grader.service.spec.ts`: a fallback exact match whose `feedback` is "Correct." returns `correct: true, scored: true` and no `feedback`. An AI grade keeps its `feedback` (existing case, kept)</li><li>Jest `checks.service.spec.ts`: existing B.2.d cases pass unchanged through the helper</li><li>Tester-sim, grader off: a review card answered with the exact meaning shows "Correct!" and no line under it</li><li>Tester-sim, grader on (free tier, $0): one meaning answer graded by the model shows the verdict plus the model's comment. If the call falls back, retry later. Record it if it never succeeds</li></ul> |
| **P3** Review score counts graded cards only; none graded means no score and "nothing counted" | 1.3 | <ul><li>Tester-sim, grader off, 10 due cards: 6 kana answered right, 2 meanings typed exactly, 2 meanings non-exact. The end screen reads **"You got 8 of 8 right."**</li><li>Tester-sim, grader off: a session where every card is a non-exact meaning. The end screen shows no score, only the nothing-counted line, and never "0 of 0"</li><li>Mobile typecheck (`pnpm typecheck`) and Metro bundling on the device</li></ul> |
| **P4** An ungraded review card comes back in a later session, as if unanswered | Existing (section 0). No code change | <ul><li>Jest `reviews.service.spec.ts` "grader down and fallback says wrong" (existing): no `recordCheckResult`, `review: false`. Add the assertion that the response has no `feedback`</li><li>Tester-API, grader off: before and after one ungraded answer, `SELECT mastery, recall, fsrs, due, "lastReview", "updatedAt" FROM "ItemMasteryState"` for that item is identical, and `GET /reviews/due` still lists it</li></ul> |
| **P5** Chapter test or skip-test: ungraded answers aren't in "To review"; listed on their own with my answer and the answer under the plain line | 1.4 | <ul><li>Jest `assessments.service.spec.ts`: a submit with one unscored meaning returns that item with `scored: false` in `results` and in the stored JSON. Graded items carry `scored: true`. A replay of stored results without `scored` returns `scored: true`</li><li>Jest integration: `POST /assessments/:id/submit` with LLM disabled returns `scored` on every result</li><li>Tester-API, grader off: submit a chapter test with exact meanings, one blank (a graded miss) and two non-exact meanings. `total` excludes the two, and each result carries the right `scored`</li><li>Tester-sim, grader off: the same answers in the app. The screenshot shows "To review" holding only the blank, and the new line and list holding the two with "You: … · Answer: …", with no verdict. Then the same for one skip-test</li></ul> |
| **P6** Graded answers look and count exactly as before | 1.1 keeps model comments. 1.2 and 1.4 change only the unscored branches | <ul><li>Jest: every existing reviews, practice, assessments and checks spec passes unchanged (scores, pass marks, FSRS writes)</li><li>Tester-sim: a graded kana miss shows the red "Answer: X" line as before. A chapter-test score and pass message match the API's `correct`/`total`</li><li>The P2 grader-on shot (a model comment is still shown)</li></ul> |

---

# 5. Risks

| Risk | What would show it |
|---|---|
| A model comment is lost by the helper (say `gradedBy` isn't `ai` on a real model grade) | The P2 grader-on shot has no comment. Jest pins `ai` → text |
| Skipped (4xx) review cards now drop out of the score | Intended: they weren't graded. A session of only skipped cards shows the nothing-counted line. A 4xx item stays due forever, which is pre-existing |
| An item deleted mid-attempt (prompt `''`) appears in the ungraded list with blanks | Rare: items are upserted, never deleted. It renders "—". No action |
| The free tier falls back during the grader-on shot | `GRADING_DEGRADED` in the API log. Retry. Blocker 9 removes it |
| The Tester's SQL `due` bump lands on the wrong branch | The Tester confirms the branch id (`br-winter-poetry-baq6sbs4`) in `test.md` before any write |

---

# 6. Tasks (one Developer pass, one PR, in this order)

1. **T1 Comment rule.** Add `modelComment()` and use it in `ChecksService` and `RecallGraderService`. Specs: `grading.service.spec.ts` (helper) and `recall-grader.service.spec.ts` (a fallback miss and a match carrying fallback text return no `feedback`; AI keeps it). Add the no-`feedback` assertion to the existing review and practice fallback cases.
2. **T2 Assessment results.** Add `AssessmentItemResultDto.scored`, `scored` in `stored.items`, and the `storedResult()` default. Specs in `assessments.service.spec.ts`. Add integration cases for reviews, practice and assessments with the disabled `LLM_CLIENT` stub.
3. **T3 App.** `RecallCard` (1.2), `ReviewSession` (1.3) and `AssessmentScreen` (1.4). Run `pnpm --filter mobile typecheck`.
4. **T4 Verification.** Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high`, then open the PR. Write `dev.md` with any deviation and one SE screenshot each of an ungraded review card and a chapter test result with the new list, against `test-open-check-followup` with the grader off.

**Not to be touched:** "Try again", grader comments in "To review", the fallback rules themselves, placement, lesson checks, the practice end screen.
