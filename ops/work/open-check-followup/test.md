# Test: what an open lesson check tells me after I answer

Unit `open-check-followup`. Written by the Tester, 2026-11-23 (started 2026-11-22; the first session died mid-run and everything was re-run in the second). PR [#91](https://github.com/amshahed/sensei/pull/91), branch `feat/open-check-followup`.

# Verdict: PASS, on `7d137ef` (`7d137efa0df7afb3bdabc49085a5d178b99469b5`)

- Every promise P1 to P8 holds on the evidence below, with stated gaps. Nothing in the diff is wrong.
- **Three things the PM must decide or schedule. None of them is a code defect in this PR:**
  1. **F4. Course-wide, the right multiple-choice option is listed first in 652 of 668 checks, and nothing shuffles them.** That's every multiple-choice check in lesson 120 and 640 of 656 elsewhere. A learner who always taps the top option scores about 98%. It existed before this PR and the diff doesn't touch it. It needs its own unit, at high priority.
  2. **F1. The grader sometimes names two fixes, and twice (both in the Developer's runs, none in mine) gave a wrong correction.** That's on the two-slip "wrong particles" answer. My recommendation: **don't block publishing lesson 120** on it (section 3, F1/F2). The PM decides.
  3. **F5. Gemini's free tier was flaky during this test.** 25 of 99 eval calls and 2 of 6 app submissions fell back, 9 of them on the 12 s timeout. P6's honest notice worked every time. The Alpha walker will probably see it.

---

# 1. Evidence

All runs from my own detached worktree `.claude/worktrees/test-open-check` at `7d137ef`. Lesson 120 was on the throwaway Neon branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`) only. I used it through `DATABASE_URL` in the environment and never touched the default branch. Screenshots and logs are in `test-shots/` (secret-scanned: no URLs, keys or passwords).

## 1.1 Verification

| Command | Result |
|---|---|
| `pnpm typecheck && pnpm lint && pnpm test` | First run was all Turbo cache hits (replayed logs), so I re-ran with `turbo run … --force`: **typecheck 4/4, lint clean, 63 suites, 1,472 tests pass, 0 cached** |
| CI `verify` on #91 | SUCCESS |
| `nest build` (API) | Clean. Used for the API runs below |
| Expo bundle | Metro bundled the app for iOS in Expo Go on SE3 (runtime proof below). I didn't re-run `expo export`: no dependency changed |

## 1.2 Tester-API (local API from the PR, dev-stub auth, user `tester-91-api`, grader off: `GEMINI_API_KEY` empty)

| Request | Result |
|---|---|
| `GET /lessons/foundation-ja-ch17-l07` | 17 checks. `open: true` only on position 16 (q17), with keys `id, position, prompt, format, targetItemId, open`. No check has an `answer`, `exemplar`, `rubric`, `explanation` or `data` key. The rubric text appears nowhere. The model introduction appears only in the Teach blocks (10 and 12), by design |
| q17, `hajimemashite. samu desu. yoroshiku onegaishimasu.` | `correct:false, scored:false`, **no `feedback`**, `correctAnswer` = model introduction, `explanation` present |
| q17, the exact model introduction | `correct:true, scored:true`, no `feedback` (fallback exact match) |
| q17, `"   "` | `correct:false, scored:true`, no `feedback` |
| Closed typed, position 3, `x` | `correct:false, scored:true`, `answerForms` present, no `feedback` |
| Multiple choice, position 0 | `correct:true, scored:true` |
| `ItemMasteryState` for `tester-91-api` | The `ja:grammar:です` row was created at the ungraded submit, so the item entered the schedule unscored (brief 3.4) |

Branch data (read-only SQL): q17's stored prompt, exemplar, rubric (with the PM's amendment) and explanation match the draft file `tools/authoring/output/foundation-ja-ch17-l07.json` (identical to `published/`). The only `TYPED` check without an `answer` course-wide is q17, so `open` lands on exactly one check. The branch has no `SPOKEN` checks.

## 1.3 Simulator evidence (`Sensei 22a SE3`, Expo Go, iOS)

**Method.** This is the one `check-explanation/test.md` 1.2 used. Nothing here can tap or type in the simulator, so I drove it with a throwaway harness in my worktree. It was never committed, and it's reverted now: `git status` is clean at `7d137ef`. The harness:
- opened lesson 120 as the app's first flow, through the real `AuthGate`, `OnboardingGate` and `SafeAreaView`;
- either jumped to q17 or auto-continued Teach and Practice;
- had `CheckBeat` set its answer through `setTyped` and submit through its own `submit()`;
- for P7, focused the open box (`autoFocus`), "typed" one character every 8 to 40 ms through `setTyped`, then moved the cursor (`selection`) and replaced a word;
- in one layout-only case (G4), replaced the grader's comment with the longest comment any run produced.

`ResultPanel`, `Screen`/`KeyboardAvoidingView`, the network call, `Keyboard.dismiss()`, scoring and `DoneScreen` all ran unchanged against the real API. Each shot is `xcrun simctl io screenshot`, with nothing touching the screen. A web build wasn't possible: the app has no `react-native-web` dependency. The blue gear is Expo Go's dev "Tools" overlay, not the app.

To get past `OnboardingGate`, the dev user's intake was completed on the throwaway branch (`POST /onboarding/intake`).

| Shot | API mode | Scenario | What it shows |
|---|---|---|---|
| `u1a-q17-ungraded-top.png` | grader off | q17, thin rōmaji intro | **"Couldn’t grade this right now, so it doesn’t count."** in grey semibold, with no red or green. Then **"One way to write it:"**, the kana-only model introduction and the explanation. All in view, no verdict word, no "Answer:" |
| `g2x-real-503-ungraded.png` | **grader on, real Gemini 503** (`GRADING_DEGRADED reason=provider_error`, 18:51:34) | q17, thin rōmaji intro | The same honest notice from a real outage, not a simulated one |
| `u2a-teach.png`, `u2b-practice.png`, `u2c-closed-typed-pos3.png`, `u2d-done-of-16.png` | grader off | Full auto-run: Teach → Practice → all 17 checks (multiple choice: first option; closed typed: `x`; q17: thin intro, ungraded) | Teach renders ("Writing your introduction"). The closed typed check keeps its **one-line box**. The end screen reads **"Lesson complete. You got 12 of 16 right."**: q17 is left out, and the 12 are all multiple choice (see F4). The `LessonCompletion` row for `dev-user` / lesson 120 was written on the branch |
| `p7a-typed-keyboard-up.png` | grader off | The full rōmaji intro (141 characters, with the typo `gakusee`) typed with the keyboard up | **All five lines of the introduction are visible in the box. The box sits above the Check button, and Check sits above the keyboard.** The prompt scrolled up out of the way. The caret is at the end |
| `p7b-cursor-mid.png`, `p7c-edited.png` | grader off | Cursor moved to the typo, `gakusee` → `gakusei` | The fix appears in place, and the view stays put |
| `p7d-after-submit.png` | grader off | Submitted with the keyboard up | Keyboard dismissed. The result panel and Finish are in view. The typed text stays in the box |
| `x1a/x1b/x1c-long-*.png` | grader off | Edge case: a 425-character answer, then an insert near the top | The box grows and the screen scrolls, with no inner scroller. After the edit near the top, iOS keeps the caret in view, so the scroll-to-end on content growth didn't hide it (I suspected it would; it doesn't). Check stays above the real keyboard |
| `g1a-sushi-miss-top.png` | grader on | q17 = `sushi` | **"Not quite."** (red), then the model comment "That is just a single word — try writing a full self-introduction including a greeting and your name.", then "One way to write it:", the kana example and the explanation. No "Answer:". The panel is at its 45% cap (the harness scrolled it at +6 s, and it still shows the verdict at the top) |
| `g2-thin-romaji-pass.png` | grader on | q17 = `hajimemashite. samu desu. yoroshiku onegaishimasu.` | **"Correct!"** (green), then "Good greeting, name, and closing; next time add where you are from, like あめりかじん です." and the explanation. **No example** on a pass. Verdict and comment fully in view, untouched |
| `g3-wrong-particles.png` | grader on | q17 = the を-twice introduction | "Correct!", then "Almost all parts are correct; just change を to の in わたし の なまえ and が in ねこ が." (**two fixes**, F1) and the explanation. All in view |
| `g4-layout-longest-comment-miss.png` | grader on, **comment injected (layout only)** | q17 = `sushi`, with the comment replaced by the longest any run produced (112 characters, dev.md run 1: "That is just a food item — try writing a short self-introduction including a greeting, your name, and a closing.") | The tallest panel: "Not quite." and the whole 3-line comment at the top, in view without scrolling. Then the label, the 4-line example and the 4-line explanation, with nothing cut off |

## 1.4 Evals (real Gemini 3.5 Flash-Lite, free tier, $0)

Commands, run from my worktree with `--env-file` pointing at the main `.env`:
- `grader-check.ts --open --draft <abs>/tools/authoring/output/foundation-ja-ch17-l07.json`
- `grader-check.ts --source …/jmdict-eng-3.6.2.json`

Full output is in `test-shots/eval-open.log`, `eval-open-run2.log` and `eval-recall.log`.

### Open-check eval, run 1: 2 of 10 (exit 1). Every failure is a fallback, not a disagreement

9 of 30 calls fell back: 7× Gemini `503 high demand` and 2× the 12 s timeout. **All 21 model-graded runs agreed with `expect`.**

| Case | Want | Model ratings (fallbacks omitted) | Model comments |
|---|---|---|---|
| full, kana | pass | Easy, Easy (+1 fallback) | "Flawless self-introduction — everything is clear, natural, and complete." · "Wonderful self-introduction, everything is clear and naturally written." |
| full, rōmaji | pass | Good (+2 fallbacks) | "Wonderful self-introduction that covers all six required points clearly." |
| full, mix | pass | Good, Good, Good | "Wonderful self-introduction that includes all six required parts clearly." ×2 · "Great self-introduction with all the required details included clearly." (reported FAIL only through the pair rule: F3) |
| missing from + job | pass | Hard, Hard (+1) | "Good greeting, name, likes, and closing; next time add where you are from, like アメリカじん です." · "Great self-introduction; next time add where you are from, like アメリカじん です." |
| wrong particles | pass | Hard ×3 | "Almost all parts are correct; just change を to の in わたし の なまえ and が in ねこ が すき." · "…を to の in わたし の なまえ and が in ねこ が." (**both name two fixes**) · "…just change を to の in わたし の なまえ は." (one fix) |
| thin, rōmaji | pass | Hard, Hard (+1) | "Good greeting, name, and closing; next time add where you are from, like あめりかじん です." · "…like america jin desu." |
| thin, kana | pass | Hard, Hard (+1) | "Good greeting and name; next time add where you are from, like アメリカから きました." · "Good greeting, name, and closing; …like あめりかじん です." |
| English only | miss | Again (+2) | "That's in English — try translating your introduction into Japanese next time." |
| single word | miss | Again, Again (+1) | "That's just a food word — please write a full self-introduction including a greeting, your name, and more." ×2 |
| gibberish | miss | Again ×3 | "That doesn't look like Japanese — try starting with はじめまして." · "That is not a Japanese self-introduction; …" · "That doesn't look like a Japanese self-introduction; …" |

### Open-check eval, run 2

**3 of 10 (exit 1). Every failure is again a fallback.** 12 of 30 calls fell back: 8× 503 and 4× 12 s timeout. **All 18 model-graded runs agreed with `expect`.** The wrong-particles case fell back on all 3 runs, and English only on all 3.
- Full kana: Easy ×3. Rōmaji: Easy and Good. Mix: Good. Each reads as "Flawless/Wonderful self-introduction … all six parts …".
- Missing from + job: Hard ×3. Thin rōmaji: Hard ×3. Thin kana: Hard ×3.
- Every thin or missing comment names one thing: "…next time add where you are from, like アメリカじん です" (or あめりかじん です, or アメリカから きました).
- Single word: Again ×2 ("That's just a food word — …", "That is just a single word—…"). Gibberish: Again ("That doesn't look like Japanese — let's try a greeting like はじめまして…").

**Across both runs, per case (model runs / agreeing):**
- full kana 5/5, full rōmaji 3/3, full mix 4/4;
- missing parts 5/5, wrong particles 3/3;
- thin rōmaji 5/5, thin kana 5/5;
- English only 1/1 (the Developer's runs add 6/6), single word 4/4, gibberish 4/4.

No case has a model run against `expect`. A clean single 10 of 10 run (as the Developer had in dev.md run 2) wasn't possible today because of provider errors.

### Recall eval (13 cases × 3): 9 of 13 (exit 1). Every failure is a fallback

4 of 39 calls fell back: 1× 503, 3× 12 s timeout. **All 35 model-graded runs agreed with `expect`**, including か "because" rejected 2 of 2. The failures were すみません, も, ませんか and か, one fallback each. Together with the Developer's two runs (dev.md 3), no model-graded run in about 110 has disagreed. There has still never been a clean 13 of 13 run, only because of provider errors.

### Reading every comment (P2, P4)

- **Kanji:** 0 kanji in all 43 model comments on q17 (39 from the two eval runs, 4 from the app). The tool only checks kanji once a case's verdict passed, so I checked all comments myself.
- **Praise on a miss:** none. Every "Again" comment names what's wrong and suggests a start.
- **"Wrong" on a pass:** none. The two-slip pass opens "Almost all parts are correct".
- **Push to kana:** none.
- **One thing (short introductions, P4):** every model comment on the thin and missing-parts answers names exactly one thing (where you're from). That's in both runs, in the app (g2) and in the Developer's runs.
- **One thing (two-slip answer):** broken; see F1.
- **Untaught or unidiomatic Japanese in comments:** あめりかじん in hiragana, アメリカから きました, `america jin desu`. That's the accepted closed-beta risk (brief 5, Blocker 6).

---

# 2. Promises

| | Status | How checked |
|---|---|---|
| **P1** A one-sentence comment with the verdict, no tap, both in view without scrolling on SE; explanation there too | **Holds on the simulator** (harness submit) | g1a, g2, g3 and g4 on SE3, untouched after the result. The verdict is the first line and the comment the second, in view, including the longest comment ever produced on the tallest panel (g4, injected for layout). The explanation is in the panel every time. API: `feedback` only on a model grade (1.2, plus Jest). Not seen: a real tap on Check (section 4) |
| **P2** The comment agrees with the verdict; Japanese only in kana or rōmaji; never "stop using rōmaji" | **Holds** on every comment observed: 43 model comments across the evals and app runs | Section 1.4 reading. The shared rule is pinned by `grading.prompts.spec.ts`. **The wrong correction the Developer saw ("change を to は in わたし は なまえ は", 2 of 3 runs of one case in dev.md run 2) doesn't break P2's wording.** It agrees with the verdict, it's in kana, and it doesn't push kana. It's a linguistic-correctness failure, which brief 5 puts out of scope (F2). It didn't recur in my 4 model-graded runs of that answer (3 in eval run 1, 1 in the app); eval run 2 fell back on all three |
| **P3** A missed introduction shows the model introduction as one example, not "the answer" | **Holds on the simulator** | g1a and g4: "One way to write it:" plus the kana-only example, with no "Answer:" and no rōmaji line. g2 and g3 (passes): no example. u1a (ungraded): the example is shown, as brief 3.4 asks |
| **P4** A short real introduction passes and the comment names one thing; non-introductions miss | **Holds**, with F1 on a longer two-slip answer | Thin (kana and rōmaji) and missing-parts answers: Hard with exactly one thing in every model run of both evals, and in g2. English only, a single word and gibberish: Again in every model run. Recall eval: every model run as wanted. **Brief 3.2's "at most one thing" breaks on the two-slip answer** (F1) |
| **P5** Same verdict in rōmaji, kana and mix | **Holds on model-graded runs** | full kana, rōmaji and mix: accepted in every model run of both evals. thin kana and rōmaji: accepted in every model run. The tool's pair FAILs in run 1 come from fallback runs being counted (F3), not from any script getting a different model verdict |
| **P6** Ungraded: plain message, example and explanation, no verdict, left out of the score | **Holds** (API and simulator, including a real outage) | API with the grader off: `scored:false`, no `feedback` (1.2). u1a: the notice, example and explanation, with no "Correct!", "Not quite.", red or green. g2x: the same from a real Gemini 503. u2d: "12 of 16". The schedule entry was written (1.2) |
| **P7** The whole introduction is visible while writing, and editable before submit | **Holds on the simulator** (text driven by the harness, not keystrokes) | p7a: all of the 141-character intro is visible with the keyboard up, with Check above the keyboard. p7b and p7c: a mid-text fix, with the view stable. p7d: submit dismisses the keyboard. x1a to x1c: a 425-character answer still works. **Not exercised:** real keystrokes, a real tap to place the cursor, the Return key inserting a newline (section 4) |
| **P8** Lesson 120 is the last lesson of chapter 17 and completes | **Holds on the throwaway branch** | SQL: 120 is position 7, the last lesson of "Likes and self-introduction", which is chapter 17, the last chapter. The branch has 108 lessons. u2a to u2d: a full run from Teach through all 17 checks to "Lesson complete", and the completion row saved. The live publish is the Lead's after merge, and the Alpha run scores it on the default branch |

---

# 3. Findings

Severity: High means a learner is hurt or data is wrong. Medium means real breakage outside the learner path. Low means an edge case or inconsistency. Info means no action is needed in this PR.

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| **F1** | Low (model behaviour, not code) | `apps/api/src/grading/grading.prompts.ts:35` (rule), rubric of q17 | On the two-slip answer (を twice), the comment names two fixes. That happened in **2 of 3 model runs in my eval run 1, 1 of 1 in the app (g3)**, and 1 of 3 in each of the Developer's runs. Eval run 2 had no model run of this case (3 fallbacks). This breaks brief 3.2's "at most one thing to add or fix". Short and missing-part introductions are fine | **Not fixed. Justified for merge:** the code ships exactly the planned prompt (tech.md 1.4), and tech.md's risk table names this ("the model drifts back to listing several fixes"). The comment is still short, correct and agrees with the verdict. **PM:** accept it for closed beta, or ask the Tech Lead for a rubric or prompt tweak and an eval re-run (no code) |
| **F2** | Low for merge; **PM call for publishing** | Grader output on q17 | The Developer's eval run 2 had "change を to は in わたし は なまえ は" in 2 of 3 runs. That's ungrammatical: the fix is わたし **の** なまえ. Not reproduced in my 4 model-graded runs of that answer: all said を → の correctly. | **Not fixed. Out of scope** (brief 5: a comment's linguistic correctness; Blocker 6). **My recommendation: don't block publishing lesson 120.** It needs the specific を-for-の slip. It was seen in 2 of 10 model runs of that one input that I know of: the Developer's 6 and my 4. On that pass the explanation, shown just below the comment, spells out the right pattern ("わたし の なまえ は ... です"). Closed beta is dev users until Blocker 9 and M.5 clear. Add grader comments on particle slips to the native-speaker sample. If the PM wants a mitigation, a rubric line fixing the name pattern is content, not code |
| **F3** | Low | `apps/api/src/authoring/grader-check.ts:277-285` | The P5 pair rule counts fallback runs (`correct:false` from the deterministic fallback) as verdicts. A 503 on one member then marks every member of the pair FAIL with `pair "full" got different verdicts`. In run 1, "full, mix" had three agreeing model runs and was still reported FAIL. It can't produce a false PASS (the fallback member already fails), but the reason misleads whoever reads the eval | **Not fixed. Justified:** it only affects the eval's wording, never the product. Developer backlog: count only `gradedBy === 'ai'` runs toward pair agreement |
| **F4** | **High, pre-existing, outside this diff** | Lesson content (`Check.data.choices`), `lesson.mapper.ts` (no shuffle), `LessonPlayer.tsx` `CheckBeat` (renders in order) | **The right answer is the first choice in 652 of 668 multiple-choice checks on the branch** (all 12 in lesson 120, and 640 of 656 in the other 107 lessons, copied from the default branch). Neither the API nor the app shuffles. My harness tapped the first option in every multiple-choice check of lesson 120 and got 12 of 12 right (u2d). A learner who notices this can pass every lesson without reading. No decision, issue or code mentions shuffling (searched `decisions.md`, `ops/`, GitHub issues, `apps/`) | **Not fixed. Justified for this merge:** it existed before this PR, and this PR neither causes nor worsens it (lesson 120 matches the rest). **Lead/PM: new unit, high priority, before the Alpha run scores lessons.** Shuffling choices server-side per request, or in the app, keeps answers server-side |
| **F5** | Info (infrastructure) | Gemini free tier | During this test: open eval run 1 had 9 of 30 fallbacks, run 2 had 12 of 30, the recall eval 4 of 39, and the app 2 of 6 graded submissions. In total that was **nine 12 s timeouts and 18 provider errors (503 high demand)**. tech.md's spike saw a 3.1 s maximum and no timeouts. Brief 6 asked to measure. On the free tier the honest "couldn't grade" notice (P6) will be common, and the Alpha walker may see it on q17 | **Accepted risk, no code change:** the product behaves correctly (P6) every time. Blocker 9 (paid tier) is the fix. Re-run the evals at a quieter time, or after Blocker 9, to get a clean single run |
| I1 | Info | `apps/mobile/src/ui.tsx:72` | Android: `behavior` is undefined (dev.md review 1) | Out of plan (iOS only). Already in the PM backlog in dev.md 6 |
| I2 | Info | `GradingService.fallback` | Reviews and Practice still show the fallback's "Not quite — the expected answer was…" next to "Couldn't grade" (dev.md review 3) | Out of scope (brief 5). Already in the PM backlog in dev.md 6. The lesson path is clean: `feedback` only from the model |
| I3 | Info | `ResultPanel` | After a result the answer box sits mostly under the panel (u1a, g1a). The learner's introduction is behind the panel, and the question area scrolls to it. P1 doesn't require it | No action |

Code review: I reviewed the diff line by line (`check-kind.ts`, `checks.service.ts`, `lesson.mapper.ts`, the types, `grading.prompts.ts`, `grader-check.ts`, `LessonPlayer.tsx`, `ui.tsx`). Beyond F3, nothing found:
- grading and the payload share `isOpenCheck`;
- `scored` and AI-only `feedback` are correct on every fallback path;
- a blank answer stays a scored miss;
- the closed `ResultPanel` branch renders exactly as before (the rōmaji line only moved inside it);
- `CheckBeat` is keyed by check id, so its state doesn't leak between checks;
- the tally handles every check being ungraded (total 0 → the existing no-score line);
- `KeyboardAvoidingView` offset 0 is right on SE (p7a). Its parent is the `SafeAreaView` through fragment-only gates, so the measured frame includes the status bar inset.

I didn't run `/code-review high` myself: usage is tight and this unit forbids sub-agents. The Developer's run (8 findings, dev.md 5) was checked against the code, and I agree with each disposition.

---

# 4. Not verified

- **Real keystrokes, taps and the Return key.** The harness sets text and submits in code. Not seen:
  - a finger placing the cursor;
  - Return inserting a newline in the open box;
  - Return still submitting a closed typed check (lesson 19). The code is unchanged there: `onSubmitEditing` is kept on the closed input.
  
  The Alpha walk types for real (brief 4).
- **iOS's first-run "slide to type" tip** covered the keys in p7a to p7c. The keyboard frame was the real one: Check sits above it. The x1 shots show the full keyboard with keys.
- **A full-introduction pass in the app.** That case was covered by the evals (Good or Easy), not on device, to save free-tier calls. g2 and g3 cover the pass panel.
- **Android, large accessibility text sizes, a physical device, Clerk auth.** iOS SE simulator, default text size, dev-stub auth only.
- **The live database.** By instruction, only the throwaway branch.

Side effects, all on the throwaway branch, none on the default branch:
- the dev user's intake was completed;
- mastery rows were written for `dev-user` and `tester-91-api`;
- a `LessonCompletion` row was written for `dev-user` on lesson 120.

The worktree `.claude/worktrees/test-open-check` was removed after the run.
