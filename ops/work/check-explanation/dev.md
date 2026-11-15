# Dev notes: what a lesson check tells me after I answer

Unit `check-explanation`. Written by the Developer, 2026-11-15, against `tech.md` (B.2.b, H.2.d, F.2.e) and `brief.md` (P1 to P6). Branch `feat/check-explanation`, worktree `.claude/worktrees/check-explanation`, from `origin/main` `c0626c8`. PR [#78](https://github.com/amshahed/sensei/pull/78), head `ad7aadb`.

---

# 1. What changed

| Task | Files | What |
|---|---|---|
| T1 | `apps/api/src/common/answer-romaji.ts` (new) | `SPOKEN` table: grading pattern plus display spelling for は, へ, を, こんにちは, こんばんは. `answerWords`, `isLoneKana`, `answerRomaji(answer, { kanaTarget })`. `matchesSpoken` in `writing-eval.service.ts` reads the same table |
| T2 | `answer-romaji.ts` `normalizeJapanese`, used by `WritingEvalService.normalizeJapanese` | `toHiragana(..., { convertLongVowelMark: false })`, then each ー after a kana becomes that kana's vowel (H.2.d). ー after ん or っ is left as it is |
| T3 | `answer-romaji.ts` `answerFormsOf` and `typedAnswersMatch`; `writing-eval.service.ts` `answerForms(answer, { kanaTarget, prompt })`; `testing/typed-answers.ts` (new) | Kana stored: the answer as written plus `answerRomaji`. Rōmaji stored: the first kana run or word in the prompt the grader takes for the answer. `answerForms` returns the pair only if `exactMatch` accepts both forms against the stored answer. `exactMatch` now delegates to the shared `typedAnswersMatch`, passing its kuromoji join |
| T4 | `packages/types` `CheckResultDto`; `checks.service.ts` | `explanation?` (non-blank `data.explanation`, as written, every result and format); `answerForms?` (closed TYPED checks only, when not null). Lesson payload unchanged |
| T5 | `apps/mobile/src/lesson/LessonPlayer.tsx` | `ResultPanel` in the `Screen` footer above Next: `Correct!` or `Not quite.`, then `Answer: <kana or correctAnswer>`, then the rōmaji (miss with forms only), then the explanation. Inline result line removed. `Keyboard.dismiss()` when the result arrives. No `numberOfLines` anywhere. The panel is capped at 45% of the window and scrolls only beyond that (deviation 7) |
| T6 | `course-rules.ts`, `typed-reading.ts`, `lesson-prompter.ts` | Gate errors `check qN: needs an explanation` and `check qN: the explanation spells out "<rōmaji>" before check qM asks for it`. The transform's appended explanation uses `answerRomaji`. Prompt carries the four lines from `tech.md` section 2 |

Specs added or extended: `answer-romaji.spec.ts` (new), `writing-eval.service.spec.ts` (ー cases, `answerForms` property test over 77 fixture answers), `checks.service.spec.ts` (explanation and forms, including a real-grader miss-then-retry for きっぷ, the lesson 43 sentence and こんにちは), `lesson.mapper.spec.ts` (new: no `answer`, `explanation`, `answerForms` or `data` on a `CheckDto`), `course-rules.spec.ts` (16 new cases), `typed-reading.spec.ts` (`konnichiwa`), `lesson-prompter.spec.ts` (the four lines).

Existing fixtures in `course-rules.spec.ts`, `typed-reading.spec.ts` and `draft.spec.ts` gained an `explanation`, because a draft without one is now rejected. No assertion was loosened.

# 2. Verification

- `pnpm typecheck` 4/4, `pnpm lint` clean, `pnpm test` 59 suites, 1,357 tests, all passing (after the review fixes, commit `ad7aadb`).
- `expo export --platform ios`: bundled, 800 modules, no errors.
- Live data, read-only (Neon default branch, 2026-11-15): 11 TYPED checks, matching the fixture and the `published/` copies. Lesson 43 q4 already reads "...then は (said 'wa'), then いしゃ, then です." (the Lead's republish).
- Not done: the simulator screenshot T5 asks for. This session has no tool that can tap the simulator, the app has no deep link into a lesson, and answering a check writes mastery rows to the live branch, which I was told not to touch. P2 rests on the Tester's simulator run.

# 3. T6 gate scan

Read-only: a script in my scratchpad loaded every draft in the main checkout's `tools/authoring/output/` (40 files, `.rejected.json` included, `.prev.json` and critiques excluded) and `published/` (5), and ran `checkCourseRules` in memory twice, once on `origin/main` code (main checkout, clean at `c0626c8`) and once on this branch. `--recheck` wasn't used because it writes files.

| | Result |
|---|---|
| Files | 45 |
| Checks | 436, every one with an explanation |
| Typed checks | 71 |
| **New errors** | **0** |
| New warnings | 0 |
| Errors removed | 0 |

Rerun after the review fixes (`ad7aadb`): still 0 new errors, 0 removed, 0 new warnings.

Errors that existed before and are unchanged: `ch04-l06` (lesson 20) 3 particle errors in `output/` and `published/`, plus the rejected drafts `ch02-l03` (1), `ch03-l01` (1), `ch03-l06` (1), `ch07-l05` (5).

The P5 rule was also checked against real drafts with an explanation changed in memory: lesson 19 q1 "A ticket, kippu, gets you on." is rejected for q8; lesson 43 q1 "Say tomodachi wa isha desu." is rejected for q4; lesson 13 q3 "やま is yama." passes, because q1 already asked for `yama`.

# 4. Deviations from tech.md

1. **Pure helpers moved into `common/answer-romaji.ts`.** `normalizeJapanese`, `isRomajiAnswer` and `kanaCandidates` live there, and `WritingEvalService.normalizeJapanese` delegates to it. The P5 gate needs to judge a rōmaji-stored answer against its prompt the way grading does, and the gate is pure and has no kuromoji. Behaviour is the same.
2. **What counts as a rōmaji-stored answer in the P5 rule.** An answer counts only when it is Latin-only *and* its prompt shows kana that normalise to it, which is the same notion `answerForms` uses. Otherwise an English typed answer that happens to be valid rōmaji ("tea", "name", "home") would be protected, and "おちゃ is tea." before "What does おちゃ mean? Type it in English." would be rejected under P5. Cost: a rōmaji-stored recall check whose prompt doesn't show the kana isn't protected. The new prompt line forbids rōmaji-stored answers, so new ones shouldn't appear.
3. **"Single kana" is one sound.** The skip covers one kana with an optional small ゃ, ゅ or ょ (きゃ, kya), not only one character, matching the brief's "pointing out one kana's sound is fine".
4. **Transform fallback.** The appended explanation is `answerRomaji(surface) ?? toRomaji(surface)`. The fallback only applies when the surface isn't all kana, so it can't print `konnichiha`.
5. **`answerForms` is sent on right answers too**, as `tech.md` 1.2 defines the field. The app shows it only after a miss.
6. **Prompt placement.** The three explanation lines are in the always-present "Rules:" block. The "Write Japanese in kana" line is replaced where it was, in "Course rules", which only appears with course context.
7. **Result panel capped at 45% of the window** (review finding 4). It scrolls inside itself only past that. Real results are far below the cap (the worst live one is about 140 pt against about 300 pt on an SE), so P2's "no scroll" holds. Without the cap, a long open-check model answer at a large text size could push Next off the screen and strand the learner. Not seen on a device: I couldn't drive the simulator.
8. **`exactMatch` delegates to a shared `typedAnswersMatch`** (review findings 6 and 10). The comparison logic now lives once, in `common/answer-romaji.ts`. The grader passes its kuromoji join; the gate uses the default, whitespace removal, which is the grader's own no-tokenizer path. All existing grading specs pass unchanged, and a new spec checks the two agree on every case in the grading tables.

# 5. Code review (`/code-review high`, 10 findings)

| # | Finding | Disposition |
|---|---|---|
| 1 | P5 folding turns short answers into English words: いい → `ii` → `i`, どう → `do`, and あれ is `are` outright, so ordinary English in an earlier explanation rejects the draft | **Real, sent to the Tech Lead (section 6).** The match is exactly as `tech.md` 1.5 specifies, and its risk row gives the remedy to the Tech Lead. No current draft is affected (scan: 0). Exposure in the outline is あれ (lesson 57), どう (61) and いい (107), all wave 2 or later |
| 2 | `answerRomaji` spells a hiragana ー as a hyphen: らーめん → `ra-men` | **Fixed.** Each word goes through `normalizeJapanese` before `toRomaji`, so `raamen`. Spec added |
| 3 | A reading check the transform appends is checked for giveaways against explanations the model wrote earlier | **Rejected.** That is a true positive. If an earlier explanation says "gakkou" and the lesson then asks the learner to type がっこう, P5 is broken whoever added the check. The draft goes back through the told-why redraft loop (F.2.c), which is the intended path |
| 4 | The result panel in a non-scrolling footer could push Next off a small screen | **Fixed** with the 45% cap (deviation 7) |
| 5 | An answer stored without spaces (わたしはがくせいです) would show `ha` for the particle | **Rejected: the premise is wrong.** The H.2.a/H.2.b gate rule rejects it: `check q1: put the particle in "わたしはがくせいです" in its own word` (checked at lesson 43). Before particles are taught, no answer can contain one. This is the reasoning in `tech.md` 1.2 |
| 6 | The gate's rōmaji-stored test compared exactly, while `answerForms` uses the spoken-particle table, so `watashi wa gakusei desu` was shown but not protected | **Fixed.** Both now use `answerFormsOf` and `typedAnswersMatch`. Spec added |
| 7 | `isFairTypedReading` (22b P2) still uses raw `toRomaji`, so a prompt giving `konnichiwa` would pass as fair | **Out of scope, noted for the Tech Lead.** It can't happen today: the typed-reading lessons are 15 to 20, and none of their targets is a spoken word or has ー |
| 8 | The panel ignores `feedback` and shows an open check's model answer as `Answer:` | **Out of scope** (brief section 5, with its trigger) |
| 9 | `answerForms` is computed on right answers too | **Kept as planned.** The cost is two to a few `exactMatch` calls on strings of a few characters, and B.2.b defines the field on every closed typed result |
| 10 | Duplicated folding and shown-rōmaji logic | **Fixed:** `foldedWords` reuses `looseRomaji`, and the forms logic is in one place. `WritingEvalService.normalizeJapanese` stays as a one-line wrapper, because it is the service's public method and its specs use it |

# 6. For the Tester to look at hard

- **P2 on `Sensei 22a SE3`.** The tallest panel is lesson 43 q4 typed wrong: verdict, sentence answer, rōmaji and explanation. Also q5 (long choices) answered wrong, and a typed submit with Return so the keyboard is up when the result arrives. The panel is a `ScrollView` capped at 45% of the window. Confirm that a real result sizes to its content, with no inner scroll and no empty space, and that the question area above still scrolls.
- **H.2.d changes what's accepted.** Katakana ー spelled おう or えい is now wrong: `nouto` for ノート, `kouhii`, `supoutsu`, `keiki` for ケーキ. Intended. Newly accepted: `nooto`, `no-to`, `のーと`, and a hiragana word written with ー (`raamen` for らーめん, which used to fail). Nothing that passed before fails except the おう/えい spellings of katakana ー. No live check has ー.
- **More rōmaji-stored answers than `tech.md` lists.** Besides lessons 4, 8 and 13, wave 1 lessons 38 (`ch07-l06`: han, mara, ramu, run ×2) and 39 (`ch07-l07`: nooto, supootsu, poketto) store rōmaji. All are in the fixture and all get forms. Lesson 39's `nooto` was a live grading bug in waiting: a learner typing ノート in kana would have been marked wrong before H.2.d.
- **Tester-API proof** (each of the 11 live typed checks: miss, then post the returned `answerForms.romaji`, expect `correct: true`) is not run here. It needs a throwaway Neon branch. The in-process equivalent is in `checks.service.spec.ts` and `writing-eval.service.spec.ts`.

# 7. For the PM and Tech Lead (outside this unit)

- **Tech Lead, before wave 2: P5 false positives on short answers (review finding 1).** Whole-word matching can't tell rōmaji from English when they are spelled alike. Folding makes it worse for short words.
  - Outline exposure: あれ (`are`, lesson 57) collides outright. どう (`dou` → `do`, lesson 61) and いい (`ii` → `i`, lesson 107) collide only because of the vowel folding.
  - A lesson that types あれ and earlier says "things that are far" will be rejected. Each rejection costs one told-why redraft, about $0.07, and likely clears it.
  - Options: (a) expand macrons into long vowels (ō → ou) and stop collapsing doubled vowels. That fixes どう and いい, but `gakko` is no longer caught, which `tech.md` asks for. (b) Skip answers whose rōmaji is three letters or fewer. (c) Downgrade the rule to a warning, the remedy `tech.md`'s risk table already names.
  - I haven't changed the specified match. This is your call.
- **Tech Lead: `isFairTypedReading`** could check the `answerRomaji` spelling as well as `toRomaji` (review finding 7). It can't happen in lessons 15 to 20 today.

- **Prompt wording risk.** The `tech.md` line "A typed correctAnswer is always the Japanese in kana, never rōmaji" could be read by the drafter as "typed answers are always Japanese" and push English meaning checks ("Type it in English" → `school`) out of typed questions. Worth a look in wave 2's first drafts.
- The app now says `Not quite.` for an open check the grader couldn't judge, as it said `Answer: X` before. Already out of scope with a trigger (brief 5).
