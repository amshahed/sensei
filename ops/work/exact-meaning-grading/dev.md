# Dev notes: a listed meaning is marked right at once

Unit `exact-meaning-grading`. Developer, 2026-11-28. Branch `feat/exact-meaning-grading` from `main` `453aedc`, worktree `.claude/worktrees/exact-meaning-grading`. PR: https://github.com/amshahed/sensei/pull/112 (CI `verify` green on `5450607`).

---

# 1. What changed

API only, as `tech.md` section 2 lists. Nothing outside it, and no file PR #107 changes (checked with `gh pr diff 107 --name-only`).

| File | Change |
|---|---|
| `apps/api/src/recall/listed-meaning.ts` | **New.** `isListedMeaning(answer, meaning)`, tech 1.1 exactly: letters and digits only, lowercased; senses on `;`; each innermost `( … )` dropped or kept without brackets (2^n variants, only the two extremes above 6 parts); then a leading whole-word `to` may be dropped; an empty key never matches. Pure, no imports |
| `apps/api/src/recall/listed-meaning.spec.ts` | **New.** 56 cases: every P1 to P4 and P7 string in tech 4.1, plus empty or punctuation-only answers, a keyless meaning `(…)`, and the 6/7-bracket guard boundary. Meaning strings are verbatim from the throwaway branch |
| `apps/api/src/recall/recall-grader.service.ts` | The shortcut in the `meaning` case, before `gradeOpen`, returning `{ correct: true, scored: true, rating: ratingFromCorrect(true) }`. Doc comments on `RecallGrade.rating` and `feedback` updated |
| `apps/api/src/recall/recall-question.ts` | Doc comments only (see deviation 1) |
| `apps/api/src/recall/recall-grader.service.spec.ts` | Four new cases (listed answer; hanging grader; rejecting grader; non-listed answer still calls `gradeOpen` with unchanged input and its comment flows). Two existing cases moved to `'x; y'` |
| `apps/api/src/reviews/reviews.service.spec.ts` | One new case (hanging grader; result with no `feedback` key; `recordCheckResult` with `Rating.Good`; streak `review: true`). One existing answer changed |
| `apps/api/src/practice/practice.service.spec.ts` | One new case (hanging grader; `counted: true`; `Rating.Good` through the transaction client) |
| `apps/api/src/assessments/assessments.service.spec.ts` | New `it.each(['SKIP', 'EXIT'])` with a never-settling grader: `gradeOpen` not called, every result scored and right, `correct 4 = total 4`, `passed`, g1 written back with `Rating.Good`. Two existing answers changed and the default mock adjusted (section 2) |
| `apps/api/src/checks/checks.service.spec.ts` | P8 pin: an open check answered with its exact exemplar still calls `gradeOpen` and returns the model's comment |

# 2. Spec answers changed (tech 6, tasks 3 and 4)

Each of these answered with what is now a listed meaning, so the shortcut would have caught it and the test would no longer reach the grader path its name describes. Each now gets a non-listed answer and asserts `gradeOpen` was called.

- `recall-grader.service.spec.ts`, "a fallback-graded match still counts…" and "a model grade with an empty comment…": answered `'x'` against `accepted: ['x']`. Now a question with `expected` and `accepted` of `'x; y'`, answered `'x; y'`: the whole stored string is not one of its senses, so it still reaches the fallback and the model path. Both now also assert `gradeOpen` was called.
- `reviews.service.spec.ts`, "meaning answers are AI-graded and the rating flows into FSRS": `'sushi'` for "sushi" became `'raw fish on rice'`. `Easy` and "Exactly." still flow; it now asserts `gradeOpen` was called.
- `assessments.service.spec.ts`:
  - The default `gradeOpen` mock accepted `answer === 'please do'`. That answer no longer reaches the grader, so the mock now accepts a named paraphrase, `PARAPHRASE = 'do it, please'`, which isn't listed. `tech.md` allowed "adjusting the default `gradeOpen` mock if needed".
  - "grades meaning answers with the AI grader and skips it for blank answers": g1 `'please do'` became `PARAPHRASE`. Same assertions (one call, same `exemplar`, `correct 3 / total 4`).
  - "503s and leaves the attempt open when nothing could be graded": g1 `'please do'` became `PARAPHRASE`, so it still reaches the unscored fallback and the 503.
  - Every other test that uses `allRight` (g1 `'please do'`) now takes the shortcut instead of the mock. Each still asserts the same outcome, because the mock rated that answer `Good` anyway. I left them alone: they test streaks, replay, TTL and so on, not the grader.
- The rest of the suite passed unchanged. No other spec answered a meaning question with a now-listed answer through `RecallGraderService`.

# 3. Deviations from `tech.md`

1. **One extra doc comment.** Tech 2 says `recall-question.ts` changes "only in the doc comment on `accepted`". The `AnswerCheck` comment just above it says `meaning` is "graded by the AI open-answer grader", which is now only half true, so I updated it too: "One of the item's listed meanings is right at once (G.4.h); anything else is graded by the AI open-answer grader…". Comment only, no code.
2. **The default assessment mock** (section 2). Within what tech 6 task 4 allows, listed here so the Tester can see it.
3. **A `;` inside brackets doesn't split senses** (commit `fix(recall): a ';' inside brackets…`). Tech 1.1 step 3 splits on every `;` before brackets are handled. A `;` inside a qualifier would then make a fragment a listed meaning of its own: "water (esp. cool; or cold)" would accept **"or cold"**, with no grader call. The first `/code-review high` run (it reviewed the plan, PR #111) found this independently, and so did I when probing edge cases.
   - Senses are now split only on a `;` at bracket depth 0. After an unclosed `(`, nothing splits.
   - This only narrows what is accepted, and it matches G.4.h's wording: senses are "the parts … separated by ';'", and a `;` inside a qualifier separates no senses.
   - **No live meaning has a `;` inside brackets** (I checked all 198 distinct lesson-linked meanings), so live behaviour is identical and the spike count stays 44.
   - New spec case: "or cold" is rejected; "water" and "water esp cool or cold" are accepted; `'a (x; b'` doesn't split; `'a (x); b'` does.
   - **For the Tech Lead:** please confirm or revert. It's one function, `senses()`.

No other deviation. The seam, the return shape and the rating are as tech 1.1 and 1.2 say.

# 4. Verification

- `pnpm typecheck && pnpm lint && pnpm test` from the worktree: exit 0. 65 suites, 1648 tests (on the commit with deviation 3; 1647 before it).
- Targeted: `jest src/recall src/reviews src/practice src/assessments src/checks`: 10 suites, 250 tests.
- **The specs bite.** With the shortcut disabled (`false && …`), 3 `recall-grader.service.spec` cases fail, including the hanging-grader one, which fails on Jest's timeout. With `senses()` swapped back to `split(';')`, the bracket-`;` case fails. Restored afterwards.
- **Live-data reproduction of the Tech Lead's spike** (read-only Prisma `findMany` on `br-winter-poetry-baq6sbs4`, using the built `listed-meaning.js`): 209 lesson-linked VOCAB and GRAMMAR meanings. **44 vocabulary words** gain an accepted answer beyond the whole string, the PM's count exactly. Two grammar items gain one too: に's explanation without its brackets, and に/へ's without "To.". 隣 "next (to)" accepts "next", そこ accepts "there", as section 0 of `tech.md` says.

## 4.1 Real API, grader hanging (tech 4.3 B), throwaway branch

- API built from this branch (`nest build`) and started with `env -i`. Its environment was `DATABASE_URL` (the direct URL of `test-open-check-followup`, host `ep-small-firefly-bath9jbb`, `describe_branch` says `default: false`), `PORT=3299`, `DEV_USER_ID=dev-emg-1128` (a fresh user), `GEMINI_API_KEY=hang-test` (not a real key), and Clerk keys empty.
- `-r gemini-hang.cjs`, a throwaway scratch preload (never committed). It hangs every `generativelanguage.googleapis.com` fetch and prints `GEMINI_FETCH n`. Boot used `GEMINI_FETCH 1` (the startup model check).
- **Reviews, `POST /reviews/:itemId/answer`.** 17 listed answers, all `201`, `correct: true, scored: true`, **no `feedback` key**, each 0.18 s (the first was 0.54 s), counter still 1:
  - こんにちは "hello", "good day", "Hello!";
  - ありがとう "thanks", "thanks.";
  - すみません "excuse me";
  - はじめまして "how do you do";
  - 歳 "years old";
  - 水 "water";
  - 前 "in front of", "in front";
  - アメリカ "America";
  - 食べる "eat";
  - 行く "go";
  - 来る "come";
  - ごめんなさい "Im sorry";
  - 万 "10000".
- **Controls (P7).** These were "delicious" (おいしい), "helo" (こんにちは), "little" (ちょっと) and "a pen" (ペン). Each took **12.1 s** and came back `correct: false, scored: false` with no `feedback`. Each moved the counter by exactly 1 (2, 3, 4, 5).
- **P6 schedule.** 水 "water", 食べる "eat" (both listed) and kana あ "a" were each first contact in the same minute. All three rows have `stability 2.3065`, `reps 1`, `due − lastReview = 3 days`, mastery 0.0740. おいしい (unscored) has no row.
- **P8.** The lesson open check `cmwsgmdy5000t9offc0gvukvy` (ch17 l07, the self-introduction) was answered with its stored exemplar. It took **12.17 s**, and the counter moved 5 to 6, so lessons don't take the shortcut. See 5.1 for what it returned.
- **P5, skip-tests.** After intake, I took skip-tests of chapters 1 to 5 with every answer right: kana in rōmaji, and vocabulary as its **last** listed sense, brackets and "to" dropped, capitalised, with "!" ("Older brother!", "My pleasure!", "I look forward to working with you!", "How are you?!", "Please!").
  - Chapter 4 (20 vocabulary questions) and chapter 5 (20) were both `passed: true, correct 20, total 20`. Every result had keys `answer, correct, correctAnswer, itemId, prompt, scored` only.
  - The counter was 6 before and 6 after both submits.
- **Practice.** In a chapter 4 session, five listed answers ("School!", "Mother!", …) came back `scored: true, counted: true` in 0.21 to 0.27 s, and the counter was unchanged.
- Grader **on** (4.3 C) and grader **off** (4.3 A) are the Tester's. I didn't use the real Gemini key.
- No secret is in any file or log. `grep npg_` over the scratch logs comes back empty.

# 5. For the Tester: look hard at these

1. **Tech 4.1 P8 predicts the wrong result for lesson 120's open check.** It says that answered with its exemplar under a hanging grader, it "comes back unscored". It doesn't, on `main` or here. `GradingService.fallback()` exact-matches the exemplar, so it returns `correct: true, scored: true` (no comment) after the 12 s wait. That is today's behaviour, unchanged by this PR. What proves P8 is the **12 s wait and the counter moving by 1**, not the scored flag. An answer that isn't the exemplar would come back unscored, if you want that too.
2. **Skip-test submit time.** On this server, a 20-question submit took 0.88 to 1.14 s whether it held kana (no grader path at all) or vocabulary. That is Neon round-trips (20 FSRS writes plus seeding), not the grader: the counter didn't move. Tech 4.1's "under 1 s" will be marginal from here. The real signal is kana-only and vocabulary-only tests taking the same time, against about 12 s for a single non-listed answer.
3. **State on the throwaway branch.** `dev-emg-1128` now has intake, chapter 1 to 5 skip-test passes, mastery rows and one practice session. Use a fresh `DEV_USER_ID`.
4. **`accepted`, not `expected`.** The shortcut checks `question.accepted`, which for a meaning question is `[item.meaning]` (tech 1.2). Today they hold the same string, and the specs build through `recallQuestionFor`.
5. **The default assessment mock change** (section 2). The tests that still answer g1 `'please do'` now pass through the shortcut, not the mock.

# 6. For the Project Manager (outside this plan)

- **Full-width Latin letters don't match.** A learner typing on a Japanese keyboard's full-width mode sends "ｈｅｌｌｏ", which `\p{L}` keeps as different letters from "hello". It fails safe: it goes to the grader as today. Folding it would need Unicode NFKC normalisation (the standard way to fold full-width forms into plain ones) before the comparison key. That's a rule change, so I didn't add it. It's a small follow-up if Alpha shows it.
- The known costs already in `tech.md` section 0 (隣 "next", そこ "there", どれ "which", いただきます "thank you") reproduce on live data as described.
- **A `;` in a grammar explanation would split it.** The first review run suggested treating a GRAMMAR meaning as one sense, or splitting only VOCAB. Brief 3.2 says "the same rule applies to them", so that's a product call, and I didn't make it. Today no grammar explanation contains a `;`, so nothing is affected. If authoring ever writes one ("Marks the topic; contrasts it with…"), the first clause alone would be accepted without the grader. A narrowing for the PM to decide, or a style rule for authoring (no `;` in explanations).
- **隣 "next" has no recorded PM ruling.** The same review noted that `CHECKPOINT.md` says it "is covered by brief 3.2", but brief 3.2's known-cost list names only そこ, どれ and いただきます. Brief 6 asked to be told about cases like this. The rule ships accepting it unless the PM narrows it.
- **Ops nits from that review**, for the Lead (state files, not this PR):
  - Blocker 6's sample list leaves out どれ "which".
  - `CHECKPOINT.md` is over 80 lines.
  - G.4.h says a chapter test sends "up to 20 answers at once". It is up to 20 meaning answers, 4 in flight (`CONCURRENCY`).

# 7. Code review

**Run 1** (`/code-review high`, no target). It ran in the main checkout, which is on `main`, so it reviewed PR #111 (this unit's brief and plan) instead of the code.
- Two of its findings are about the code all the same. Both are handled:
  - the P8 mis-prediction (section 5.1);
  - the `;` inside brackets (deviation 3, fixed).
- Its grammar `;` and ops nits are in section 6.

**Run 2** (`/code-review high 112`), on the PR. Four findings, and none changes the code:

1. **"さん accepts 'san', because it's stored as 'Mr; Mrs; Miss; Ms; -san'". The premise is wrong.** On the throwaway branch, `ja:vocab:さん` is stored as **"Mr"** (one lesson). "san" has the key `san` against `mr`, so it goes to the grader as today. The finding assumed JMdict's full gloss list, which this item doesn't carry.
2. **"A bracketed '(not)' can flip a meaning". This one is real, but for words not yet taught**, so it goes to the PM (brief 6):
   - Today, 全然 "(not) at all", ちっとも "(not) at all" and 決して "(not) ever" exist as items in **0 lessons**. If they are taught, "at all" and "ever" would be accepted at once, which is close to the opposite meaning.
   - No taught word is affected (I checked every lesson-linked meaning).
   - Narrowing the rule (for example, never drop a bracket whose words are only "not") is a PM call. It fails safe, toward the grader. I haven't made it, so as not to change the product rule on my own.
   - **This needs a PM ruling before any of these words is authored into a lesson.**
3. **Full-width input never matches.** Already in section 6 for the PM. It fails safe, and NFKC would be a rule change.
4. **"The whole recap text, 'thank you; thanks', still waits on the grader". Intended by the plan.** G.4.h point 2 says the listed meanings are the *parts*. Tech 4.1 P7 rejects "hello good day" (two senses joined), and tech 6 task 3 pins `'x; y'` reaching the grader. That answer is never "couldn't grade": the fallback accepts the whole string. Only the wait remains. If Alpha shows learners typing the whole recap text, that's a one-line follow-up for the PM (also accept the whole string).
