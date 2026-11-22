# Tech plan: what an open lesson check tells me after I answer

Unit `open-check-followup`. Written by the Tech Lead, 2026-11-22, against `brief.md` (P1 to P8, B.2.c) and the code at `main` `c2b3907`. Technical decision logged as B.2.d in `decisions.md`. One Developer PR. It lands before `authoring-polish`.

---

# 0. What the code does today (verified)

- **The app can't tell an open check from a closed one before it is answered.** `mapCheck()` (`lesson.mapper.ts`) sends id, position, prompt, format, target and choices. q17 is `TYPED` with no `choices` key, exactly like a closed typed check, so it gets the one-line box.
- **Open grading** is `ChecksService.gradeOpen()` → `GradingService.gradeOpen()` (Gemini 3.5 Flash-Lite, 12 s cap). `scored` is computed (false on a fallback miss, and on the no-exemplar fallback) but **never sent**. `CheckResultDto` has no `scored`. `ReviewResultDto` does, and `RecallCard` already renders "Couldn't grade that right now, so it doesn't count."
- **Fallback feedback is a fake comment.** On a fallback, `feedback` is `Not quite — the expected answer was: …` or `Answer recorded (automatic grading was unavailable).` Today the lesson never renders `feedback`, so nobody sees it.
- **`ResultPanel`** (`LessonPlayer.tsx`) shows `Correct!`/`Not quite.`, then `Answer: <correctAnswer>` on a miss, then the explanation. It sits in the pinned footer with `maxHeight` 45% of the window and scrolls inside itself. It never renders `feedback`.
- **The score** is `score + (correct ? 1 : 0)` over `lesson.checks.length`. Completion (`api.completeLesson(slug)`) sends no score, so the score is display only.
- **`Screen`** (`ui.tsx`) is a `ScrollView` plus a pinned footer, with no keyboard handling. The single-line box submits on Return. A multiline box can't: Return is a newline, and the Check button in the footer sits under the keyboard.
- **q17 in the held draft** (`tools/authoring/output/foundation-ja-ch17-l07.json`): `answerType: "typed"`, `grading: "open"`, six-sentence `correctAnswer` (stored as `exemplar` at publish), explanation, and the PM's amended rubric. The publisher writes no `choices` for an open check.

## Spike, 2026-11-22: q17 through the real runtime grader ($0, 14 Gemini calls)

Run 1: current `GRADING_SYSTEM` plus the amended rubric, one run per case.

| Case | Want | Rating | ms | Comment |
|---|---|---|---|---|
| full kana | pass | Good | 3140 | "Wonderful self-introduction that includes all the requested details clearly." |
| full rōmaji (same text) | pass | Good | 2958 | "Great self-introduction — all six parts are clear and correct." |
| mix (same text) | pass | Good | 744 | "Great self-introduction covering all the parts clearly and naturally." |
| missing from + job | pass | Hard | 1233 | "…but don't forget to include where you are from **and** what you do." |
| wrong particles (を twice) | pass | Hard | 2008 | "…use の instead of を for name possessive: わたしの なまえ." |
| greeting, name, closing (rōmaji) | pass | Hard | 2956 | "…remember to include your origin, profession, **and** something you like!" |
| same, kana | pass | Hard | 989 | "…try adding where you are from **and** what you like." |
| English only | miss | Again | 717 | "That was entirely in English — try translating your introduction into Japanese next time." |
| single word | miss | Again | 1852 | "That is just a single word — try writing a full self-introduction starting with はじめまして." |
| gibberish | miss | Again | 1233 | "That doesn't look like a Japanese self-introduction; try starting with はじめまして." |

- **Verdicts: 10 of 10 as wanted.** Kana, rōmaji and mix agree (P5). No kanji in any comment. No praise on a miss.
- **Latency 0.7 to 3.1 s.** The 12 s cap is not a practical risk at this length. No change.
- **Gap: 3 of 4 thin answers list two or three things to add.** Brief 3.2 and P4 allow one. The rubric already says "name the one part to add"; the model ignores it.

Run 2: the same four thin answers with a sharpened shared rule (section 1.4).

| Case | Rating | Comment |
|---|---|---|
| missing from + job | Hard | "Good greeting, name, likes, and closing; next time add where you are from, like あめりかじん です." |
| greeting, name, closing (rōmaji) | Hard | "Great greeting, name, and closing; next time try adding where you are from, like あめりかじん です." |
| same, kana | Hard | "Good greeting, name, and closing; next time try to add where you are from, like アメリカから きました." |
| wrong particles | Hard | "Great self-introduction; for liking something, use が instead of を like すし が すき です." |

**4 of 4 name exactly one thing.** The comments are not linguistically clean (あめりかじん in hiragana, untaught から きました). That is the accepted closed-beta risk: comments join the native-speaker sample (Blocker 6).

Scripts and raw output are throwaway, in the session scratchpad. The Tester's eval (section 4) is the evidence that counts.

---

# 1. Approach

## 1.1 The lesson payload says which checks are open (P7, and the panel's labels)

- `CheckDto` gains `open?: true`, present only on an open check.
- One helper decides it in both places: `isOpenCheck(format, data)` in a new `apps/api/src/checks/check-kind.ts`. It returns true when the format isn't `MULTIPLE_CHOICE` and `data.answer` isn't a non-empty string. `ChecksService.grade()` uses `!isOpenCheck(...)` instead of its inline `isClosed`, and `mapCheck()` uses it for the flag. Grading and display can't disagree about which checks are open.
- It gives nothing away: the answer, exemplar and rubric stay server-side.
- **Rejected:**
  - Inferring "open" in the app from a missing `choices` key. That's an accident of the publisher (closed checks get `choices: []`), and the seed lesson doesn't follow it.
  - Sending `grading: 'open' | 'closed'`. A two-value field for a one-value fact.

## 1.2 The grading response says whether it was judged, and carries only the model's comment (P1, P6)

- `CheckResultDto` gains `scored: boolean`, the same name and meaning as `ReviewResultDto.scored`. It is `graded.scored`, which `ChecksService` already computes. Closed checks are always `true`.
- `feedback` is sent only when the model wrote it (`gradedBy === 'ai'`). The fallback strings are not comments about the learner's writing. On a fallback that exact-matches the exemplar (scored, essentially impossible for q17) there is then no comment, and the panel shows the verdict and explanation.
- `correct` and `correctAnswer` are unchanged. The app reads `scored` first.
- The schedule is unchanged: an unscored result still goes through `enterSchedule` (brief 3.4).
- **Rejected:**
  - Forcing `correct: false` when unscored. It still claims a verdict, and the app would have to ignore it anyway.
  - A separate `status: 'right' | 'wrong' | 'ungraded'` field. `scored` already exists on the review result, and two names for one idea would drift.

## 1.3 The open-check result panel (P1, P3, P6)

`ResultPanel` takes `open: boolean` from `CheckBeat`. Order:

| State | Lines, top to bottom |
|---|---|
| Open, scored, pass | `Correct!` (green) → comment → explanation |
| Open, scored, miss | `Not quite.` (red) → comment → `One way to write it:` (label) → exemplar, kana as stored → explanation |
| Open, unscored | `Couldn't grade this right now, so it doesn't count.` (neutral hint style, no red or green) → `One way to write it:` → exemplar → explanation |
| Closed | Unchanged (B.2.b) |

- **Label: "One way to write it:"** It reads as an example, not a key, and it fits a sentence-writing task. The verdict copy and this label are user-facing copy; the PM may change them at review without changing this plan.
- No rōmaji line for the exemplar. `answerForms` is already null for open checks (closed typed only).
- The comment renders whenever `result.feedback` is present. Closed checks never carry one.
- **P1, in view without scrolling.** The verdict and comment are the first two lines of the panel, and the panel shows its top first. The panel may take 45% of the SE's 667 pt (about 300 pt). The verdict is about 24 pt and the longest spiked comment about 4 lines at body size. The exemplar (about 6 lines) and the explanation may need a short scroll inside the panel on a miss, which the brief allows. Nothing is truncated.
- **Score (P6).** `CheckBeat.onNext` reports `'right' | 'wrong' | 'ungraded'` instead of a boolean. `LessonPlayer` keeps `score` and `ungraded`, and `DoneScreen` gets `total = checks.length - ungraded`, so it reads "X of 16". If every check was ungraded, total is 0 and the screen shows its existing no-score line. The defensive "index past the end" path uses the same counts.

## 1.4 The shared grading prompt names one fix and agrees with the rating (P2, P4)

**Change `GRADING_SYSTEM` (`grading.prompts.ts`)**, not only the rubric.

- Replace the rule `Keep feedback to ONE short sentence: what was right, and the single most useful correction. Encouraging, never harsh.` with exactly the spiked text:

  ```text
  - Keep feedback to ONE short sentence: what was right, then at most ONE thing to add or fix. Never list several; if more than one is missing or wrong, name only the most useful one.
  - The feedback agrees with the rating: no praise when the rating is "Again", and never call the answer wrong when it is "Hard" or better.
  - Encouraging, never harsh.
  ```

- Append one few-shot example after the existing three:

  ```text
  Q: Introduce yourself in Japanese: a greeting, your name, and what you do.
  Answer: hajimemashite. sam desu.
  Exemplar: はじめまして。サム です。がくせい です。
  → {"rating":"Hard","feedback":"Good greeting and name; next time add what you do, like がくせい です."}
  ```

- **Why shared, not rubric-only.** The rubric already asks for one fix and the model ignored it 3 times in 4. "One fix" is brief 3.2's general rule and what the existing shared rule meant. Reviews and practice grade meaning answers with the same prompt and benefit too (brief 5 allows it).
- **Cost.** The existing recall eval (`authoring:grader-check`, 13 cases × 3 runs) must still pass. Free tier, about 3 minutes.
- **Kana-only comments stay in the rubric** (the PM's amendment). Reviews of kanji vocabulary can fairly mention kanji, so it isn't a shared rule. The eval checks it mechanically for q17.
- **Rejected:**
  - Rubric-only. Spiked: ignored.
  - Splitting the schema into `praise` and `fix` fields. It changes a contract shared with reviews and practice to fix wording.
  - Converting kanji in a comment to kana with kuromoji as a backstop. A wrong reading (日本 as にっぽん, 何 as なに) in a learner-facing line is worse than a kanji. 0 of 14 spiked comments had kanji.
  - Retrying the model when a comment breaks a rule. It doubles latency for a rare event.

## 1.5 A repeatable open-check eval (P2, P4, P5)

- New committed fixture `apps/api/data/curriculum/open-check-cases.json`. Each entry: `lessonId`, `checkId`, `name`, `answer`, `expect` (`accepted` | `rejected`), optional `pair` (cases with the same `pair` must agree: P5), and `kanaFeedback: true` for q17 cases. It holds the 10 spiked answers above. They're invented, with no real names.
- `authoring:grader-check --open --draft <path-to-lesson.json>` grades each case for that lesson's check, using the draft's prompt, `correctAnswer` (as exemplar) and rubric, 3 runs each with the existing 4.5 s pause. It reads the draft rather than a copy of the rubric, so the eval can't drift from the lesson.
- A case passes when every run is AI-graded and agrees with `expect`, and with `kanaFeedback` no comment contains kanji. A `pair` fails if its cases disagree. It prints every rating and comment so the Tester can judge "one thing" and "agrees with the verdict" by reading, which no regex can.
- It reuses the shape of `runGraderCheck`. Without `--open` the command behaves exactly as today.
- **Rejected:** an ad hoc script by the Tester. The next prompt or model change (Blocker 9, paid tier) needs the same check.

## 1.6 The answer box shows the whole introduction (P7)

For an open check only, `CheckBeat` renders:
- `multiline`, `scrollEnabled={false}` (the box grows with the text and the screen scrolls, with no nested scroller), `minHeight` of about 6 lines (≈150 pt), `textAlignVertical="top"`. Return inserts a newline. It does not submit, so a half-written introduction can't be sent by accident.
- **Keyboard:** `Screen` gains an opt-in `avoidKeyboard` prop that wraps it in a `KeyboardAvoidingView` (iOS `padding`, with the header offset if the lesson screen has one). The pinned footer, and so the Check button, then sits above the keyboard. On focus and on content-size change the scroll view scrolls to the end, so the box stays in view while typing. `CheckBeat` passes it for open checks.
- Closed typed checks keep the one-line box and submit on Return, unchanged.
- **Fallback if `KeyboardAvoidingView` misbehaves on the SE simulator:** no keyboard avoidance, and `submitBehavior="blurAndSubmit"` with `returnKeyType="done"`. Return then only dismisses the keyboard (no `onSubmitEditing` handler for open checks), which reveals Check. Record which one shipped in `dev.md`.
- **Rejected:**
  - Return submits. A learner pressing Return for a new sentence would send half an introduction.
  - A fixed-height box that scrolls inside itself. You can't see the whole introduction.
  - Keyboard avoidance on every `Screen`. It's untested on other screens; opt-in keeps the change to this check.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/src/checks/check-kind.ts` (new) | `isOpenCheck(format, data)` |
| `apps/api/src/checks/checks.service.ts` | Use `isOpenCheck`. Return `scored`. Send `feedback` only when `gradedBy === 'ai'` (pass `gradedBy` out of the private `gradeOpen`) |
| `apps/api/src/lessons/lesson.mapper.ts` | `open: true` on open checks |
| `packages/types/src/index.ts` | `CheckDto.open?: true`. `CheckResultDto.scored: boolean`. Doc comments say what each means |
| `apps/api/src/grading/grading.prompts.ts` | Rule lines and one few-shot example (1.4). Update the header note: re-checked 2026-11-22 |
| `apps/api/src/authoring/grader-check.ts` | `--open --draft <path>` mode, `runOpenCheckCases()`, pair and kana-feedback checks |
| `apps/api/data/curriculum/open-check-cases.json` (new) | The 10 labelled q17 answers |
| `apps/mobile/src/lesson/LessonPlayer.tsx` | `ResultPanel` open states (1.3). `onNext` outcome. Score excludes ungraded. Multiline box for open checks (1.6) |
| `apps/mobile/src/ui.tsx` | `Screen` opt-in `avoidKeyboard` (1.6) |

No new dependencies. The content (rubric) is already amended by the PM in the held draft.

---

# 3. Data

- **No schema change, no migration, no change to any live row.** `open` is computed from `Check.format` and `Check.data` on each request; `scored` is computed on each grade.
- **Lesson 120 is published by the Lead after merge**, through the existing path: `EDITOR=true pnpm --filter api authoring:review foundation-ja-ch17-l07`, then `authoring:publish foundation-ja-ch17-l07`. That is additive (a new lesson, its 17 `Check` rows and `LessonItem` links). The gate runs again on the amended rubric.
  - **Rollback:** a content fault is fixed by hand and republished (the routine path, which replaces the lesson's `Check` rows). Removing the lesson deletes live rows, so it is on the stop list (item 3) and not part of this plan.
- **For the Tester's simulator and API runs** lesson 120 must exist in a database before merge. Steps:
  1. The Lead runs the `authoring:review` step (local file only; the PM has already approved).
  2. The Lead creates a throwaway Neon branch from the main session.
  3. The Tester publishes 120 **to that branch only**, with `DATABASE_URL` set to the branch's direct URL ahead of `--env-file`; the environment wins over the file.

  Never the default branch: the Alpha run needs it clean.

---

# 4. Promise map

Test locations:
- **Jest** means unit tests in `pnpm test`, in CI.
- **Eval** means `authoring:grader-check --open --draft tools/authoring/output/foundation-ja-ch17-l07.json` from the main checkout. Real Gemini, free tier, 30 calls. The Tester pastes every rating and comment into `test.md`.
- **Tester-sim** means `Sensei 22a SE3` against the PR build and the throwaway branch, with screenshots in `test.md`.
- **Tester-API** means `POST /checks/:id/answer` on a local API against the throwaway branch.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P1** One-sentence comment with the verdict, no tap, both in view without scrolling on SE; explanation there too | 1.2 `feedback` from the model. 1.3 panel order, comment second, no truncation | <ul><li>Jest `checks.service.spec.ts`: an AI-graded open check returns `feedback` and `scored: true`; a closed check returns no `feedback`</li><li>Tester-sim: q17 answered with a full introduction and with the thin one. Screenshot untouched after the result: verdict and whole comment visible, explanation reachable in the panel. Use the longest comment the eval produced</li><li>Mobile typecheck and `expo export` bundle check</li></ul> |
| **P2** Comment agrees with the verdict, kana or rōmaji only, never "stop using rōmaji" | 1.4 shared rule and the PM's rubric | <ul><li>Eval: no kanji in any q17 comment (mechanical); the Tester reads all 30 comments for praise on a miss, "wrong" on a pass, or a push to kana, and records each in `test.md`</li><li>Jest `grading.prompts` spec: the system prompt carries the agree-with-rating and one-fix rules</li></ul> |
| **P3** A missed introduction shows the model introduction as one example | 1.3 `One way to write it:` label on open checks, never `Answer:` | <ul><li>Tester-sim: q17 answered `sushi`. Screenshot shows "Not quite.", the comment, "One way to write it:" and the kana exemplar, and no "Answer:"</li><li>Tester-sim: q17 passed shows no example</li></ul> |
| **P4** A short real introduction passes and the comment names one thing; non-introductions miss | 1.4 rule + rubric (pass rule) | <ul><li>Eval: greeting + name + closing (kana and rōmaji) and missing-two pass in 3 of 3 runs; English, single word and gibberish miss in 3 of 3. The Tester confirms every thin-answer comment names exactly one thing</li><li>`authoring:grader-check` (recall set, 13 cases) still passes after the prompt change</li></ul> |
| **P5** Same verdict in rōmaji, kana and mix | Rubric + shared rule "Accept rōmaji, kana, or kanji forms" (unchanged) | Eval `pair` checks: full kana / rōmaji / mix agree in every run; thin kana / rōmaji agree |
| **P6** Ungraded: plain message, example and explanation, no verdict, left out of the score | 1.2 `scored` + no fallback comment. 1.3 unscored state + score count | <ul><li>Jest `checks.service.spec.ts`: LLM disabled with exemplar → `scored: false`, no `feedback`; no exemplar → `scored: false`, no `feedback`; blank answer → `scored: true`. Item still enters the schedule (`seedInferred` called)</li><li>Jest `lesson.mapper.spec.ts`: `open: true` only on an open check; no `answer`, `exemplar` or `rubric` key in any `CheckDto`</li><li>Tester-API with `GEMINI_API_KEY` empty: q17 returns `scored: false`, no `feedback`</li><li>Tester-sim with `GEMINI_API_KEY` empty: q17 shows the notice, example and explanation, no "Correct!"/"Not quite.", no red or green; the end screen says "of 16"</li></ul> |
| **P7** The whole introduction is visible while writing and editable before submit | 1.6 multiline box with keyboard avoidance | Tester-sim: type the full rōmaji introduction from the eval (about 150 characters) with the keyboard up. Screenshot shows all of it, then move the cursor into the middle and fix a word, then submit with Check. A closed typed check (lesson 19) still submits on Return |
| **P8** Lesson 120 is the last lesson of chapter 17 and completes | Section 3 publish (Lead, after merge) | <ul><li>Tester on the branch: the curriculum lists 120 last in chapter 17; a full run reaches "Lesson complete" and the completion saves</li><li>The Lead confirms the live publish output; Alpha scores it on the default branch</li></ul> |

---

# 5. Risks

| Risk | What would show it |
|---|---|
| The prompt change shifts verdicts on review meaning answers | The recall eval (13 cases × 3) fails. If it does, keep the new rules in the q17 rubric only and log why |
| A comment contains kanji or untaught Japanese (spiked: あめりかじん, から きました) | Eval's kanji check; the Tester's reading. Accepted closed-beta risk; comments are in the native-speaker sample (Blocker 6) |
| The model drifts back to listing several fixes | Eval comments. Re-run the eval on any model or prompt change |
| Free-tier rate limit (15/min) during the eval or Alpha | `GRADING_DEGRADED reason=rate_limited` in the API log; the eval marks the case "fell back". Re-run; Blocker 9 removes the limit |
| `KeyboardAvoidingView` offset wrong under the lesson header, so the box or Check is hidden | Tester-sim P7 screenshot. The fallback in 1.6 |
| An old app build against the new API | Not a real case (no store build). New fields are additive; an old build behaves as today |
| Grader timeout at 12 s | Spiked max 3.1 s. A timeout would show the honest "couldn't grade" (P6), not a false miss |

---

# 6. Tasks (one Developer pass, one PR, in this order)

1. **T1 Contract.** `check-kind.ts` and `isOpenCheck`. `CheckDto.open`, `CheckResultDto.scored`. `ChecksService`: `scored`, AI-only `feedback`. `mapCheck` flag. Specs as in the P1, P6 rows.
2. **T2 Prompt.** The rule lines and few-shot example in `grading.prompts.ts`, exactly as in 1.4, with a spec that pins them.
3. **T3 Eval.** `open-check-cases.json` (the 10 spiked answers, pairs and expectations) and `grader-check --open --draft`, with a spec using a fake grader for the pair, kana and fallback rules. Run it once against the real grader from the main checkout and paste the summary into `dev.md`. Also run the existing recall eval.
4. **T4 App.** `ResultPanel` open states, `onNext` outcome and score, multiline box, `Screen.avoidKeyboard`. Run `pnpm --filter mobile typecheck`, then `expo export --platform ios` (per `PROJECT.md`). Take an SE simulator screenshot of a q17 miss for `dev.md`, against a local throwaway branch with 120 published (section 3).
5. **T5** Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high`, then open the PR. Record any deviation from this plan in `dev.md`.

**Not to be touched:** "Try again" after "couldn't grade", the chapter test "To review" list, open checks in other lessons, the 6,000-character 500 (brief 5).
