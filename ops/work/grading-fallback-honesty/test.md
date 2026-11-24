# Test: an honest "couldn't grade" in reviews, practice and chapter tests

Unit `grading-fallback-honesty` (B5). Tester, 2026-11-24. PR #99, branch `feat/grading-fallback-honesty`.

---

# Verdict: **PASS** on `f96236d`

Every promise P1 to P6 holds on the iOS simulator, the real API and the throwaway database, with the evidence below. No finding blocks the merge. F1 and F2 are PM calls, and F3 goes to the backlog. Any new commit voids this PASS.

---

# 1. Evidence

## 1.1 Verification commands

Worktree `.claude/worktrees/test-99`, detached at `f96236d`, set up as `ops/PROJECT.md` says. Removed afterwards.

- `pnpm typecheck && pnpm lint && pnpm test`: exit 0. **Turbo replayed all of it from cache** (the Developer's runs), so I re-ran it with `--force`:
  - typecheck: 4/4 tasks;
  - lint: 1/1;
  - test: **64 suites, 1582 tests passed**;
  - exit 0, nothing cached.
- CI `verify` on `f96236d`: SUCCESS.
- **The specs bite.** I put `main`'s `recall-grader.service.ts` back in and ran the four affected spec files. **7 tests fail:**
  - the 3 new integration cases (review unscored, review exact, practice unscored);
  - the review and practice "grader down and fallback says wrong" cases;
  - the 2 new `RecallGraderService` fallback cases.
  
  After restoring the file, the tree was clean.

## 1.2 Real API, throwaway branch, grader off

**Setup**
- API built from `f96236d` (`nest build`) and started with `env -i`. The environment had only:
  - `DATABASE_URL`: the direct URL of `test-open-check-followup` (`br-winter-poetry-baq6sbs4`, host `ep-small-firefly-bath9jbb`, not default, not primary; confirmed with `describe_branch`);
  - `PORT=3199` and `DEV_USER_ID=tester-b5t` (a fresh user);
  - every key empty.
- The log shows `GEMINI_API_KEY not set — AI grading disabled`.
- My evidence script refuses to run unless `DATABASE_URL` is that host. **The default branch was never touched.**
- To reach chapter 4: intake, then skip-tests of chapters 1 to 3 with the right rōmaji (15/15, 15/15, 20/20, all passed).

**P5: chapter 4 skip-test, 20 questions** (`test-shots/api-p5-skiptest.log`)
- Answers: Q1 blank, Q2 and Q3 "something else entirely", the rest exactly as stored.
- Response: `passed: true, correct: 17, total: 18`.
  - Q1 かぞく: `correct:false, scored:true`.
  - Q2 きっぷ and Q3 おとうさん: `correct:false, scored:false`.
  - The other 17: `correct:true, scored:true`.
- Every result has exactly the keys `answer, correct, correctAnswer, itemId, prompt, scored`. None has `feedback`.
- Stored `AssessmentAttempt`: `PASSED`, `correctCount 17`, `results.total 18`, flags `xs xu xu Cs…` (the same flags as the response).
- Replay (a second submit with no answers): the same `passed/correct/total`, identical field by field.
- `ItemMasteryState` for the two ungraded items: **none written**.

**P4 and P2, reviews**

10 items made due on the throwaway branch only, with `UPDATE "ItemMasteryState" SET due = now() - 1 min WHERE "userId"='tester-b5t' AND "itemId" IN (…10 ids…)`:
- 6 kana: く れ か す え う;
- 4 vocabulary items: かぞく, かばん, えんぴつ, おねえさん.

Results:
- **P4.** I snapshotted the rows of えんぴつ and おねえさん before the first app session. After two app sessions in which both were ungraded (1.3), the rows were **identical** (`mastery, recall, fsrs, due, lastReview, updatedAt`).
  - `GET /reviews/due` then listed exactly those two.
  - The 8 graded cards all moved to a future `due`.
- **P4, through the API.** `POST /reviews/ja:vocab:お姉さん/answer` with "raw fish rice" returned `{correct:false, correctAnswer:"older sister", scored:false, mastery:…}`, with **no `feedback` key**. The row was identical before and after, and the item was due before and after.
- **P2, through the API.** 鉛筆 answered "(wooden) pencil" returned `{correct:true, scored:true, …}`, with **no `feedback`**. On `main` this path returns "Correct." (see 1.1).

## 1.3 Simulator, `Sensei 22a SE3`, Expo Go, iOS

**Method.** The same as `open-check-followup/test.md` 1.3. Nothing can tap or type in the simulator, so I used a throwaway, uncommitted harness. It has been reverted and the worktree deleted.
- The harness mounted the real `ReviewSession`, `PracticeSession` and `AssessmentScreen` inside the real `AuthGate`, `OnboardingGate` and `SafeAreaView`.
- `RecallCard` set its answer through `setAnswer` and submitted through its own `submit()`. `AssessmentScreen` set `draft` and advanced through its own `next()`.
- A local control server supplied the answers and took each shot with `xcrun simctl io … screenshot`, 1.8 s after the result rendered, with nothing touching the screen.
- For long results, the harness called the `Screen` ScrollView's `scrollToEnd` and then took a second shot.
- The network calls, grading, scoring, the done screens and every component under test ran unchanged against the real API (1.2).
- The blue gear is Expo Go's dev overlay.

**A disclosure.** Shots `pr-*` came from the first harness bundle. An old instance of the app picked up the queued flows before my reload. That bundle has the same PR code and differs only in having no scroll hook. Every shot after `sk-01` is from the reloaded bundle.

All shots are in `test-shots/`, and the control log is `test-shots/harness-events.log`.

| Shot | Grader | Scenario | What it shows |
|---|---|---|---|
| `r1-04-enpitsu-ungraded.png`, `r1-05-oneesan-ungraded.png` | off | Review card 4 and 5 of 10, non-exact meanings | Only the grey "Couldn’t grade that right now, so it doesn’t count. Answer: (wooden) pencil". No "Correct!", no "Not quite", no red or green, no second line. The answer appears once |
| `r1-02-kazoku-exact-correct.png` | off | かぞく = "family", typed exactly | Green **"Correct!"** and nothing under it. `main` would add "Correct." |
| `r1-01-kana-correct.png` | off | く = "ku" | "Correct!" as before |
| `r1-11-done-8-of-8.png` | off | The 10-card session: 6 kana right, 2 exact, 2 ungraded | **"You got 8 of 8 right."** |
| `r2-01…`, `r2-02…` | off | The next session | **Only the two ungraded cards came back** ("Review 1 of 2", "2 of 2"). Both were ungraded again |
| `r2-03-done-nothing-counted.png` | off | That session, nothing graded | No score and no "0 of 0". "Nothing could be graded this time, so nothing counted. These cards will come back in your next review." |
| `pr-01-isha-ungraded.png` | off | Practice, chapter 4 vocabulary, card 1, non-exact | The same grey line with the answer once. No verdict |
| `pr-02-issho-exact-correct.png` | off | Practice card 2, typed exactly | "Correct!" alone |
| `pr-03-kana-miss-red.png` | off | Practice, chapter 1 kana, あ = "zz" | Red **"Answer: a"**, unchanged |
| `sk-01-skip-fail-top.png`, `sk-02-skip-fail-end.png` | off | Chapter 5 skip-test: 4 blank, 2 non-exact, 14 exact | "Not this time", **"14 of 18 right"**, "No penalty…". "To review" holds only the 4 blanks. A separate block, "Couldn’t grade these right now, so they don’t count:", lists the 2 non-exact answers as "You: something else entirely · Answer: welcome" and "You: no idea really · Answer: I'm sorry; …", with no verdict and no colour |
| `ex-01-exit-fail-top.png`, `ex-02-exit-fail-end.png` | off | Chapter 5 **exit** test (its lessons marked skipped on the throwaway branch so it's an EXIT), with the same answer pattern | "Chapter assessment", "14 of 18 right", **"The items you missed will come back in your reviews."** "To review" holds the 4 blanks only, and the 2 ungraded answers are in their own block |
| `ex-03-exit-pass.png` | off | Chapter 5 exit test: 1 blank, 2 non-exact | "Passed 🎉", **"17 of 18 right"**, "First phrases is complete." "To review" holds 1 row, and the ungraded block holds 2 |
| `g1-grader-on-comment.png`, `g1-done-1-of-1.png` | **on** (free-tier Gemini, no `GRADING_DEGRADED`) | Review, おねえさん = "big sister" | "Correct!", then the model's comment "Spot on — that's the correct meaning." **A model comment is still shown.** End screen: "1 of 1" |

**Stored attempts match the screens.** Read on the throwaway branch:
- SKIP `FAILED 14/18`, flags `xxxxuu` then 14 `C`, twice;
- EXIT `FAILED 14/18`;
- EXIT `PASSED 17/18`.

For the passing exit test, no mastery row was written for its two ungraded items after submit.

## 1.4 Grader on, through the API

- I restarted the API with only `GEMINI_API_KEY` and `LLM_GRADING_MODEL` taken from the main `.env`, without printing them.
- Practice, いしゃ = "dog": `{correct:false, scored:true, feedback:"That's incorrect — いしゃ means doctor.", counted:true}`. **A model miss keeps its comment** (P6).
- Gemini calls in total: the startup model check plus 2 grades. None degraded. $0. No paid Claude calls.

---

# 2. Promises

| Promise | Status | How checked |
|---|---|---|
| **P1** An ungraded review or practice card: one plain line and the answer once. No "Correct!", "Not quite", red or green | **Holds** (simulator and API) | `r1-04`, `r1-05`, `r2-01`, `r2-02` (review) and `pr-01` (practice). API: `scored:false` and no `feedback` key. Jest: 3 new cases that fail on `main`. Seen with the grader **down** (no key). Timeout and rate limit take the same `catch → fallback()` path in `GradingService.gradeOpen`; they were not triggered (section 4) |
| **P2** The verdict once; no line repeating or contradicting it; a comment is about what I wrote | **Holds** for every fallback grade, which is this unit's defect. See **F1** for model-written comments | `r1-02` and `pr-02`: "Correct!" alone. API exact match: no `feedback`. Model grade (`g1`): "Correct!" plus the model's comment, as brief 3.2 keeps it |
| **P3** The review score counts graded cards only; none graded means no score, just "nothing counted" | **Holds** (simulator) | `r1-11`: **"You got 8 of 8 right."** for 10 cards with 2 ungraded. `r2-03`: no score, the nothing-counted copy, never "0 of 0" |
| **P4** An ungraded review card comes back later as if unanswered | **Holds** (DB, API, simulator) | Rows identical across two app sessions and one API answer. `GET /reviews/due` lists them. `r2-01` and `r2-02`: exactly those two came back in the next session |
| **P5** Chapter test or skip-test: ungraded answers aren't among the misses; they're listed on their own with my answer and the answer under a plain line | **Holds** (API, DB, simulator) | API: `scored` per result, in storage and on replay. Simulator: a skip-test (`sk-01`, `sk-02`), a failed exit test (`ex-01`, `ex-02`) and a passed one (`ex-03`). Each "To review" holds only the blanks, and the ungraded answers sit under "Couldn’t grade these right now, so they don’t count:". The two lists read as separate: a bold "To review" heading, then a plain lead-in line after a gap |
| **P6** Graded answers look and count as before | **Holds** | `pr-03`: red "Answer: a". `r1-01`: "Correct!". `g1`: the model comment is kept, and the API keeps it on a model miss. Scores and pass marks match the stored rows (14/18 FAILED and 17/18 PASSED at 80%). All 1582 existing and new tests pass |

---

# 3. Findings

Severity: **High** means a learner is hurt or data is wrong. **Medium** means real breakage outside the learner path. **Low** means an edge case or inconsistency. **Info** means no action is needed in this PR.

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| **F1** | Low, PM call | `apps/api/src/grading/grading.prompts.ts:45` (the prompt's own example, "Perfect — that's the polite morning greeting."). Not in this diff | **Model-written comments often restate the verdict, and on a miss the answer too.** Seen: "Spot on — that's the correct meaning." under "Correct!" (`g1`), and "That's incorrect — いしゃ means doctor." on a miss (API 1.4). On the card, the miss would sit under red "Answer: doctor", so **the answer is shown twice**, which is the kind of duplication brief 1 complains about. P2's wording ("no line underneath repeats it") isn't met on model-graded misses | **Not fixed. Justified for merge:** brief 3.2 and J.1.d keep the model's comment as-is, and the diff ships exactly that (tech.md 1.1). The wording comes from the prompt, not from this code. **PM:** accept it, or open a small prompt unit ("for recall meanings, don't restate the verdict or the answer; say what was right or what the answer is confused with") with an eval re-run. The Alpha run may score P2 against this |
| **F2** | Info, PM copy | `apps/mobile/src/review/ReviewSession.tsx:86-91` | The nothing-counted end screen keeps the 🎉 and "Review complete", which celebrate a session where nothing counted (`r2-03`). The body is left-aligned inside a centred layout | **Not fixed. Justified:** the copy follows tech.md 1.3, and brief 3.3's rule (no score, say nothing counted) is met. The PM may adjust the tone |
| **F3** | Info, backlog | `apps/api/src/common/normalize-answer.ts:17` (`exactMatch` against the whole `question.expected`) | With the grader down, the fallback only accepts the **whole** gloss string. "hello" for こんにちは (stored as "hello; good day; good afternoon") or "thank you" for ありがとう ("thank you; thanks") comes back "couldn't grade", not graded. That makes the honest notice more common on chapter 5 phrases than brief 5's "an exact answer already passes in the fallback" assumes. It existed before this PR | **Out of scope** (brief 5: the fallback rate). **Backlog:** let the fallback accept any one `;`-separated gloss. Blocker 9 (billing) removes most fallbacks anyway |

**Code review.** I didn't run `/code-review high`, because this unit forbids sub-agents. I reviewed the diff line by line instead:
- `modelComment`: `feedback` is always a string (`grading.service.ts:132` guards it), so `.trim()` can't throw.
- Recall blanks are short-circuited before `gradeOpen`, so "No answer was given." never reached reviews. `ChecksService` output is unchanged except that a whitespace-only AI comment is now dropped (R6, as intended).
- `ReviewSession`: `wasGraded && result.correct` short-circuits on `null`. A 4xx-skipped card counts as ungraded (tech.md risk table).
- `AssessmentScreen`: `!== false` and `=== false` keep an API without the field rendering as before. An older app ignores `scored` and shows today's behaviour.
- `assessments.service.ts`: `scored` is stored and returned on both the live and the replay path through `toResult`. Score, pass mark, FSRS write-back, `seedUntested` and the 503 are untouched (verified on the branch).

I checked the Developer's review findings R1 to R9 against the code and agree with each disposition. R9, whether the two lists read as separate, is now checked on the device (P5).

---

# 4. Not verified

- **Real taps and keystrokes.** The harness sets text and submits in code (section 1.3). The Alpha walk types for real.
- **A real timeout, 429 or 503.** Only "down" (no key) was exercised. All three failures go through the same `catch → fallback()` in `gradeOpen`, and the specs pin the fallback. A free-tier 503 during the Alpha run would be extra evidence.
- **A model-graded miss on the device.** It was seen only on the wire (1.4). The card's scored-miss branch is unchanged from `main`, apart from the `scored &&` guard on the comment, which is true for that miss.
- **The live database.** Off-limits. tech.md's "0 assessment attempts live" (2026-11-23), which makes the pre-B.2.g replay default moot, was not re-checked.
- **Android, large accessibility text sizes, a physical device, Clerk auth.** Only the iOS SE simulator at default text size, with dev-stub auth.

**Side effects, all on the throwaway branch** `br-winter-poetry-baq6sbs4` for user `tester-b5t`, none on the default branch:
- intake;
- skip-tests on chapters 1 to 4;
- 4 attempts on chapter 5;
- mastery rows;
- `due` moved back on 10 items;
- 5 `UserLessonSkip` rows for chapter 5;
- 3 practice sessions;
- review answers and streak rows.

**Cleanup:** the API, Metro and control server stopped, the simulator shut down, the harness reverted (`git status` clean at `f96236d`), the worktree removed, and the scratch file holding the connection string deleted.
