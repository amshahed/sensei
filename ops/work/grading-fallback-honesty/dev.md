# Dev: an honest "couldn't grade" in reviews, practice and chapter tests

Unit `grading-fallback-honesty` (B5). Developer, 2026-11-24. PR #99 (`feat/grading-fallback-honesty`, worktree `.claude/worktrees/grading-fallback-honesty`), against `tech.md` and B.2.g.

---

# 1. What changed

| File | Change |
|---|---|
| `apps/api/src/grading/grading.service.ts` | `modelComment(result)`: `feedback` only when `gradedBy === 'ai'` and not blank (whitespace-only is blank, review finding R6), else `undefined` (tech 1.1) |
| `apps/api/src/checks/checks.service.ts` | Uses `modelComment()` in place of the inline `gradedBy === 'ai'` test. Same output: an empty AI comment was already dropped by `checkResult`'s `graded.feedback ? …` |
| `apps/api/src/recall/recall-grader.service.ts` | Meaning case takes `feedback` from `modelComment()`. Fallback miss and fallback match now carry no `feedback` |
| `apps/api/src/assessments/assessments.service.ts` | `scored` written to `stored.items`, picked field by field as the DTO type (R8). New `toResult()` maps every stored item to the wire with `scored ?? true`, on the live and the replay path. `StoredItem` type has `scored?` for pre-B.2.g rows. `GradedResult` drops its own `scored` (it now comes from the DTO) |
| `packages/types/src/index.ts` | `AssessmentItemResultDto.scored: boolean` with a doc comment. `ReviewResultDto.feedback` doc now says "model only, never a fallback or unscored result" |
| `apps/mobile/src/recall/RecallCard.tsx` | Comment renders only when `result.scored` (tech 1.2). Unscored and scored lines untouched |
| `apps/mobile/src/review/ReviewSession.tsx` | `graded` tally beside `correct`; `done.total = graded`; `total === 0` shows the none-graded copy from tech 1.3, no score line |
| `apps/mobile/src/assessment/AssessmentScreen.tsx` | `missed` = `scored !== false && !correct`; `ungraded` = `scored === false`, rendered after "To review" under "Couldn't grade these right now, so they don't count:" with the existing `missedRow` layout, `You: … · Answer: …` in `ui.hint` |

**Specs**
- `grading.service.spec.ts`: `modelComment` returns the model's text; nothing for a fallback match, a fallback miss, or an empty model comment.
- `recall-grader.service.spec.ts`: fallback miss with "Not quite — the expected answer was: cat." → `scored: false`, no `feedback`. Fallback match with "Correct." → `correct/scored: true`, no `feedback`. Empty AI comment → no `feedback`. Existing AI case keeps "Spot on.".
- `reviews.service.spec.ts`, `practice.service.spec.ts`: the existing "grader down and fallback says wrong" mocks now carry the real fallback string, and assert no `feedback` (review: exact `toEqual`; practice: `not.toHaveProperty`).
- `assessments.service.spec.ts`: an ungraded meaning comes back `scored: false` in `results` and in the stored JSON, graded ones `true`; a replay keeps stored flags and reads a missing flag as `true`. The existing pass case's exact `toEqual` on one result gains `scored: true` (the new field, not a loosened check).
- `app.integration.spec.ts`: new block with `LLM_CLIENT` overridden by a disabled stub and a VOCAB item: review non-exact (no `feedback`, `scored: false`), review exact (no `feedback`), practice non-exact, chapter test with `scored` per result and an identical replay. The fake's `item.findUnique` now resolves any taught item, not just あ (needed for a vocab review; the old 404 case still 404s).

**Proof the specs bite.** With `main`'s `recall-grader.service.ts` swapped in, 4 of the new assertions fail (fallback miss, fallback match, review, practice).

# 2. Deviations from tech.md

1. **Lint fix outside the plan's list of edits.** `assessments.service.ts` had `stored as unknown as Prisma.InputJsonValue` twice. Once `StoredResults.items` became an `Omit<>` mapped type it is structurally JSON-assignable, and `@typescript-eslint/no-unnecessary-type-assertion` failed the build. I removed the casts (eslint `--fix`) rather than suppress the rule. No runtime change.
2. **No simulator screenshots (T4).** This session can't drive the simulator. The card, the review end screen and the chapter-test list are **not checked on a device**. Only typecheck, lint and an iOS `expo export` (800 modules) prove the app side. Every Tester-sim row of tech.md section 4 is still open.
3. **`toResult()` on the live path too.** tech.md named only `storedResult()`. The live path returns `stored.items`, typed `StoredItem[]` with optional `scored`, so it goes through the same mapper. Values are identical (every live item has `scored`).

# 3. Evidence: real API, throwaway branch, grader off

API built from the PR (`c3cd85b`, then re-run in full on `f96236d` after the review fixes as user `tester-b5b`, same results on a different random sample), started with `env -i` and only `DATABASE_URL` (direct URL of `test-open-check-followup`, `br-winter-poetry-baq6sbs4`, host `ep-small-firefly-bath9jbb`), `PORT=3105`, Clerk, Gemini, Anthropic and Voyage keys empty. The log shows `GeminiLlmClient: GEMINI_API_KEY not set — AI grading disabled`. The evidence script refuses to run unless `DATABASE_URL` is that host. Never the default branch. User `tester-b5`. $0 spent.

Setup through the API: skip-tests on chapters 1 to 3 with the right rōmaji (15/15, 15/15, 20/20, all passed), which makes chapter 4 "Hiragana: the sounds that change" (vocabulary) reachable.

- **P5, chapter 4 skip-test, 20 questions.** Q1 blank, Q2 and Q3 "something else entirely", the rest the stored meaning exactly.
  - Response `passed: true, correct: 17, total: 18`. Q1 地図 `correct: false, scored: true` (graded miss). Q2 写真 and Q3 かばん `correct: false, scored: false`. The other 17 `correct: true, scored: true`. No result carries `feedback`.
  - Stored `AssessmentAttempt.results.items` carries the same `scored` flags; `status PASSED`, `correctCount 17`.
  - Replay (second submit, empty answers): same values field by field. Key order differs from the first response only because Postgres `jsonb` reorders keys; this was already true before B5.
  - No mastery rows were written for the two ungraded items.
- **P1 and P4, review.** On the throwaway branch only, `due` of お姉さん and ちょっと set to one minute ago (Prisma `updateMany`, `userId = 'tester-b5'`).
  - お姉さん answered "raw fish rice": `{ correct: false, correctAnswer: "older sister", scored: false, mastery: 0.074 }`, **no `feedback` key**. On `main` the same path returns the fallback line "Not quite — the expected answer was: older sister." (tech.md section 0; read from the code, not re-run here).
  - Its `ItemMasteryState` row (`mastery, recall, fsrs, due, lastReview, updatedAt`) is byte-identical before and after, and `GET /reviews/due` lists it before and after.
- **P2, review.** ちょっと answered "a little" exactly: `{ correct: true, scored: true }`, no `feedback` (on `main` the code returns "Correct." here; not re-run).
- **P1, practice.** Chapter 4 VOCAB session, 映画 answered "raw fish rice": `{ correct: false, correctAnswer: "movie", scored: false, counted: false }`, no `feedback`.

Not run: the P2 grader-on shot (a model comment still shown). It needs a Gemini call and the simulator. Unit and integration specs pin that an `ai` grade keeps its comment.

# 4. `/code-review high` on PR #99: findings and what happened to each

Fixed in `f96236d`:
- **R6 A whitespace-only model comment rendered as a blank line.** `modelComment` now requires non-blank text, with a spec case. Side effect on lesson checks: a whitespace-only AI comment is dropped there too, which is B.2.d's intent; before, it went out on the wire.
- **R7 The `scored` doc named only the outage case.** It now also names the item-changed-mid-test case, says `correct` is then false, and says pre-B.2.g attempts replay as `true`. The reviewer's "no-exemplar fallback gives correct:true, scored:false" can't reach assessments: every meaning `RecallQuestion` has a non-empty `expected` as its exemplar.
- **R8 The stored-items map destructured and rebuilt six fields.** Now a plain field pick typed `AssessmentItemResultDto`, so a new required DTO field is a compile error, not silently dropped. I kept an explicit allowlist rather than `...rest`: the spread from `RecallGrade` also carries `rating` and, for a model grade, `feedback` at runtime, and neither belongs in storage.

Justified, not changed:
- **R1 A deleted or changed item shows under "Couldn't grade these right now".** Planned: tech.md risk table ("items are upserted, never deleted… renders —. No action"). The answer genuinely wasn't judged and doesn't count, so the line is less specific, not false.
- **R2 Pre-B.2.g attempts replay ungraded answers as misses while the header leaves them out.** Planned: tech.md 1.4 `?? true`, with 0 live attempts on 2026-11-23. It is also exactly what those attempts showed before this PR, so nothing regresses. The suggested inference (`items.length > total`) can tell how many were ungraded but not which: a non-blank wrong meaning stored without `scored` could be a graded model miss or a fallback miss.
- **R3 All cards skipped after a 4xx shows the nothing-counted copy and "These cards will come back".** Planned: tech.md risk table ("A session of only skipped cards shows the nothing-counted line. A 4xx item stays due forever, which is pre-existing"). The copy is true, since they do come back. The PM may change it at review.
- **R4 A partial outage reads "X of 8" with no line about the other 2.** Brief 3.3 rejects that line explicitly: the learner saw the notice on each card, and lessons don't add one.
- **R5 Blank the fallback strings inside `GradingService` instead of a per-caller helper.** tech.md 1.1 considered and rejected this (churn in the `OpenGradeResult` contract, no learner-visible difference). The risk to a future consumer is real, but it is a Tech Lead call and the review brings no new evidence. Noted here for the Tech Lead.
- **R9 The ungraded list's lead-in uses `ui.body`, not the "To review" title style.** tech.md 1.4 specifies "one plain line in `ui.body`" and the brief says "a plain line". It sits in its own `View`. Whether it reads as a separate list is for the Tester on a device (section 5).

# 5. For the Tester: look hard at

- **The card on a device.** Ungraded: only the grey "Couldn't grade that right now, so it doesn't count. Answer: X". Exact fallback match: "Correct!" with nothing under it. Graded kana miss: red "Answer: X" unchanged.
- **Review end screen.** 10 due cards, 2 ungraded → "of 8". All ungraded → the nothing-counted copy, never "0 of 0". A card skipped after a 4xx also counts as ungraded (tech risk table, intended).
- **Chapter-test result.** "To review" holds only real misses; the new list holds ungraded answers. Its title line uses `ui.body` and sits in the same `styles.missed` container as "To review", so the gap between the two lists is the container's `marginTop: 8`. Check it reads as two separate lists.
- **Practice end screen** is untouched by design; its card shares `RecallCard`.
