# Tech plan: a listed meaning is marked right at once

Unit `exact-meaning-grading`. Written by the Tech Lead, 2026-11-28, against `brief.md` (P1 to P8), `decisions.md` G.4.h (with G.4.a, G.3, H.2, B.2.g and L.4.b), and the code at `main` `25e1d6d`. The technical decision is logged as G.4.i. One Developer pass, one PR, API only.

**PR #107 overlap: none.** Every file below is outside `gh pr diff 107 --name-only`. This plan doesn't touch `app.integration.spec.ts`, `packages/types`, `users.controller.ts`, `auth/`, `onboarding/`, `schema.prisma` or `apps/mobile`. If #107 merges first, the only effect is on the Tester's setup: the dev learner answers the 18+ question first (M.5.a).

---

# 0. What the code does today (verified)

- **Every recall surface grades through one method.** Reviews (`reviews.service.ts` 64), practice (`practice.service.ts` 209), and chapter tests and skip-tests (`assessments.service.ts` 350, one submit path for `SKIP` and `EXIT`) all call `RecallGraderService.grade()` (`recall/recall-grader.service.ts`). Kana (`romaji`) and kanji (`reading`) are exact matches there. A `meaning` answer always goes to `GradingService.gradeOpen()`, with the stored meaning as the exemplar.
- **Lessons and placement don't use it.** `ChecksService` calls `GradingService` directly (`checks.service.ts` 173), including lesson 120's open check with its exemplar. Placement is multiple choice and never reaches a grader. `authoring/grader-check.ts` also calls `GradingService` directly. So a rule placed in `RecallGraderService` reaches exactly the four surfaces in brief 3.4, and nothing else.
- **What the fallback does.** `GradingService.fallback()` accepts only the whole stored string (`normalizeAnswer`: trim, collapse spaces, lowercase; punctuation is *not* stripped). An exact match there returns rating `Good`, so `RecallGraderService` returns `{ correct: true, scored: true, rating: Rating.Good }` with no feedback (B.2.g). Anything else is a fallback miss and comes back `scored: false`.
- **The wait.** `gradeOpen` waits up to 12 s (`GRADE_TIMEOUT_MS`). A chapter-test submit grades 20 items through `mapLimit` with `CONCURRENCY` in flight, and each meaning item is one model call.
- **The rating default.** `MasteryService.recordCheckResult` uses `input.rating ?? ratingFromCorrect(correct)`, so a right kana or reading answer is also `Good`.

## Live data, read-only (2026-11-28)

I ran the rule below as a throwaway spike over all 209 VOCAB and GRAMMAR meanings linked to a lesson on the default branch (read-only `SELECT`).
- **It accepts every example in brief 3.2 and P1 to P4**, and also "Im sorry", "youre welcome", "10000", "good tasting".
- **It rejects every P7 counter-example:** "delicious" (おいしい), "helo" and "goodbye" (こんにちは), "little" (ちょっと), "a pen" for "pen". It also rejects "ilet" against "toilet" and "hello good day" (two senses joined).
- **It changes the outcome for 44 vocabulary words**, the PM's count exactly: 12 with several senses, plus 32 that gain a key from a bracket or a leading "to". Two grammar items gain a harmless key (に's explanation without its brackets, and に/へ's explanation without its leading "To.").
- **One finding for the PM, the same kind as the brief's known cost:** 隣 "next (to)" accepts **"next"**. In English "next" alone usually means "following", which 隣 doesn't mean. I haven't narrowed the rule, as brief 6 asks. It's for the PM to rule on, and for the Blocker 6 sample list, next to そこ "there", どれ "which" and いただきます "thank you". Other bracket drops I checked look harmless: お茶 "tea", シャツ "shirt", 一緒 "together", 寒い "cold", 人 "ian" (nobody types it).

---

# 1. Approach

## 1.1 The rule as a pure function in `recall/`

New `apps/api/src/recall/listed-meaning.ts` exports `isListedMeaning(answer: string, meaning: string): boolean`. Brief 3.2 becomes:

1. **Comparison key.** Lowercase the text, split it on every run of characters that aren't letters or digits (`/[^\p{L}\p{N}]+/u`), drop empty pieces, and join the words with nothing between them. "How do you do?" becomes `howdoyoudo`. "I'm sorry" and "Im sorry" both become `imsorry`. "10,000" becomes `10000`. "good-tasting" and "good tasting" both become `goodtasting`.
2. **The answer's key.** If it is empty (blank, or punctuation only), there is no match.
3. **Senses.** Split the stored meaning on `;`. Never on commas or full stops (brief 3.2, rejected).
4. **Brackets (rule 2).** Each innermost `( … )` part in a sense is independently either dropped or kept without its brackets. A sense with *n* parts has 2^n variants. The most in live data is 3, in に's explanation. **Guard:** above 6 parts, only two variants are used: all dropped and all kept.
5. **Leading "to" (rule 3).** For each variant, if its first word is exactly `to` and at least one word follows, the variant without that word also counts. This runs after step 4, so "to come (spatially or temporally)" gives `come`. It matches whole words, so "toilet" never gives `ilet`.
6. **Match** when the answer's key equals the key of any variant that isn't empty.

**Why spacing is ignored completely, not just collapsed.** Brief 3.2.1 says "spacing … doesn't matter". With spacing ignored, hyphens, apostrophes and thousands commas work without special cases. The cost is that a different word split ("a part" against "apart") would match. That only happens if the stored sense is one of a pair and the learner types the other. No live meaning has such a pair. The spec pins "little" against "a little", which is the one articles case that matters.

**Why it lives in `recall/`, not `common/`.** `common/normalize-answer.ts` is shared with closed lesson checks and the fallback. G.4.h is scoped to recall surfaces, and the module location says so.

## 1.2 The shortcut in `RecallGraderService` (P1 to P5)

In the `meaning` case of `grade()`, before `gradeOpen`:

```ts
if (question.accepted.some((m) => isListedMeaning(answer, m))) {
  // G.4.h: a listed meaning is decided here, like a kana or reading match.
  return { correct: true, scored: true, rating: ratingFromCorrect(true) };
}
```

- **What it returns is exactly what a fallback exact match returns today**, without the model call: `correct`, `scored`, `rating: Rating.Good`, and no `feedback` key. Everything downstream already handles that shape. `recallResult()` sends no comment, the app shows "Correct!" alone, the assessment score counts it, and FSRS gets `Good` (brief 3.3).
- **It uses `question.accepted`**, which for a meaning question is `[item.meaning]`, so the check is parallel to the `romaji` and `reading` branches. `recall-question.ts` changes only in the doc comment on `accepted`, which today says "(`romaji` / `reading`)".
- **The rating is passed explicitly** (`ratingFromCorrect(true)`, already exported from `mastery/fsrs.ts`, beside `ratingFromLabel`) rather than left to the mastery default. The specs can then assert `Good` at the seam, and P6 doesn't rest on a default two modules away.
- **Every other meaning answer takes today's path unchanged** (P7): same `gradeOpen` input, same `modelComment`, same unscored fallback miss.

## 1.3 Rejected

- **The rule inside `GradingService.gradeOpen`.** It would reach lesson checks, lesson 120's open check (exemplar match) and `authoring:grader-check`, which breaks P8 and the eval tool's purpose (brief 5).
- **The rule inside each surface service.** Three copies of one rule, which G.4.a exists to prevent.
- **Expanding `accepted` in `recallQuestionFor` and grading meanings as `romaji`.** It mixes question-building with grading. It also changes the question contract that placement's quizzability check and `grader-check` read, and `exactMatch` doesn't ignore punctuation or brackets.
- **Teaching the fallback the same rule.** Once the shortcut runs first, a recall answer that matches the rule never reaches the fallback. Changing the fallback would only change lessons, which are out of scope.
- **Splitting on spaces but keeping word boundaries.** "Im sorry" and "10000" would miss, and brief 3.2.1 says punctuation and spacing don't matter.
- **Restricting rule 3 to items whose ingest data marks a verb.** The leading "to" *is* JMdict's verb marker (brief 3.2, Why), and the only non-verb sense starting with "to" (に/へ's "To. Marks…") is harmless. A POS lookup (part of speech) would tie grading to the ingest's data shape for no gain.
- **A log line per shortcut.** It isn't a degraded grade. The Alpha signal is the absence of "couldn't grade" on screen.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/src/recall/listed-meaning.ts` | **New.** `isListedMeaning(answer, meaning)`, as in 1.1. Pure, with no imports |
| `apps/api/src/recall/listed-meaning.spec.ts` | **New.** Table-driven rule tests (section 4) |
| `apps/api/src/recall/recall-grader.service.ts` | The shortcut in the `meaning` case (1.2). Import `ratingFromCorrect` beside `ratingFromLabel`. Update the doc comments on `RecallGrade.rating` and `feedback` to cover a listed meaning |
| `apps/api/src/recall/recall-question.ts` | Doc comment on `RecallQuestion.accepted` only: a meaning question's listed meanings count (G.4.h) |
| `apps/api/src/recall/recall-grader.service.spec.ts` | New cases. Existing meaning cases whose answer equals `expected` get a non-listed answer so they still test the path their name says (section 6) |
| `apps/api/src/reviews/reviews.service.spec.ts` | One new case. One existing case gets a non-listed answer |
| `apps/api/src/practice/practice.service.spec.ts` | One new case |
| `apps/api/src/assessments/assessments.service.spec.ts` | One new `it.each` over `SKIP` and `EXIT`. Two or more existing cases get a non-listed answer |
| `apps/api/src/checks/checks.service.spec.ts` | One new P8 pin: an open check answered with its exemplar still goes to the grader |

- **Contracts: none change.** No DTO, no route, nothing in `packages/types`, no mobile change. `RecallGrade`'s shape is unchanged: a listed match fills the same three fields a fallback match does.
- **New dependencies: none.**

---

# 3. Data

- **No schema change, no migration, no data change.** Nothing is backfilled. Stored `AssessmentAttempt.results` keep their shape: the DTO stores no rating or feedback.
- **Additive:** not applicable. Nothing is written that old code can't read. A listed answer writes the same FSRS row, with `Good`, that a fallback exact match writes today.
- **Tested on:** the throwaway Neon branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`), for the Tester's curl runs only. It has every migration: the newest is `20261104230000_reminders`, older than the branch. The Lead owns the branch. If its content looks stale (section 4.3 setup check), a reset from parent is the Lead's call, not an agent's.
- **Rollback:** revert the PR. Every meaning answer goes back to the grader (G.4.h, Reverse). Rows written while it was live are ordinary `Good` reviews and need no repair.

---

# 4. Promise map

Unit tests run in `pnpm test`. The curl runs are the Tester's, against the PR build on the throwaway branch with dev-stub auth (`CLERK_SECRET_KEY` and `CLERK_JWT_KEY` empty).

## 4.1 Implementation and proof per promise

| Promise | Implementation | Unit test (Jest) | Real API (Tester, curl) |
|---|---|---|---|
| **P1** A listed meaning: "Correct!" at once, nothing under it, on all four surfaces | 1.2 shortcut, before `gradeOpen` | `listed-meaning.spec`: こんにちは "hello", "good day", "good afternoon"; ありがとう "thanks"; すみません "excuse me". `recall-grader.service.spec`: a listed answer `toEqual({ correct: true, scored: true, rating: Rating.Good })`, so there's no `feedback` key, and `gradeOpen` isn't called. Review, practice and assessment specs: the same on each surface | **Grader on** (4.3 C): `POST /reviews/:itemId/answer` with "hello" for こんにちは returns `correct: true, scored: true` with no `feedback` key, and the Gemini call counter doesn't move. The same item and answer on a `main` build return the model's comment, which is the before and after the brief asks for. Practice, chapter-test and skip-test results also carry no comment |
| **P2** Case, spaces, punctuation | 1.1 steps 1 and 2 | "Hello!", "thanks.", "  THANK   you ", "how do you do" against "…; how do you do?", "years old" against "... years old", "Im sorry", "10000" against "10,000" | Review answers "Hello!" and "how do you do" (はじめまして) come back `correct: true, scored: true` |
| **P3** A bracketed part dropped, or typed without brackets | 1.1 step 4 | "water", "water esp cool or cold"; "in front", "in front of"; "America", "United States of America"; "good", "good-tasting", "good tasting" | Review answers "water" (みず), "in front of" (まえ), "America" (アメリカ) come back right |
| **P4** A verb's "to" dropped | 1.1 step 5 | "eat" and "to eat" (たべる), "go" (いく), "come" (くる, after its bracket is dropped). "toilet" never accepts "ilet" | Review answers "eat", "go", "come" come back right |
| **P5** Right and counted when the grader is down, slow or busy; no wait; a full test of listed meanings is scored on every question | The shortcut returns before any `gradeOpen` call | `recall-grader.service.spec`: `gradeOpen` returns a never-settling promise, and a listed answer still resolves. If it waited, Jest's timeout would fail the test. `gradeOpen` rejecting, or returning a fallback, changes nothing. `assessments.service.spec`, `it.each(['SKIP','EXIT'])`: every meaning answered with a listed meaning and `gradeOpen` never settling. `submit` resolves, every result is `scored: true, correct: true`, `correct === total`, `passed`, and `gradeOpen` isn't called. Reviews and practice: one hanging-grader case each | **Grader off** (4.3 A) and **grader hanging** (4.3 B): every listed answer on all four surfaces returns `scored: true, correct: true` in under 1 s (`curl -w '%{time_total}'`), and the hang counter stays at its value after boot. Control: one non-listed answer ("delicious", おいしい) takes about 12 s, comes back `scored: false`, and moves the counter by 1. A chapter test and a skip-test answered wholly with listed meanings (kana in rōmaji, kanji by reading) submit in under 1 s with `correct === total`, at zero hang hits |
| **P6** Counts like any right answer: review end-screen score, chapter-test score and pass mark, schedule | `rating: ratingFromCorrect(true)` (Good), `scored: true` | Reviews spec: `recordCheckResult` gets `{ correct: true, rating: Rating.Good }`, and the streak gets `review: true` for a due item. Practice spec: the answer is `counted`, and `recordCheckResult` gets `Good`. Assessment spec (P5 case): `correct`, `total` and `passed` include it, and the write-back carries `Good` | The end screen counts `scored && correct` (B.2.g), so it follows from the wire fields above. A chapter test's `correct`, `total` and `passed` in the submit response. **Schedule:** on the branch, answer one never-seen vocab item with a listed meaning and one never-seen kana item with its rōmaji, in the same minute. Their `ItemMasteryState` rows must have the same FSRS stability and the same `due` offset, because both are first-contact `Good` |
| **P7** Everything else is graded as today, with the model's comment; when the grader can't judge, "couldn't grade" and it doesn't count | The non-listed path is untouched | `listed-meaning.spec` rejects "delicious", "a pen" against "pen", "helo", "goodbye", "little" against "a little", "hello good day", "thank" against "thank you; thanks", "is" against です's explanation, and empty or punctuation-only answers. `recall-grader.service.spec`: a non-listed answer calls `gradeOpen` with the same `{ prompt, answer, exemplar }` as today, and the model's comment flows through. The existing "fallback-graded miss is unscored" case stays | Grader on: "delicious" (おいしい) carries the model's comment. Grader off or hanging: "delicious", "a pen", "helo", "goodbye", "little" come back `scored: false` |
| **P8** Lessons and placement unchanged | No file in `checks/`, `lessons/` or `placement/` and no `GradingService` code changes | `checks.service.spec` new pin: an open check (no fixed answer) answered with its exact exemplar still calls `gradeOpen` and returns the model's comment. All existing checks and placement specs pass unchanged | Grader hanging: lesson 120's open check (`POST /checks/:id/answer`) answered with its stored exemplar still waits about 12 s and comes back unscored, moving the counter by 1. That proves lessons didn't take the shortcut. One closed typed check and one multiple-choice check return as before |

## 4.2 Verification commands

- From the worktree: `pnpm typecheck && pnpm lint && pnpm test`.
- Targeted: `pnpm --filter api exec jest src/recall src/reviews src/practice src/assessments src/checks`.

## 4.3 Tester's real-API runs (all on `br-winter-poetry-baq6sbs4`)

**Setup.**
- Build the API from the PR worktree. Set `DATABASE_URL` to the branch's direct URL, and have the evidence script refuse any other host, as in `grading-fallback-honesty/test.md` 1.2.
- Run read-only SQL to confirm that the items named in P1 to P4 exist on the branch with the meanings quoted in section 0. If they don't, stop and tell the Lead.
- If #107 has merged, `POST /onboarding/age` first.
- Complete the intake if `OnboardingGate` needs it.

**A. Grader off.** `GEMINI_API_KEY` empty.

**B. Grader hanging.** Start the API with `GEMINI_API_KEY=hang-test` (not a real key) and `node -r <scratchpad>/gemini-hang.cjs dist/main`. The preload is a throwaway scratch file, never committed.
- It wraps `globalThis.fetch`. A request to `generativelanguage.googleapis.com` gets a promise that settles only when its `AbortSignal` fires, and each one prints a numbered `GEMINI_FETCH n` line.
- Every other request passes through, including Neon and Clerk.
- The Gemini SDK calls the global `fetch` (`@google/generative-ai` 0.24.1, `makeRequest(url, opts, fetchFn = fetch)`).
- The startup model check (`checkModel`) is not awaited at boot, so the API still starts. It uses up `GEMINI_FETCH 1`. Read the counter after boot.

**C. Grader on.** Use the same preload in count-only mode, passing every request through, with `GEMINI_API_KEY` and `LLM_GRADING_MODEL` from the main `.env`, never printed. This is a handful of free-tier calls.

**Routes.**
- `POST /reviews/:itemId/answer` grades any quizzable item, due or not.
- `POST /practice/sessions`, then `POST /practice/sessions/:id/answer`.
- `POST /chapters/:chapterId/assessment`, then `POST /assessments/:attemptId/submit`. A chapter the dev learner hasn't completed is a `SKIP`. One whose lessons are all done or skipped is an `EXIT`, set up on the branch as in `grading-fallback-honesty/test.md`.
- `POST /checks/:id/answer`.

---

# 5. Risks

| Risk | What would show it | Mitigation |
|---|---|---|
| The rule accepts an answer a teacher wouldn't (a dropped qualifier) | Native-speaker sample (Blocker 6). Alpha notes on そこ, どれ, いただきます, 隣 | Brief's known cost. 隣 "next" sent to the PM (section 0). Narrowing is a content edit to the stored meaning or a rule change, either one small |
| A future meaning with many brackets makes 2^n variants | A slow review answer | 1.1 step 4 guard (above 6 parts, two variants only), with a spec case |
| A future ingest uses `,` or `/` between senses instead of `;` | Fewer listed matches. Those answers go to the grader as today, so it fails safe | None needed. It never accepts more than the rule |
| An existing spec quietly stops testing the grader path, because its "right" answer is now listed (for example `'please do'`, `'sushi'`, `'x'`) | The test passes, but `gradeOpen` is no longer called in a case named for it | Section 6, task 4: each such case gets a non-listed answer, and keeps or gains a `gradeOpen` call assertion. The Tester checks it in review |
| Learners type something other than the listed meaning, so "couldn't grade" stays common | Alpha run (brief 6) | Reported by Alpha. Not fixable here: Blocker 9 (paid tier) |
| The grader's richer rating is lost on exact answers (never `Easy` or `Hard`) | Intervals on listed answers match kana answers | Intended (brief 3.3, G.4.h point 3) |

---

# 6. Tasks (one Developer pass, one PR)

Worktree at `.claude/worktrees/exact-meaning-grading`, branch `feat/exact-meaning-grading`, with the setup from `ops/PROJECT.md`.

1. **`listed-meaning.ts` and its spec.** Implement 1.1 exactly, including the bracket guard. The spec covers every string in section 4.1's unit column for P1 to P4 and P7, plus three cases: an empty or punctuation-only answer, a meaning with no key (for example `"(…)"`), and the more-than-6-brackets guard. Use the live meaning strings verbatim from section 0 (for example `"hello; good day; good afternoon"`, `"to come (spatially or temporally)"`, `"(United States of) America"`).
2. **The shortcut** in `recall-grader.service.ts` (1.2), and the two doc comments (`RecallGrade` in that file, `accepted` in `recall-question.ts`).
3. **`recall-grader.service.spec.ts`.**
   - Add four cases: a listed answer `toEqual({ correct: true, scored: true, rating: Rating.Good })` with `gradeOpen` not called; the same with `gradeOpen` as `() => new Promise(() => {})`; the same with `gradeOpen` rejecting; and a non-listed answer that still calls `gradeOpen` with unchanged input.
   - Existing cases "a fallback-graded match still counts" and "a model grade with an empty comment" answer `'x'` against `expected: 'x'`, which the shortcut now catches. Give them a question whose whole stored string isn't one listed sense, for example `expected` and `accepted` of `'x; y'` answered `'x; y'`. They then still reach the fallback and the model path.
4. **Surface specs.**
   - *Reviews:* add a listed answer with a hanging grader, asserting the result, `recordCheckResult` with `Good`, and the streak `review` flag. "meaning answers are AI-graded…" answers `'sushi'` for `'sushi'`, so change its answer to a non-listed one so `Easy` and "Exactly." still flow.
   - *Practice:* add one listed answer with a hanging grader, asserting `counted` and `Good`.
   - *Assessments:* add `it.each(['SKIP', 'EXIT'])` with every answer right (g1 answered `'Please do!'`), `gradeOpen` never settling, and the 4.1 P5 assertions. "grades meaning answers with the AI grader and skips it for blank answers" and "503s and leaves the attempt open when nothing could be graded" answer g1 `'please do'`. Give both a non-listed answer, adjusting the default `gradeOpen` mock if needed, so they still test the grader and the 503.
   - Run the whole suite. Any other failure caused by an answer that is now listed gets the same treatment, listed in `dev.md`.
   - *Checks:* add the P8 pin.
5. **`pnpm typecheck && pnpm lint && pnpm test`** green. Run `/code-review high` on the diff. Then open the PR, with `dev.md` in the work unit listing every spec answer changed under tasks 3 and 4, and why.

Out of the Developer's pass: the curl runs (Tester), and any change to stored meanings (content, PM).
