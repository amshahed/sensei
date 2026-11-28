# Test: a listed meaning is marked right at once

Unit `exact-meaning-grading`. Tester, 2026-11-28. PR #112.

# Verdict: PASS

**Commit:** `5450607908188476b06f6de0ba1c247966e09f13` (head of `feat/exact-meaning-grading`). CI `verify` is green on it. A new commit voids this verdict.

- Every promise P1 to P8 holds on the real API: grader hanging, grader off, and grader on, with `main` as the "before".
- There are no blocking findings. Eight findings are justified below (F1 to F8). None is a defect introduced by this PR that a learner hits today.
  - F1 is a real outage loophole on chapter tests, and it already exists on `main`.
  - F2 is a test that quietly moved off the grader path, in a file this PR may not touch.
- The Developer's three notes:
  - the `;`-in-brackets deviation: **accepted**, with live-data evidence;
  - `tech.md` 4.1 P8: **the Developer is right**, on `main` and here;
  - the 20-question submit time: **accepted**. It is database time, not grader time.

---

# 1. Evidence

## 1.1 Setup

- Own detached worktree `.claude/worktrees/test-exact-meaning-grading` at `5450607`, plus `.claude/worktrees/test-emg-main` at `main` `453aedc`, for before and after. Both are set up per `ops/PROJECT.md` and built with `nest build`.
- **Database:** only `test-open-check-followup` (`br-winter-poetry-baq6sbs4`). `describe_branch` says `default: false`, `primary: false`.
  - The direct host is `ep-small-firefly-bath9jbb.c-8…`: the MCP gave the pooler URL, and I dropped `-pooler`.
  - The URL went only through `DATABASE_URL`, under `env -i`.
  - The preload and the driver both refuse any other host, and any pooler host (`DB_HOST_OK` printed at each boot).
- The API ran from the worktree's `apps/api`, which has no `.env`. Clerk keys were empty, so dev-stub auth applied, with a fresh learner per scenario via `x-dev-user-id`.
- **Fresh learners:** `tst-emg-r1`, `s1`, `k1`, `o1` to `o4`, `m1` to `m3`, `c1`, `c2`. `dev-emg-1128` was not used.
- **Branch writes:** API writes for those learners, plus `UserLessonSkip` rows for `tst-emg-k1` (chapters 8 and 9), to make two EXIT tests.
- **Item check:** a read-only SQL query found every item in P1 to P4 with the meaning `tech.md` 0 quotes (こんにちは, ありがとう, すみません, はじめまして, 歳, 水, 前, アメリカ, 食べる, 行く, 来る, おいしい, ちょっと, ペン, 万, 隣, そこ, どれ, いただきます).
- **Scratch tools** (never committed), in `/tmp/claude-1000/-home-shahed-workspace-sensei/056c074b-2f0e-482e-8498-763615841331/scratchpad/`:
  - `gemini-hang.cjs`: hang or count mode, with a host guard;
  - `drive.cjs`: the evidence driver;
  - `sweep.cjs`: the read-only rule sweep;
  - `mutate.py`.
- **No secrets** in any file: `grep npg_` and `grep AIza` over the scratchpad come back empty. The Gemini key was read from the main `.env` into the process environment and never printed.

## 1.2 Verification commands

- `pnpm typecheck && pnpm lint && pnpm test` passed (exit 0), but Turbo replayed every task from cache (the Developer's runs).
- I re-ran it with `TURBO_FORCE=true`: exit 0, `0 cached`, **65 suites, 1648 tests passed**.

## 1.3 Code review

- I ran `/code-review high 112` myself. It returned six findings: two "important" and four nits.
- I checked each against live data. Section 3 has the outcome: F1 and F3 to F7. None is a defect introduced by this PR that a learner hits today.

## 1.4 The specs bite (mutation runs)

Each mutation was applied in my worktree, run with `jest src/recall src/reviews src/practice src/assessments src/checks`, then restored (`git status` clean afterwards).

| Mutation | Failing tests |
|---|---|
| Shortcut disabled (`false && …`) | 8 |
| Split on every `;` (the deviation reverted) | 1 |
| No leading-"to" rule | 4 |
| No 6-bracket guard | 1 |
| Listed rating `Easy` instead of `Good` | 7 |
| "to" stripped as a substring (`toilet` → `ilet`) | 1 |
| `keys.delete('')` removed | 0. Equivalent mutant: an empty typed key returns early, so the line is redundant, not untested |

I also made the shortcut **throw** and ran the full suite, to find every test that reaches it. Twelve tests did:
- the 9 new G.4.h tests;
- the 3 assessment tests `dev.md` 2 already names;
- **2 in `app.integration.spec.ts`**, which `dev.md` 2 doesn't mention. See F2.

## 1.5 Real API, grader hanging (tech 4.3 B), PR build

The boot check used `GEMINI_FETCH 1`.

- **Reviews: 33 listed answers.** All `201`, `correct: true, scored: true`, with **no `feedback` key**, in 0.19 to 0.35 s. The counter stayed at 1. The answers:
  - こんにちは "hello", "Good Day", "good afternoon", "Hello!";
  - ありがとう "thanks", "thanks.", "  THANK   you ";
  - すみません "excuse me", "I beg your pardon";
  - はじめまして "how do you do", "Nice to meet you!";
  - 歳 "years old";
  - 水 "water", "water esp cool or cold";
  - 前 "in front", "in front of";
  - アメリカ "America", "United States of America";
  - おいしい "good-tasting";
  - 食べる "eat", "to eat";
  - 行く "go";
  - 来る "come", "come spatially or temporally";
  - ごめんなさい "Im sorry";
  - 万 "10000", "10,000";
  - どういたしまして "youre welcome";
  - 日本語 "Japanese";
  - 一緒 "together";
  - 鉛筆 "pencil";
  - ちょっと "a little";
  - ペン "pen".
- **Controls (P7).** "delicious" (おいしい), "a pen" (ペン), "helo", "goodbye" and "hello good day" (こんにちは), and "little" (ちょっと). Each took **12.10 to 12.26 s**, came back `correct: false, scored: false` with no `feedback`, and moved the counter by exactly 1.
  - The whole recap string "thank you; thanks" (ありがとう) also took 12.19 s. It came back `correct: true, scored: true` through the fallback's exact match. That is unchanged from `main`, and the plan intends it (tech 4.1 P7, `dev.md` 7.4).
  - The unscored controls wrote no mastery row.
  - The counter's final total was **8**: boot plus the 7 controls. So nothing else called the grader.
- **P6 schedule.** Fresh learner `tst-emg-s1`, in the same minute: 水 "water" and 食べる "Eat!" (listed), and kana あ "a". All three `ItemMasteryState` rows are identical:
  - `fsrs.stability 2.3065`, `difficulty 2.11810397`, `reps 1`, `state 2`, `scheduled_days 3`;
  - `due − lastReview = 3.0000` days;
  - `mastery 0.0740`.
- **Skip-tests** (`tst-emg-k1`, chapters 1 to 7, in order), every answer right.
  - Kana were answered in rōmaji. Meanings took the brief's 3.2 forms: as stored, brackets dropped, leading "to" dropped, capitals and "!", upper case with extra spaces, a trailing ".".
  - All 7 were `SKIP`, `passed: true`, `correct = total`, and the counter stayed at 8.
  - Result keys were `answer, correct, correctAnswer, itemId, prompt, scored` only, so no comment.

  | Chapter | Questions | Submit |
  |---|---|---|
  | 1, 2, 3 | 15 / 15 / 20 rōmaji | 1.00 / 0.83 / 1.08 s |
  | 4, 5 | 20 / 20 meaning | 1.11 / 1.00 s |
  | 6 | 20 rōmaji | 1.04 s |
  | 7 | 14 rōmaji + 6 meaning | 1.02 s |

- **EXIT tests.** Chapter 8 and chapter 9, with their lessons marked skipped.
  - **Chapter 9:** `EXIT`, 13 meaning (2 of them grammar explanations) and 5 kanji readings. `passed: true, 18/18`, 0.96 s, counter flat.
  - **Chapter 8:** `EXIT`, 17 meaning and 3 readings. 19 of 19 scored answers right.
    - One grammar answer was my driver's mistake: it stripped the です from じゃありません's explanation, so the answer wasn't listed.
    - That answer correctly went to the grader. It waited, came back unscored, and moved the counter by 1. A useful extra P7 control.
- **Practice** (`tst-emg-k1`, weakest scope).
  - 8 kana and 8 VOCAB listed answers ("hello", "Good morning!", "  YOU ", "older brother.", "No!", "  DOCTOR ", "together.", "older sister").
  - All `scored: true, counted: true`, with no `feedback`, in 0.22 to 0.28 s, and the counter flat.
- **P8, lessons.** The PR build first, then `main` with the grader hanging. They are identical:

  | Check | Answer | PR | `main` |
  |---|---|---|---|
  | Multiple choice "What does こんにちは mean?" (option "Hello (daytime)") | "hello" | `correct: false`, 0.22 s, counter flat | `correct: false`, 0.42 s |
  | Same | "Hello (daytime)" | `correct: true` | — |
  | Closed typed "あお" | "ao" | `correct: true`, 0.17 s, counter flat | same |
  | Lesson 120 open check `cmwsgmdy5000t9offc0gvukvy` | its stored exemplar | **12.20 s**, counter **+1**, `correct: true, scored: true`, no feedback | 12.19 s, +1, the same |
  | Same | "はじめまして。わたし は ハナ です。" | 12.19 s, +1, `scored: false` | the same |

  - If lessons had taken the shortcut, "hello" would have matched "Hello (daytime)" by dropping the bracket. It didn't.

## 1.6 Real API, grader off (tech 4.3 A), PR build against `main`

`GEMINI_API_KEY` empty, and 0 Gemini fetches at any point.

- **PR build:**
  - the same 33 listed answers were all scored right, in 0.16 to 0.28 s;
  - the 6 controls were unscored, in 0.08 to 0.13 s;
  - skip-tests for chapters 1 to 5 all passed `correct = total`, in 0.84 to 1.22 s.
- **`main` build, the before:** of the same 33 listed answers, **29 came back `scored: false`** ("couldn't grade"). Only the 4 whole-string ones were scored: "to eat", "10,000", "a little", "pen". This is F3 of `grading-fallback-honesty`, fixed.

## 1.7 Real API, grader on (tech 4.3 C), PR build against `main`

Real key, count-only preload, 5 model calls in all.

| Answer | PR build | `main` build |
|---|---|---|
| こんにちは "hello" | No `feedback`, counter flat, 0.32 s | `feedback: "Spot on — that's the correct meaning for こんにちは."`, +1 |
| ありがとう "Thanks!" | No `feedback`, counter flat | `"Spot on — ありがとう means 'thank you' or 'thanks'."`, +1 |
| おいしい "delicious" | `feedback: "Spot on — おいしい means delicious."`, +1 | `"Spot on — that means delicious."`, +1 |

- That is the before and after P1 asks for. The verdict-only comment is gone for listed answers. A paraphrase still gets the model's comment (P7).

## 1.8 What the rule accepts on live data

`sweep.cjs`, read-only, uses the PR's built `isListedMeaning`. It tests every run of one to four words from each stored meaning.

- **Lesson-linked (209 meanings):** exactly **44 items** gain an accepted answer beyond the whole string. That independently reproduces the PM's and the Tech Lead's count.
  - Every gained answer is one of the dictionary's own senses or head glosses.
  - The only questionable ones are the known costs: 隣 "next", そこ "there", どれ "which", いただきます "thank you".
  - No grammar item gains a short answer.
- **Lesson-linked:** 0 meanings have a `;` inside brackets, 0 a "(not)" bracket, and 0 nested brackets. All 12 senses that start with "to " are verbs.
- **Whole item bank (1,404):**
  - 1 meaning has a `;` inside brackets (たち);
  - 3 have "(not)" (全然, ちっとも, 決して);
  - 1 has nested brackets (犬);
  - the only non-verb "to …" senses are に/へ "To." (harmless), それほど "to that degree", and びっくり "to be surprised" (a する-noun, harmless).
  - None of these is taught today.
- **Direct probes:**
  - a 1.2 MB answer takes 42 ms;
  - 300 senses with 6 brackets each take 29 ms;
  - 5,000 brackets in one sense take 2 ms (the guard holds);
  - full-width "ｈｅｌｌｏ" doesn't match, so it fails safe to the grader.

---

# 2. Promises

| Promise | Status | How I checked |
|---|---|---|
| **P1** Any listed meaning is "Correct!" at once, with nothing under it, on all four surfaces | **Holds** | Reviews: 33 answers (1.5), with no `feedback` key. Practice: 8 answers, none. Skip-test and EXIT results carry no comment field. Grader on: "hello" has no comment, where `main` gives one (1.7) |
| **P2** Capitals, spaces and punctuation don't matter | **Holds** | "Hello!", "thanks.", "  THANK   you ", "how do you do", "years old", "Im sorry", "youre welcome", "10000", plus the upper-case, extra-space and "!" forms in the tests (1.5) |
| **P3** A bracketed part left out, or typed without brackets | **Holds** | "water", "water esp cool or cold", "in front", "in front of", "America", "United States of America", "good-tasting", "Pencil!", "Restaurant!", and `UNIVERSITY STUDENT` with the bracket text kept. Future gap for nested brackets: F3 |
| **P4** A verb's "to" left out | **Holds** | "eat", "to eat", "go", "come", "come spatially or temporally". "ilet" stays rejected (spec, and the mutation in 1.4) |
| **P5** Right and counted with the grader down, slow or busy; no wait; a full test is scored on every question | **Holds** | Hanging: every listed answer took 0.2 s with the counter flat, against 12.1 s and +1 for a control. 7 skip-tests and 2 EXIT tests were scored on every question at zero grader calls. Grader off: the same. "Busy" (a 503 or a reject) takes the same `catch` into the fallback as a hang, and the rejecting-grader spec pins it. See the timing note in section 4 |
| **P6** Counts like any right answer: score, pass mark, schedule | **Holds** | The FSRS rows for a listed vocab answer and a kana answer are identical (1.5). Skip-test and EXIT `correct`, `total` and `passed` include listed answers. The review end screen counts `scored && correct`, both true on the wire. Specs pin `Rating.Good` at every surface |
| **P7** Anything else is judged as today, with the model's comment, or "couldn't grade" when the grader can't judge | **Holds** | All 5 brief examples plus "hello good day" and the stripped grammar answer: about 12 s, +1, unscored when hanging; unscored at once when off; no mastery row. Grader on: "delicious" carries the model's comment |
| **P8** Lessons and placement unchanged | **Holds** for lessons. Placement by code and specs only | Lessons: identical on PR and `main` (1.5). Placement: no file changed, and `placement.service.ts` uses `recallQuestionFor` only to check quizzability and never calls `RecallGraderService` (grep). Its specs pass. Not run live (section 5) |

---

# 3. Findings

None blocks the merge. Each is justified in writing as `OPERATING_MODEL` requires. Owners are named for the follow-ups.

**F1. Minor, pre-existing, not introduced here. During an outage, a skip-test passes on a single right answer.**
- **Where:** `apps/api/src/assessments/assessments.service.ts:237-243`. Unscored answers are dropped from `total`, and only `total === 0` gives a 503.
- **Reproduced with the grader off:**
  - on the PR build, chapter 4 skip-test (`tst-emg-o4`): one right answer and 19 answers of "zzz" gave **`passed: true, correct 1, total 1`**;
  - on `main` (`tst-emg-m1`), the same with "mother": **`passed: true, 1/1`**.
- A passed skip-test marks the chapter passed and skips its lessons.
- **What this PR changes:** on `main`, any of the roughly 141 single-sense words typed exactly already does this. The PR adds the 44 multi-sense or bracketed words. It widens the gap marginally and doesn't create it.
- **Why it doesn't block:** the scoring rule belongs to `grading-fallback-honesty` (P5 of that unit) and is outside this brief (section 5).
- **For the PM:** a new unit, for example a minimum share of scored meaning answers before `passed`, at least for a `SKIP`. It matters more once real learners hit outages.

**F2. Minor, test coverage. One HTTP test quietly left the fallback path, and `dev.md` 2 misses it.**
- **Where:** `apps/api/src/app.integration.spec.ts:731`, "a review typed exactly: graded correct, the verdict not repeated (P2)". It answers "Sushi" for "sushi" with the grader down.
  - It used to prove over HTTP that the fallback's own "Correct." line never reaches the learner.
  - "Sushi" is now listed, so it takes the shortcut, and the fallback exact-match path is no longer exercised end to end.
- The same file's "a practice answer: unscored…" also reaches the shortcut, but only in its setup step, so it still tests what its name says.
- `dev.md` 2 says "No other spec answered a meaning question with a now-listed answer through `RecallGraderService`". That is wrong for these two.
- **Why it doesn't block:**
  - the file is in PR #107's diff (open), and brief 5 forbids touching it;
  - the behaviour is still pinned at the seam by `recall-grader.service.spec.ts:106`, which is now `'x; y'` and asserts `gradeOpen` is called and no `feedback`.
- **For the Developer, after #107 merges:** give the fake item a meaning like `'sushi; raw fish'` and answer the whole string, so that case reaches the fallback again.

**F3. Minor, future content. Nested brackets: the head gloss isn't accepted.**
- **Where:** `apps/api/src/recall/listed-meaning.ts:28`. Only innermost brackets are optional, as `tech.md` 1.1 says.
- 犬 "dog (Canis (lupus) familiaris)", which is in the bank but not taught:
  - "dog" is **not** accepted, so it goes to the grader, and in an outage it shows "couldn't grade";
  - "dog canis familiaris" is accepted.
- **Why it doesn't block:** it fails safe, no taught word has nested brackets, and it is the plan's rule.
- **For the PM or Tech Lead before 犬 is authored:** edit the stored meaning (simplest), or let outer brackets drop too.

**F4. Minor, future content. A dropped "(not)" flips the meaning.**
- 全然 and ちっとも "(not) at all", and 決して "(not) ever", accept "at all" and "ever" at once. Probe confirmed.
- **Why it doesn't block:** the 3 items are in 0 lessons, and `dev.md` 7.2 already sends it to the PM.
- **Needs a PM ruling before any of them is authored.**

**F5. Nit, future content. The leading-"to" rule isn't limited to verbs.**
- **Where:** `listed-meaning.ts:72`.
- The review's example premise is wrong: まず is stored as "first (of all)", not "to begin with", and no "to (a place)" sense exists.
- In the whole bank, the only non-verb case that matters is それほど "to that degree", which would accept "that degree". It isn't taught.
- **Why it doesn't block:** G.4.i chose this deliberately, with reasons, and rejected a part-of-speech gate. No taught word is affected.
- **For the PM:** add それほど to the same list as F4.

**F6. Nit. Full-width Latin letters never match.**
- "ｈｅｌｌｏ" goes to the grader. That fails safe, and it is identical to `main`.
- The PM already has it (`dev.md` 6). NFKC folding (the standard Unicode way to fold full-width letters into plain ones) would be a one-line follow-up if Alpha shows it.

**F7. Nit. Spacing is ignored completely, so different word splits match.**
- "apart" matches "a part", and "1 5" matches "15".
- `tech.md` 1.1 accepted this cost. No live sense pair is affected, and the "little" against "a little" articles case stays rejected.

**F8. Plan error, not code. `tech.md` 4.1 P8 predicts the wrong result.**
- It says lesson 120's open check answered with its exemplar under a hanging grader "comes back unscored". On both `main` and the PR it returns `correct: true, scored: true` after 12.2 s, through `GradingService.fallback()`'s exact match.
- The 12 s wait and the counter +1 are what prove lessons don't take the shortcut. A non-exemplar answer comes back unscored, as the plan expected.
- **For the Tech Lead:** correct the line.

---

# 4. The Developer's notes, judged

1. **`;` inside brackets doesn't split senses (deviation 3): accepted.**
   - **It only narrows what is accepted:** a sense split off at depth 0 is unchanged.
   - **It matches G.4.h's wording:** senses are separated by `;`, and a `;` inside a qualifier separates nothing.
   - **It prevents a real wrong answer.** たち, stored as "pluralizing suffix (esp. for people and animals; formerly honorific)", is in the bank. Under `tech.md` 1.1 read literally, "formerly honorific" would be a listed meaning of たち. With the deviation it isn't, and "pluralizing suffix" still is.
   - No lesson-linked meaning has a `;` inside brackets, so live behaviour is identical. The spec pins it, and the mutation in 1.4 is caught.
   - The Tech Lead should still record it, as `dev.md` asks: amend G.4.i point 1 or `tech.md` 1.1 step 3.
2. **`tech.md` 4.1 P8: the Developer is right.** See F8. I verified it on both builds.
3. **20-question submit time: accepted as database time, not grader time.**
   - Kana-only skip-tests took 0.72 to 1.08 s. Vocabulary-only took 1.00 to 1.22 s. The mixed and EXIT tests took 0.96 to 1.02 s.
   - None of them called the grader.
   - One non-listed answer in an otherwise identical EXIT took 12.96 s.
   - So `tech.md`'s "under 1 s" is marginal from this server, which is Neon round-trips to Frankfurt. P5's actual promise, "I never wait on the grader for them", holds.

---

# 5. Not verified

- **The app's screen.** I didn't see "Correct!" with nothing under it, because there's no simulator or browser on this server. The wire has no `feedback` key on any listed answer, and brief 6 says the card already shows "Correct!" alone when there's no comment. The Alpha run should look at it.
- **The review end-screen score.** It is computed in the app from `scored && correct`. I verified the fields, not the screen.
- **Placement, live.** It wasn't driven over HTTP. It is multiple choice, no placement file changed, and it never reaches `RecallGraderService`. Its specs pass. I judge that enough for an API-only diff.
- **Grader on, for practice and chapter tests.** I didn't use real-key calls there, to spare the free tier. A listed answer returns before `gradeOpen` whatever the grader's state, which the hang and off runs prove on those surfaces.
- **A real Gemini 503.** Not provoked. It takes the same `catch` into the fallback as a timeout, and the rejecting-grader spec pins the shortcut against it.

---

# 6. State left behind

- **Worktrees:** `.claude/worktrees/test-exact-meaning-grading` (detached at `5450607`) and `.claude/worktrees/test-emg-main` (detached at `453aedc`). Both are clean and safe to remove.
- **Throwaway branch `br-winter-poetry-baq6sbs4`:** learners `tst-emg-*` (listed in 1.1) with intake, mastery rows, assessment attempts (chapters 1 to 9 for `tst-emg-k1`) and practice sessions. Also `UserLessonSkip` rows for `tst-emg-k1`, chapters 8 and 9. No other learner's rows were touched.
- **Servers:** all API processes I started are stopped.
