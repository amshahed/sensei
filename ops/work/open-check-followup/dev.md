# Dev notes: what an open lesson check tells me after I answer

Unit `open-check-followup`. Written by the Developer, 2026-11-22, against `tech.md` (B.2.d) and `brief.md` (P1 to P8, B.2.c). Branch `feat/open-check-followup`, worktree `.claude/worktrees/open-check-followup`, from `origin/main` `6a8d1ab`. PR [#91](https://github.com/amshahed/sensei/pull/91), head `7d137ef`.

---

# 1. What changed

| Task | Files | What |
|---|---|---|
| T1 | `apps/api/src/checks/check-kind.ts` (new) | `isOpenCheck(format, data)`: never for `MULTIPLE_CHOICE`; otherwise open when `data.answer` isn't a non-empty string. Same rule as the old inline `isClosed` |
| T1 | `checks.service.ts` | Uses `!isOpenCheck(...)`. Returns `scored` (the existing `graded.scored`; closed always `true`). `feedback` only when `gradedBy === 'ai'` |
| T1 | `lesson.mapper.ts` | `open: true` on open checks only |
| T1 | `packages/types` | `CheckDto.open?: true`, `CheckResultDto.scored: boolean`, doc comments |
| T2 | `grading.prompts.ts` | The three rule lines and the self-introduction few-shot example, exactly as tech.md 1.4. Header note says re-checked 2026-11-22 |
| T3 | `data/curriculum/open-check-cases.json` (new), `grader-check.ts` | 10 labelled q17 answers (invented name "Sam", no real names), pairs `full` (kana, rōmaji, mix) and `thin` (rōmaji, kana), `kanaFeedback` on all. `--open --draft <path>` mode: `runOpenCheckCases()`, 3 runs each, 4.5 s pause, pass = every run AI-graded and as expected, no kanji with `kanaFeedback`, pairs agree. Prints every rating and comment. Recall mode unchanged |
| T4 | `LessonPlayer.tsx` | `ResultPanel` open states (tech.md 1.3 table). `onNext` reports `'right' \| 'wrong' \| 'ungraded'`; the score is a tally over one outcome list, total = checks minus ungraded. Open checks get a multi-line box: `multiline`, `scrollEnabled={false}`, `minHeight` 150, `textAlignVertical="top"`, no `onSubmitEditing` |
| T4 | `ui.tsx` | `Screen` opt-in `avoidKeyboard`: `KeyboardAvoidingView` (iOS `padding`, offset 0) and scroll-to-end on keyboard show and on content growth while the keyboard is up |

Specs: `check-kind.spec.ts` (new), `grading.prompts.spec.ts` (new), `checks.service.spec.ts` (scored and comment, including the real `GradingService` with the model off: with exemplar, without, blank), `lesson.mapper.spec.ts` (open flag; no `exemplar`, `rubric`, `answer` key), `grader-check.spec.ts` (open runner: rubric passed through, other lesson skipped, missing or closed check, disagreeing run, fallback, kanji, pairs, committed fixture), `app.integration.spec.ts` (`scored: true` on the MC result). No assertion was loosened.

**Keyboard: the `KeyboardAvoidingView` path shipped**, not the tech.md 1.6 fallback. It is unverified on the SE simulator (section 4).

# 2. Deviations from tech.md

1. **The ungraded notice isn't in `ui.hint`.** `ui.hint` is 13 pt light grey, too faint for the first line of the panel. It uses a neutral style: 16 pt, semibold, `#555`, so no red or green. The copy is as planned.
2. **Scroll-to-end is wired inside `Screen`** (keyboard-show listener and `onContentSizeChange` while the keyboard is up), not from the TextInput's `onFocus`. Same effect, and `Screen` stays self-contained. It doesn't scroll on first render, so a long prompt isn't scrolled away before the learner types.
3. **`outcomeOf` treats a missing `scored` as judged** (`scored === false` means ungraded). Added after the review, so an app build ahead of its API never shows every check as "Couldn't grade".
4. **Open examples only render when there is a model answer.** With no exemplar (the no-exemplar fallback) the "One way to write it:" line is left out rather than showing "—".
5. **The eval was run from the worktree, not the main checkout**, with `--env-file` pointing at the main `.env`, and `--draft` at `tools/authoring/published/foundation-ja-ch17-l07.json`. That file is byte-identical to `output/` (checked with `cmp`). `--draft` resolves from where `pnpm` was typed (`INIT_CWD`), so tech.md's command works as written from the repo root.

# 3. Evidence

## Verification

- `pnpm typecheck` 4/4, `pnpm lint` clean, `pnpm test` 63 suites, 1,472 tests (on `7d137ef`).
- `expo export --platform ios`: 800 modules, bundled.

## Real API on the throwaway branch (no Gemini calls)

Lesson 120 published to `test-open-check-followup` (`br-winter-poetry-baq6sbs4`) only, from the main checkout with `DATABASE_URL` set to the branch's direct URL: "created lesson … (8 items, 17 checks)". Branch: 108 lessons, 120 at position 7, the last in "Likes and self-introduction". Default branch checked read-only afterwards: still 107 lessons, no 120.

Local API from this branch, dev-stub auth, `GEMINI_API_KEY` empty:

| Request | Result |
|---|---|
| `GET /lessons/foundation-ja-ch17-l07` | 17 checks. `open: true` only on position 16 (q17). q17 keys: `id, position, prompt, format, targetItemId, open`. No `exemplar` or `rubric` in the payload (ハナ appears only in the Teach example) |
| q17, `hajimemashite. samu desu. yoroshiku onegaishimasu.` | `correct: false, scored: false`, no `feedback`, `correctAnswer` = model introduction, `explanation` present |
| q17, blank | `correct: false, scored: true`, no `feedback` |
| closed typed check, `x` | `correct: false, scored: true`, no `feedback`, `answerForms` present |

## Open-check eval, run 1 (real Gemini 3.5 Flash-Lite, 30 calls)

**9 of 10.** The one FAIL is a Gemini `503 high demand` (`GRADING_DEGRADED reason=provider_error`) on one run of "single word"; its two model runs were Again as wanted. No kanji in any comment.

| Case | Want | Ratings | Comments |
|---|---|---|---|
| full, kana | pass | Easy/Good/Easy | "Wonderful self-introduction — everything is clear, natural, and hits all six points perfectly." · "Wonderful self-introduction — you included all six parts clearly and correctly." · "Fantastic self-introduction with all six parts included naturally and correctly." |
| full, rōmaji | pass | Good/Good/Easy | "Wonderful self-introduction with all the right details!" · "Excellent self-introduction, you included all six required parts clearly." · "Wonderful self-introduction, complete with all six parts and very natural phrasing." |
| full, mix | pass | Good/Good/Good | "Great self-introduction with all the required parts." · "Fantastic self-introduction with all the required parts." · "Wonderful self-introduction that covers all the points clearly!" |
| missing from + job | pass | Hard/Hard/Hard | "Great self-introduction; next time add where you are from, like わたし は アメリカじん です." · "…such as アメリカじん です." · "…like わたし は アメリカじん です." |
| wrong particles | pass | Hard/Hard/Hard | "Great self-introduction; for likes, use が instead of を: ねこ が すき です。" · "Almost all parts are correct; just change the particle in ねこ を すき です to ねこ が すき です." · **"Almost all of it is wonderful; just change を to の in わたし の なまえ は and が for を in ねこ が すき です."** (two fixes) |
| thin, rōmaji | pass | Hard/Hard/Hard | "Good greeting, name, and closing; next time add where you are from, like amerika jin desu." · "Good greeting and name; next time add where you are from, like あめりかじん です." · "Good greeting, name, and closing; next time add where you are from, like アメリカじん です." |
| thin, kana | pass | Hard/Hard/Hard | "…next time try adding where you are from, like アメリカからきました." · "…like アメリカじん です." · "…like アメリカから きました." |
| English only | miss | Again×3 | "That was in English — try writing your self-introduction in Japanese next time." · "That's in English — try translating your self-introduction into Japanese, starting with はじめまして." · "That was in English — try writing your self-introduction in Japanese using rōmaji or kana." |
| single word | miss | Again×3 (1 fallback) | (fallback) · "That is just a food item — try writing a short self-introduction including a greeting, your name, and a closing." · "That is just a single word — try writing a full self-introduction starting with はじめまして." |
| gibberish | miss | Again×3 | "That doesn't look like Japanese — try starting with はじめまして." · "That does not look like a Japanese self-introduction; try starting with はじめまして." · same |

Reading: P5 pairs agree in every run. No praise on a miss, no "wrong" on a pass, no push to kana. **11 of 12 thin-answer comments name one thing; 1 names two** (wrong particles, run 3). The rule improved it (spike: 3 of 4 listed several) but didn't eliminate it. Comments still teach untaught or unidiomatic Japanese (あめりかじん in hiragana, アメリカから きました), the accepted closed-beta risk (Blocker 6).

## Recall eval, run 1 (13 cases × 3)

**11 of 13.** Both FAILs are Gemini 503 fallbacks, not disagreements: て-form "connects verbs" was Good in its two model runs; ませんか "do you want to" fell back on all three runs. Every model-graded run agreed with what was wanted, including か "because" rejected.

## Re-run of both evals

Re-run once on `7d137ef` (after the review refactor of the runner), as tech.md section 5 says to after fallbacks.

- **Open eval, run 2: 10 of 10, exit 0.** No fallbacks, no kanji, pairs agree. Thin answers: "missing from + job", both "thin" cases each name one thing in every run ("…next time add where you are from, like アメリカじん です."). Wrong particles:
  - runs 1 and 2: **"Great self-introduction; just change を to は in わたし は なまえ は."** This correction is wrong Japanese: the fix is わたし **の** なまえ, and わたし は なまえ は is not a sentence.
  - run 3: "just change を to の in わたし の なまえ は and が in ねこ が すき です." (two fixes).
  - Other comments: full kana "Flawless self-introduction with all six parts included naturally." (×2), English "Please write your self-introduction in Japanese next time.", single word "That's just a food word — a self-introduction needs a greeting, your name, and a few more details."
- **Recall eval, run 2: 10 of 13.** Again all three FAILs are `503 high demand` fallbacks (すみません, よろしくおねがいします, て-form, one run each); their model runs were Good. Across both runs, every one of the 13 cases has at least 3 model-graded runs and every model-graded run agrees with what was wanted. **There is no single clean 13 of 13 run**, because Gemini's free tier was returning 503s; the Tester should re-run it.

## Simulator

**Not done.** This session has no iOS simulator tool (no tool that can tap or type in the simulator), and the app has no deep link into a lesson, so there is no SE screenshot of a q17 miss. P1, P3, P6 and P7 rest on the Tester's simulator run.

# 4. Look at these hard (Tester)

- **P7 on the SE: the `KeyboardAvoidingView` path is untested on a device.** Check that the box and Check are both above the keyboard while typing six sentences, and that moving the cursor into the middle and editing works. If it misbehaves, tech.md 1.6 has the fallback.
- **P1 at SE size with the longest comment** (about 140 characters, "Almost all of it is wonderful; …"). The verdict and the comment should both be in view without scrolling the panel.
- **P4 "one thing":** in each eval run, 1 of 12 thin-answer comments named two fixes, both times on the wrong-particles answer. Score it from your own eval run.
- **The grader gave a wrong correction** in 2 of 3 runs of the wrong-particles case in run 2: "change を to は in わたし は なまえ は" (should be わたし の なまえ). It's linguistic correctness, which tech.md accepts as the closed-beta risk (Blocker 6), but it is worse than the spiked "untaught" comments: it teaches a broken sentence. PM call whether it blocks P2 or publishing.
- **Recall eval:** no clean 13 of 13 because of Gemini 503s (section 3). Re-run it.
- **The end score with an ungraded q17** should read "X of 16".
- **Throwaway branch state:** q17 was answered three times with the grader off as the dev user (`scored: false` → `seedInferred`; one blank → Again). Mastery rows exist for that user on the branch, not on the default branch.

# 5. Review (`/code-review high`, 8 findings)

| # | Finding | Action |
|---|---|---|
| 1 | Android: `behavior` is undefined, so the footer may sit under the keyboard and Return doesn't submit | **Not fixed, out of plan.** tech.md 1.6 specifies iOS `padding`. There is no Android build or test path in this project (`ops/PROJECT.md` runs iOS only), so an Android change couldn't be verified. Backlog for the PM: verify open checks on Android (edge-to-edge in SDK 56) before any Android build |
| 2 | A missing `scored` reads as ungraded | **Fixed** (`scored === false`), deviation 3 |
| 3 | Reviews and practice still forward the fallback's "Not quite — the expected answer was" as feedback | **Not fixed, out of scope** (brief 5). Real: in Reviews, an unscored meaning answer shows the "Couldn't grade" line and then a "Not quite" line. Backlog for the PM: drop learner-facing feedback from `GradingService.fallback`, which would fix both paths in one place |
| 4 | Kana-only comments aren't in the grading prompt | **Premise wrong.** It is in q17's rubric (the PM's amendment: "Write any Japanese in the feedback in kana, never kanji."), which goes into the user turn via `buildGradingUser`. tech.md 1.4 keeps it out of the shared prompt on purpose. 0 of 30 comments had kanji |
| 5 | The shared rule and Hard example could make recall grading lenient | **Kept, per tech.md 1.4.** The recall eval is the agreed guard, and every model-graded run in both runs agreed (section 3), though no single run was clean because of 503s. Weakness to note: the recall set has one rejection case, so it guards leniency drift only thinly |
| 6 | `runOpenCheckCases` duplicates `runGraderCheck`'s loop | **Fixed:** shared `gradeRuns` and `verdictReason` |
| 7 | The pair check mostly repeats the per-case rule and double-reports | **Kept.** tech.md 1.5 asks for it, and P5 is a property of the pair: when one script's version flips, every version of that introduction fails, which is the right signal. The first-failing case keeps its own reason |
| 8 | Two counters and two total formulas for the score | **Fixed:** one `outcomes` list and `tally()` |

# 6. For the Project Manager (outside this plan)

- Android keyboard handling for open checks (finding 1).
- `GradingService.fallback` feedback in Reviews and Practice (finding 3).
- A comment named two fixes once in 12 per run, and the particle case drew a wrong correction (わたし は なまえ は) in 2 of 3 runs. If it matters, the next step is a rubric or prompt tweak and an eval re-run, not code. Add grader comments on particle slips to the native-speaker sample (Blocker 6).
