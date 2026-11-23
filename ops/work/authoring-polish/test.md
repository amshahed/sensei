# Test: authoring polish (P1 to P8)

Unit `authoring-polish`. Written by the Tester, 2026-11-23. PR [#95](https://github.com/amshahed/sensei/pull/95), branch `feat/authoring-polish`.

# Verdict: PASS, on `e541cb5` (`e541cb5d748dd4d092c12d6fffdd0ec0624ebfbc`)

- **Every promise P1 to P8 holds on the evidence below.** P1, P2, P3 and P8 were seen on `Sensei 22a SE3` against the throwaway branch. P4 to P7 were checked at $0, on the real outline and drafts.
- **The kanji apply on the throwaway branch changed exactly the nine rows and nine fields**, out of 1,625 `Item` rows. Both rollback paths restored every row exactly.
- **The two P4 deviations are right against the brief.** I accept both (section 4). The Tech Lead should still record them, because they change the text of tech.md 1.4.
- **No blocking findings.** There are three Low gaps in the new gate rules (F1 to F3), each with 0 hits in today's 214 drafts, plus Info items. All are justified in section 3.
- **The PM should know:** P4 changes nothing for the audio wave's targets. In the outline, every audio lesson only practises items taught earlier, so its "new" line is `(none)`.

---

# 1. Evidence

My own detached worktree `.claude/worktrees/test-95` at `e541cb5`. The database work used only the throwaway Neon branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`, not default, not protected). Its direct URL came from the Neon MCP and was used only through `DATABASE_URL` in the environment. Nothing touched the default branch. Screenshots and logs are in `test-shots/`, secret-scanned (no URLs, keys or passwords).

## 1.1 Verification

| Command | Result |
|---|---|
| `turbo run typecheck --force` | 4/4 tasks, 0 cached |
| `turbo run lint --force` | clean, 0 cached |
| `turbo run test --force` | **64 suites, 1,570 tests pass**, 0 cached |
| CI `verify` on #95 at `e541cb5` | SUCCESS |
| `nest build` | clean. That build is the API used below |
| iOS bundle | Metro bundled the app for Expo Go on SE3 (section 1.4). I didn't re-run `expo export`: the PR changes no dependency |

## 1.2 Kanji supplement on the throwaway branch (P1, P2 data; tech.md 3.2 to 3.4)

Each step was run from my worktree with `--source <main>/apps/api/data/sources/kanjidic2-en-3.6.2.json`. Before and after each step, a script recorded the content (`type`, `display`, `reading`, `meaning`, `data`) of all 1,625 `Item` rows and diffed them field by field.

| Step | Result |
|---|---|
| Backup | The tech.md 3.3 query, nine rows → `test-shots/kanji-rows-before-branch.json` |
| Dry run | **Exactly the nine rows and fields tech.md 3.1 names**: 校 `meaning` "exam" → "school", and `data.word_reading` added on 食 飲 読 書 行 来 見 聞. Then "9 of 103 N5 kanji rows would change; nothing written" (`kanji-dryrun-branch.log`) |
| Dry run writes nothing | All 1,625 rows were byte-identical afterwards, and the kanji `max(updatedAt)` was unchanged (2026-11-03) |
| `--dry-run` on another kind | `vocab --dry-run`, run with no `DATABASE_URL`, refuses with "only supported for kanji" before connecting |
| Apply | "upserted 103". Diff: **rows changed 9, fields changed 9**, exactly the dry run's list. Nothing else changed in 1,625 rows |
| Idempotent | A second dry run shows "0 of 103" |
| Beta kanji (P1) | 41 kanji are linked to lessons. **Only 校 differs from KANJIDIC2's first sense, and it now reads "school"**, as the PM's audit expects (brief 4.1; 分 "part", 間 "interval", 男 "male") |
| **Rollback, preferred** (3.4) | The supplement was emptied (temporarily, in my worktree only) and the ingest re-run. Its dry run listed the same nine rows in reverse. After the apply, the diff with the backup showed **rows changed 0** |
| **Rollback, alternative** (3.4) | After re-applying, a nine-row `UPDATE` from the backup file ran in one transaction. Diff with the backup: **rows changed 0** |
| Left state | Re-applied: nine rows changed versus before, so the app checks below ran against the supplement |

## 1.3 Tester-API (PR build, dev-stub auth, no model keys, against the branch)

P8 (`p8-api-count-run1.log`, `run2.log`). One `GET /lessons/:slug` per lesson, with the answers read from SQL:

| | Run 1 | Run 2 | Band |
|---|---|---|---|
| Lessons / multiple-choice checks served | 108 / 668 | 108 / 668 | |
| Answer served first | **164** | **147** | 112 to 222 (expected 167; 652 before this PR) |
| Slots 1 to 4 | 164, 153, 173, 178 | 147, 164, 186, 171 | |
| Answer missing, option set changed, or `answer` leaked | 0 | 0 | |

- **Lesson 120, 20 fetches:** the answer was on top 66 of 240 times (band 26 to 94). **Every one of the 12 checks showed its answer in all 4 slots.**
- **Top-tap score per fetch:** `2,7,5,2,4,7,2,2,5,2,6,1,3,4,3,1,3,2,4,1`, mean 3.3. Two fetches scored 7, which is chance: P(≥7) is about 1.4% per showing and the total is on expectation.
- **Stored order is never written:** after all the GETs, the DB still has 652 checks with the answer authored first.

P3, from the same pass:
- 390 example blocks with a reading; 299 hidden, 91 kept (57 of those are kana examples with a rōmaji reading, such as `こえ / koe`).
- **0 kanji examples lost their reading.**

P2 (`p2-api.log`, `p2-api-chapter-test.log`). The setup was branch-only:
- the dev user answered the lesson checks for 食, 来 and 校, and those rows were then made due;
- chapters 1 to 13 got placement-skip marks, so that chapter 14's test could start.

| Surface | Shown | Answers |
|---|---|---|
| `GET /reviews/due` | 食: display `食べる`, `Type the reading of 「食べる」`. 来: `来る`. 校: `校`, `Type a reading for 「校」` (unchanged) | taberu ✓ (correctAnswer たべる). 来: しょく ✗, らい ✗ (correctAnswer くる). 校: こう ✓ (コウ・キョウ) |
| Practice (weakest, kanji) | `食べる`, `来る`, `校`, same prompts | 食: しょく ✗. 来: kuru ✓. 食: たべる ✓ (`counted:false`, the session's second answer for that item) |
| Chapter 14 test | `Type the reading of 「来る」`, and the same pattern for 食べる 行く 書く 見る 飲む | 来 kuru ✓. 行 いく ✓. **食 しょく ✗ (correctAnswer たべる)** |

## 1.4 Simulator (`Sensei 22a SE3`, Expo Go, iOS, PR build against the branch)

**Method:** the one in `open-check-followup/test.md` 1.3. Nothing here can tap or type in the simulator, so I used a throwaway harness. It was never committed, and it's reverted: `git status` was clean at `e541cb5` before the worktree was removed.
- `App.tsx` ran a fixed sequence of flows through the real `AuthGate`, `OnboardingGate` and `SafeAreaView`.
- The real components did the work: `RecallCard` (set the answer and called its own submit), `CheckBeat` (called its own `submit()` with the top option, `x` on closed typed checks, and a thin introduction on the open one), `AssessmentScreen` (jumped to a question) and the lesson recap (each card starts turned over).
- Each component logged `SHOT <name>`. A watcher on the Metro log ran `xcrun simctl io <device> screenshot` with nothing touching the screen.

Grading, the network, the result colours and the score all ran unchanged against the real API. `harness.log` has every shot and the per-check outcome. The blue gear is Expo Go's dev overlay. A first pass stalled on the review summary because only 2 cards were due: my API chapter-test submit had rescheduled 来. I reset the branch rows, and the whole sequence was re-run from the start. The shots below are from that second pass.

| Shot | Promise | What it shows |
|---|---|---|
| `p1-recap-l76-kou-school` | P1 | Lesson 76's recap card 校: **"school"**, then コウ・キョウ. 本 book, 学 study and 生 life unchanged |
| `p3-teach-ch05l02-kana-once` | P3 | `ありがとう。`, `ありがとうございます。` and `すみません。`, each **once**, then the translation. No repeated line |
| `p3-teach-l93-kanji-keeps-reading` | P3 | `ごはん を 食べます。` with `ごはん を たべます。` underneath, and `みず を 飲みます。` with `みず を のみます。`. **Kanji examples keep their reading** |
| `p2-review-{0,1,2}-{q,result}` | P2 | Review 1: big `来る`, `Type the reading of 「来る」`, kuru, **Correct!** Review 2: `校`, `Type a reading for 「校」`, こう, Correct! Review 3: big **`食べる`**, `Type the reading of 「食べる」`, **taberu, Correct!** |
| `p2-practice-{0,1,2}-{q,result}` | P2 | `校` こう Correct! · **`食べる` しょく → "Answer: たべる"** (red) · `来る` くる Correct! |
| `p2-test-ch14-*` | P2 | Skip-test intro (20 questions), then **Question 7 `Type the reading of 「来る」`** and **Question 10 `Type the reading of 「食べる」`** |
| `p8-l120-run1-q1-before/after` | P8 | Order おやすみなさい / さようなら / いただきます / はじめまして. After tapping the top option it's red, and はじめまして is **green in slot 4, where it was**. "Not quite. Answer: はじめまして" |
| `p8-l120-run2-q1-before/after` | P8 | **The same question, in a different order:** はじめまして / おやすみなさい / いただきます / さようなら. The top tap is green in place, "Correct!" |
| `p8-l120-run{1,2}-q2-*` | P8 | q2 also differs between runs (はじめまして first, then どういたしまして first). It holds still through the result in both |
| `p8-l120-run1-done`, `run2-done` | P8 | **"You got 3 of 16 right"** and **"You got 5 of 16 right"**. The 16 are the 12 multiple-choice checks plus 4 closed typed checks answered `x`; the open check went ungraded with no grader key. So the top option scored **3 of 12 and 5 of 12** (it was 12 of 12 in `open-check-followup` u2d) |

The answer's slot per check, from `harness.log`:
- run 1: `4,1,2,4,3,4,4,2,3,1,1,2`;
- run 2: `1,4,3,3,2,2,1,1,4,1,2,1`.

## 1.5 Authoring rules at $0 (P4 to P7)

**Gate scan** (`gate-scan.log`): my own script ran `checkCourseRules(draft, courseContextFor(skeleton, id))` at `e541cb5` and kept only the three new rules' messages.

| Set | Files | New errors | New warnings |
|---|---|---|---|
| `output/` drafts | 107 | 0 | 0 |
| `published/` | 107 | 0 | 0 |
| `.prev.json` | 2 | 0 | 0 |
| `corrections.jsonl` originals | 15 | **6** | **2** |

- The 6 errors are "in kana" on ch04-l06 q2, q4, q6, q8 and q10, and on ch08-l03 q4.
- The 2 warnings are on ch16-l03 (109) teach[4]: "you don't know くるま yet" and "let's use words you know".
- This is identical to dev.md T5 and tech.md's spike. (`the-five-vowels` is excluded, being a stub. That's why my count is 214, not 216.)

**P7 probe** (`p7-probe.log`), 20 readings the audio wave is likely to write:
- **19 behave as wanted**: macrons (`ohayō gozaimasu`, `kōhī o kudasai`), `kin'en`, `hon'ya`, joined particles (`えきは` / `eki wa`), `gakkou e`, `Fuji-san`, capitals, and the lesson 115 mismatch refused, in both kana and rōmaji.
- **One false refusal:** an English annotation in the reading (F3).

**P5 probe:** these are refused: "Type this sentence in kana.", "(hiragana)", "Using hiragana, …". These pass: "the word written in katakana", "the katakana word for coffee", "Rōmaji is fine". Two gaps are in F1 and F2.

**P4** (`p4-outline.log`): built from the real `skeleton.json` with `buildDraftPrompt` and no model call.
- **Lesson 26** (I-Speaking): its four targets are in `WORDS THE LEARNER KNOWS (from earlier lessons)`, and `NEW IN THIS LESSON` is `(none)`. Literal tech.md 1.4 would have listed こんにちは ありがとうございます すみません はじめまして as new ("never say they already know them") and dropped them from the known list.
- **Lesson 93** (F-Kanji): `KANJI FROM EARLIER LESSONS: 人 … 外. NEW KANJI IN THIS LESSON …: 食 飲 読 書`.
- **Lesson 109** (F-Grammar): `NEW IN THIS LESSON: い-adjective`, and it isn't in the earlier grammar list.
- **All 12 audio lessons** re-target only earlier items, and their NEW line is empty.

---

# 2. Promises

| | Status | Verified on |
|---|---|---|
| **P1** 校 shows "school" everywhere; every other beta kanji keeps its taught meaning | **Holds** (throwaway branch) | Branch SQL: 41 beta kanji, only 校 changed, to "school". Dry run and apply: exactly the nine rows. Simulator: lesson 76's recap card. The other readers (lesson item `meaning`, placement and the curriculum screen) read the same `Item.meaning` column (tech.md 0) and weren't seen on screen. The live apply is the Lead's after merge (3.3) |
| **P2** Review, practice and chapter test show the whole verb; たべる / taberu accepted | **Holds** (throwaway branch) | Simulator: review `食べる` taberu ✓ and `来る` kuru ✓; practice `食べる` しょく ✗ "Answer: たべる"; chapter 14 test prompts `「来る」` and `「食べる」`. API: たべる and taberu ✓; しょく, らい ✗ on all three surfaces. 校 is still asked bare (no change for non-verb kanji). Jest adds katakana and くう, た, たべ (dev.md T2) |
| **P3** An all-kana example shows its Japanese once; a kanji example keeps its reading | **Holds** | Simulator: ch05-l02 and lesson 93. API: 299 hidden and 0 kanji examples affected over 108 lessons |
| **P4** The learner isn't told the lesson's new words are already known | **Holds at the prompt**, which is how the brief says it is proved | Prompts for lessons 26, 93 and 109 from the real outline, with no model call. No draft was made ($0 rule) |
| **P5** A typed check asking for "in kana" or "(katakana)" is refused | **Holds** for those forms | Gate scan: 6 refusals on the pre-edit originals, 0 on 214 approved and current drafts. Probe gaps in F1 and F2 |
| **P6** Self-corrections warn the reviewer, saying where | **Holds** | Gate scan: both 109 warnings, with `teach[4]`, on the pre-edit original; 0 on approved drafts. The `authoring:review` print path was read in the diff and is covered by Jest (`courseRuleFindings`). I didn't re-run the CLI (section 5); dev.md T5 has its output |
| **P7** A kana example whose reading says a different sentence is refused | **Holds** | Jest carries lesson 115 verbatim. My probe refuses it in kana and in rōmaji, and passes 19 fair readings. 0 hits on approved drafts. F3 is a known edge |
| **P8** The right answer isn't always in the same place; it moves when the question comes back; it holds still on screen | **Holds** (API and simulator) | Simulator: top tap 3 of 12 and 5 of 12, each well within "at most 6", so no third run was needed. q1 and q2 came in different orders between runs. Before and after submit, the options stayed in place and the right one was green where it sat. API: 164 and 147 of 668 answers first; lesson 120 put every check's answer in all 4 slots. Placement: code unchanged, pinned by the new seeded spec, not exercised live (section 5) |

---

# 3. Findings

Severity: High means a learner is hurt or data is wrong. Medium means real breakage outside the learner path. Low means an edge case. Info means no action is needed in this PR.

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| **F1** | Low | `apps/api/src/authoring/course-rules.ts:564` (`ASKS_FOR_KANA` lookbehind) | **Misses an instruction to answer in kana.** "Type the word you hear, spelled in hiragana." passes the gate. The `written/spelled/spelt` exemption added after code review spares it, although it tells the learner to answer in kana, and listening checks are where it's likely to appear | **Not fixed. Justified:** the promise names "in kana" and "(katakana)", which are caught. No check prompt in the 214 drafts says "written", "spelled" or "spelt in" kana (the 29 matches are all in Teach text), and PM review reads every audio lesson in full. **Tech Lead:** narrow the exemption to the noun phrase ("the word written in katakana"), or warn on "spelled in …" |
| **F2** | Low | same regex | **False refusal** when the prompt describes the word shown: "Type the English meaning of this word in katakana: コーヒー" | **Not fixed. Justified:** it's an error, so the free redraft loop pays for it, not a learner. 0 in the 214 drafts (gate scan) |
| **F3** | Low | `course-rules.ts:636-637` (`exampleReadingProblems`) | **False refusal** of a reading with an English note: `ありがとう ございます` / `arigatou gozaimasu (polite)` | **Not fixed. Known:** dev.md review #3 left English-only notes alone on purpose, and tech.md's risk table names this ("If the audio wave hits it, the Tech Lead narrows the skip rule"). 0 in the 214 drafts (gate scan) |
| F4 | Info | `apps/mobile/src/lesson/teach.ts:76` with the mapper | **App and API skew.** An app built before this PR drops any example block without a reading. Against the new API it would lose 299 example blocks | No deployed API today (Railway isn't provisioned), and Expo Go builds from the same checkout. **Lead:** the first deploy ships the API and the app together, or the app first |
| F5 | Info | `apps/api/src/assessments/assessments.service.ts:113` vs `:217` | A chapter test started before the live kanji apply and submitted after it shows the stored prompt 「食」, but is graded as 食べる, so しょく is marked wrong | A window of seconds, with dev users only. "Order doesn't matter" (tech.md 3.3) holds for every other surface |
| F6 | Info | `dev.md` T4 | "22 of 120 lessons re-target items an earlier lesson taught". I count **28** re-targeting at least one earlier item (I-Reading 11, I-Speaking 8, I-Listening 4, I-Writing 2, F-Vocab 2, F-Grammar 1) | The claim that matters, that all 12 audio lessons re-target only earlier items, is confirmed. Doc accuracy only |
| F7 | Info | `apps/api/src/authoring/lesson-prompter.ts:139-144` | `courseContextBlock`'s old doc comment now sits above `NEW_LABEL`, so two doc blocks stack and the function lost its description | Cosmetic |
| F8 | Info | `apps/api/src/testing/random.ts` | A spec-only helper that isn't named `.spec.ts`, so it compiles into the API's `dist`. Nothing imports it at runtime | Harmless |
| I1 | Info, pre-existing | `CheckBeat` / `ResultPanel` | On SE, after a result, the 4th option's green sits partly under the result panel (run 1 q1). The panel names the answer ("Answer: はじめまして") | Same as `open-check-followup` I3. Not this PR |
| I2 | Info, pre-existing | `lesson.mapper.ts` `mapCheck` | Live typed checks store `choices: []`, so they're served `choices: []` (tech.md: "typed and open checks still have no `choices`"). The app keys multiple choice on a non-empty list | Unchanged by this PR |

**Code review.** I reviewed the diff line by line: `shuffle`, `mapCheck`, `mapTeach`, the `LESSON_RANDOM` wiring, the kanji supplement guards and the dry-run diff, `kanjiWord` and the verb branch, the review, practice and chapter-test paths, the course-context split, the three gate rules, the `review.ts` print, the mobile parser and view, and every spec helper.
- No other defects found.
- Grading goes by option text everywhere.
- The stored options are copied before shuffling.
- `random` is required at the only call site.
- Every surface that grades a recall (reviews, practice, chapter tests, `grader-check`) goes through `recallQuestionFor`, so the displayed word and the accepted reading can't disagree.
- Every select it reads includes `data`.

I didn't run `/code-review high` myself, because this unit forbids sub-agents and usage is tight. The Developer's run on this PR (10 findings, 8 fixed, 2 answered, dev.md) was checked against the code, and I agree with each disposition.

---

# 4. The deviations in dev.md

**P4, "new" means a target no earlier lesson taught.** Tech.md 1.4 said "all of the lesson's targets". **Accept.**
- The brief's promise is about "words that the lesson itself introduces". A word an earlier lesson taught isn't introduced again by an I- lesson that practises it.
- Built literally, 1.4 tells lesson 26's drafter that four greetings from lessons 21 and 22 are new ("never say they already know them") and drops them from the known list. That's the opposite defect, in the 12 lessons still to draft (verified, section 1.5).
- The gate is untouched: `words`, `grammar` and `targets` are unchanged, and the new fields are additive.

**P4, the F-Kanji line is split into earlier and new kanji** (beyond 1.4, which split only words and grammar). **Accept.**
- An F-Kanji lesson introduces kanji, so P4's intent covers them.
- It's one prompt line, it affects only F-Kanji prompts (none left to draft), and the gate's kanji list is unchanged.

**Both are Tech Lead decisions, and only the Lead has accepted them provisionally.** The Tech Lead should confirm them in tech.md, or with a short decision entry, so 1.4's text stops contradicting the code.

**For the PM:** with the corrected rule, P4 has no effect on the audio wave's targets. The brief's premise that "speaking lessons introduce phrases" doesn't hold in the outline. Any phrase an audio draft adds beyond its targets is already outside "uses only the words listed above".

**T5 method** (the gate scan ran directly, not through `authoring:draft --recheck`): **accept.**
- `draft.ts:19` confirms that `--recheck` re-reads only `<id>.failed.json` and rejected drafts.
- A direct run is the only way to cover approved drafts.
- My scan used the same functions and got the same result.

---

# 5. Not verified

- **`authoring:review` as a CLI** (P6, the "reviewer is shown" part). I read the print path and rely on the Jest spec for `courseRuleFindings` and dev.md's fixture run. It's a 15-line call into the same function publish uses, and I skipped re-running it to save usage.
- **Placement's option order, live.** The dev user already has a placement attempt (one per user), and the code is unchanged. It's covered only by the new seeded spec (each slot 20 to 80 times in 200 builds).
- **P1 on placement and the curriculum screen.** They read the same `Item.meaning` column the recap card and SQL show; I didn't see them on screen.
- **Real taps and keystrokes.** The harness sets answers and calls each component's own submit (section 1.4). The Alpha walk taps for real.
- **A real draft for P4.** The $0 rule forbids a model call. The brief proves P4 by the prompt.
- **The live database.** By instruction, only the throwaway branch. The live dry run, apply and verify (tech.md 3.3) are the Lead's after merge, and the dry run there must again list exactly the nine rows.
- **Android, large text sizes, a physical device, Clerk auth.** iOS SE simulator, default text size and dev-stub auth only.

**Side effects, all on the throwaway branch:**
- the nine kanji rows have the supplement applied;
- `dev-user` has `ItemMasteryState` rows for 食, 来 and 校, reviewed and practised. A 行 row from my test submit was deleted;
- 13 `UserChapterMark` placement-skip rows for chapters 1 to 13;
- chapter 14 `AssessmentAttempt` rows: one submitted (2 of 20, failed) and the rest left open;
- `PracticeSession` rows;
- check answers on lessons 76, 93, 94 and 120;
- lesson 120 completions.

**Cleanup:**
- the worktree `.claude/worktrees/test-95` is removed;
- the harness was reverted first;
- Metro and the API are stopped;
- SE3 is shut down;
- the scratch file holding the branch URL is deleted.
