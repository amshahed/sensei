# Dev notes: authoring polish

Developer, 2026-11-23. Branch `feat/authoring-polish` from `origin/main` `80cc861`, worktree `.claude/worktrees/authoring-polish`.

Database evidence uses the throwaway Neon branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`), a copy of live from 2026-11-22 plus lesson 120, through its direct URL in `DATABASE_URL` only. Nothing was written to the default branch.

## T0 Shuffled options (P8)

**Changed**
- `common/shuffle.ts`: Fisher-Yates moved out of `assessment-sample.ts`, exported, unchanged. `assessment-sample.ts` imports it.
- `lesson.mapper.ts`: `toLessonDetailDto(lesson, random)`, `random` required; `mapCheck` shuffles the filtered copy of `data.choices`.
- `lessons.service.ts` / `lessons.module.ts`: `LESSON_RANDOM` token, `Math.random` provider, injected.
- `checks.service.ts`: stale "option IDs" comment corrected. `LessonPlayer.tsx`: fetch-once comment.
- `testing/random.ts` (new, spec-only helpers): `mulberry32`, `keepOrder`, `reversing(n)`. Shared by the five specs rather than copied into each.

**Course-wide answer-first count** (`toLessonDetailDto` with `Math.random` over every lesson on the branch, read-only, $0)

| Run | Lessons | MC checks | Answer served first | Slots 1 to 4 | Authored first |
|---|---|---|---|---|---|
| 1 | 108 | 668 | 152 | 152, 158, 177, 181 | 652 |
| 2 | 108 | 668 | 176 | 176, 189, 141, 162 | 652 |
| 3 | 108 | 668 | 185 | 185, 169, 141, 173 | 652 |
| 4 | 108 | 668 | 183 | 183, 149, 170, 166 | 652 |
| 5 | 108 | 668 | 170 | 170, 169, 167, 162 | 652 |
| 6 | 108 | 668 | 181 | 181, 157, 155, 175 | 652 |

Expected 167, Tester band 112 to 222. Every served option list still contains its answer (the script throws otherwise).

**Lesson 120** (`foundation-ja-ch17-l07`), 20 showings through the mapper: 12 MC checks; answer on top 62 of 240 (expected 60, band 26 to 94); every check showed its answer in all 4 slots; top-tap score per showing `3,4,4,3,2,4,2,3,3,2,3,3,4,4,1,4,2,4,3,4` (today 12 every time).

## T1 Kanji supplement (P1, P2 data)

**Changed**
- `data/curriculum/kanji-supplement.json` (new): `meanings` {校: school}, `words` for 食 飲 読 書 行 来 見 聞.
- `ingest/supplement.ts`: `KanjiSupplement`, `EMPTY_KANJI_SUPPLEMENT`, `loadKanjiSupplement()`.
- `ingest/kanji.ts`: `buildKanjiItem(char, supplement = empty)` with both guards; `data.word_reading` added only for a named kanji, so the other 94 rows build byte-identical data. `ingestKanji(prisma, source, { dryRun, supplement })` throws on a non-N5 character before any read or write. New exported `diffKanjiRows()` prints `display`, `reading`, `meaning` and each `data` key that differs (deep, key-order-blind).
- `ingest/index.ts`: `--dry-run`, refused for every kind but `kanji` (before connecting), so a dry run can never write.
- Fixture: real KANJIDIC2 records for 校 and 食 appended to `__fixtures__/kanjidic2-real-sample.json`.

**Dry run on the throwaway branch** (`ingest:items kanji --source <main>/apps/api/data/sources/kanjidic2-en-3.6.2.json --dry-run`, read-only):

```text
ja:kanji:飲  data.word_reading: (absent) → "の.む"
ja:kanji:見  data.word_reading: (absent) → "み.る"
ja:kanji:校  meaning: "exam" → "school"
ja:kanji:行  data.word_reading: (absent) → "い.く"
ja:kanji:書  data.word_reading: (absent) → "か.く"
ja:kanji:食  data.word_reading: (absent) → "た.べる"
ja:kanji:読  data.word_reading: (absent) → "よ.む"
ja:kanji:聞  data.word_reading: (absent) → "き.く"
ja:kanji:来  data.word_reading: (absent) → "く.る"
ingest:items kanji --dry-run — 9 of 103 N5 kanji rows would change; nothing written
```

Exactly the nine rows and fields tech.md 3.1 names. The Lead's live step (3.3) is unchanged; the command is the same with `--source ./data/sources/kanjidic2-en-3.6.2.json` from the main checkout.

## T2 Verb kanji questions (P2)

- `recall-question.ts`: `kanjiWord(item)` from `data.word_reading` (`た.べる` → `{ display: 食べる, answer: たべる }`, via `kanjiReading()`); `RecallQuestion.display`; the verb branch (`Type the reading of 「食べる」`, expected and accepted `たべる`, check `reading`). Every other kanji falls through to the unchanged code.
- `mastery.service.ts` (reviews) and `practice.service.ts` take `display` from the question; their `learnerSurface` imports went with it. Chapter tests already show only the prompt, which now says 「来る」.
- Specs: `recall-question.spec.ts` (食, 来, 校, 生 bare stem, recap card unchanged), `recall-grader.service.spec.ts` on the real `WritingEvalService` (たべる, taberu, タベル right; しょく, shoku, くう, た, たべ wrong), `mastery.service.spec.ts` and `practice.service.spec.ts` (display 食べる; practice grades たべる right and しょく wrong).

## T3 Example readings (P3)

- `lesson.mapper.ts`: `mapTeach()` and `readingRepeatsJapanese()`. Ignored when comparing: whitespace, `ANSWER_PUNCTUATION`, 「」『』・…. ー is kept.
- `teach.ts`: example `reading` optional, kept only when a string. `LessonPlayer.tsx`: reading rendered only when present (ternary, so an empty string never lands outside `<Text>`).
- **Reach on the branch** (mapper over all 108 lessons, read-only): 390 example blocks with a reading; 299 lose it; 34 kanji examples and 57 kana examples keep it. The script throws if any kanji example lost its reading; none did. Samples kept: `こえ / koe`, `あい / ai` (rōmaji readings in the kana chapters).
- `pnpm --filter mobile typecheck` clean. `expo export --platform ios` bundled (3 MB hbc).
- I left `teach.ts` in its existing wider formatting rather than let the api Prettier config reflow the whole file; only the changed lines differ.

## T4 Drafter context (P4): deviation from tech.md 1.4

**Deviation.** tech.md 1.4 defines "new" as `ctx.targets`: the known lists exclude this lesson's target surfaces and the NEW line lists them. That premise is wrong for this outline. **22 of 120 lessons re-target items an earlier lesson taught**, and **all 12 audio lessons (26, 48, 50, 56, 63, 64, 71, 96, 105, 106, 118, 119) re-target only earlier items.** Built as written, lesson 26 would have told the drafter that こんにちは, ありがとうございます, すみません and はじめまして are new ("never say they already know them") and dropped them from the known list. That causes the opposite defect in exactly the lessons left to draft.

**What I built instead**, same approach, corrected definition:
- `CourseContext` gains three additive fields, all computed by id in `courseContextFor`: `newTargetIds` (the lesson's non-kanji targets that no earlier lesson's `itemIds` contain), `earlierWords` (vocab surfaces from earlier lessons only) and `newKanji` (this lesson's kanji no earlier lesson taught). `words`, `grammar`, `kanji` and `targets` are unchanged, so the gate is unchanged (tech.md's requirement).
- `courseContextBlock()`: `GRAMMAR TAUGHT IN EARLIER LESSONS` drops new grammar by id; `WORDS THE LEARNER KNOWS (from earlier lessons)` is `earlierWords`; `NEW IN THIS LESSON (...)` lists new vocab then new grammar. For F-Kanji, `KANJI FROM EARLIER LESSONS` and `NEW KANJI IN THIS LESSON` replace `KANJI THE LEARNER HAS MET` (added after code review, below). Kana targets aren't listed (no kana lesson is left, and kana have their own line).
- A homophone can sit on both lines, which is the truth: さん (after a name) is taught before 三 (read さん) is, so the lesson that introduces 三 lists さん as known and as new. My first version dropped known words by surface and lost the earlier さん; code review caught it.

**Tech Lead to confirm** this reading of 1.4. The rejected alternative (literal 1.4) is above.

**For the PM (P4's reach):** with the corrected rule, the NEW line is `(none)` for every audio lesson, because the outline introduces nothing new in them. So P4 changes nothing for the audio wave's targets; it protects F- lesson redrafts. If the audio drafts do introduce phrases, they come from outside the outline's targets, which the existing "uses only the words listed above" rule already forbids. Brief section 3 assumed "speaking lessons introduce phrases"; the outline says they don't.

**Lesson 26's built prompt** (real `skeleton.json`, `buildDraftPrompt` with no items, no model call), course-context block:

```text
foundation-ja-ch05-l06 I-Speaking Greetings out loud
COURSE CONTEXT: this is lesson 26 of 120. The learner knows ONLY what is listed here.
KANA THE LEARNER CAN READ: あ い う え お か き く け こ さ し す せ そ た ち つ て と な に ぬ ね の は ひ ふ へ ほ ま み む め も や ゆ よ ら り る れ ろ わ を ん が ぎ ぐ げ ご ざ じ ず ぜ ぞ だ ぢ づ で ど ば び ぶ べ ぼ ぱ ぴ ぷ ぺ ぽ ゃ ゅ ょ っ
Long vowels: taught.
GRAMMAR TAUGHT IN EARLIER LESSONS: (none)
PARTICLES NOT TAUGHT YET: は か の も が に を へ で な と ね よ や から まで. Don't use them as particles in Japanese. A kana shown on its own is fine when punctuation or English sets it apart, as in "と: そと" or "In はな, は says ha."
WORDS THE LEARNER KNOWS (from earlier lessons): かぎ ごはん かぞく みず ちず ともだち でんわ こども かばん えんぴつ いしゃ おちゃ じしょ しゃしん としょかん おかあさん おとうさん おにいさん おねえさん えいが がっこう いっしょ ちょっと きっぷ ざっし こんにちは おはようございます こんばんは さようなら おやすみなさい ありがとう ありがとうございます すみません ごめんなさい どういたしまして はい いいえ どうも どうぞ おねがいします はじめまして よろしくおねがいします こちらこそ おげんきですか そうです いただきます ごちそうさまでした いらっしゃいませ ください もういちど
NEW IN THIS LESSON (the learner meets these here for the first time; never say they already know them): (none)
KANJI: none. This is not a kanji lesson, so write everything in kana.
```

**NEW line for the 12 audio lessons** (same way):

```text
26 I-Speaking | (none) | targets 4
48 I-Speaking | (none) | targets 4
50 I-Listening | (none) | targets 4
56 I-Speaking | (none) | targets 4
63 I-Listening | (none) | targets 4
64 I-Speaking | (none) | targets 4
71 I-Speaking | (none) | targets 4
96 I-Speaking | (none) | targets 5
105 I-Listening | (none) | targets 4
106 I-Speaking | (none) | targets 4
118 I-Listening | (none) | targets 4
119 I-Speaking | (none) | targets 8
```

## T5 Gate (P5, P6, P7)

- `course-rules.ts`: `kanaInstructionProblems` (P5, tech.md's regex verbatim, closed typed checks only); `exampleReadingProblems` (P7, tech.md 1.6 as written); `SELF_CORRECTIONS` warnings over every learner field (P6, the seven patterns, straight and curly apostrophes, "you don't know … yet" within 40 characters and no full stop).
- `review.ts`: exported `courseRuleFindings(draft, skeleton)` (same `courseContextFor` and `checkCourseRules` publish uses), printed before the editor opens: warnings, and since code review any error too, marked "publish will refuse this". A missing skeleton prints a one-line notice instead of failing the review.
- Specs in `course-rules.spec.ts` use the verbatim corrections.jsonl prompts (ch04-l06 q2, ch08-l03 q4), the verbatim 109, 120 and 99 text, and lesson 115's verbatim example, plus every pass case tech.md lists.

**Deviation (method only): the gate scan isn't `authoring:draft --recheck`.** `--recheck` only re-reads `<id>.failed.json` and rejected drafts, so it never looks at an approved draft. I ran the gate directly instead, $0, no model: every lesson draft in `output/` and `published/`, both `.prev.json` files and the 15 `corrections.jsonl` originals, through the gate on `main` (the main checkout) and on this branch, then diffed. Script: `checkCourseRules(draft, courseContextFor(skeleton.json, id))`.

```text
drafts: 216 files, 0 new errors, 0 new warnings
prev: 2 files, 0 new errors, 0 new warnings
corrections: 15 files, 6 new errors, 2 new warnings
  + error   corrections#2 foundation-ja-ch04-l06  check q2: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + error   corrections#2 foundation-ja-ch04-l06  check q4: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + error   corrections#2 foundation-ja-ch04-l06  check q6: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + error   corrections#2 foundation-ja-ch04-l06  check q8: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + error   corrections#2 foundation-ja-ch04-l06  check q10: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + error   corrections#3 foundation-ja-ch08-l03  check q4: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"
  + warning corrections#14 foundation-ja-ch16-l03  teach[4]: may be the writer correcting itself: "you don't know くるま yet"
  + warning corrections#14 foundation-ja-ch16-l03  teach[4]: may be the writer correcting itself: "let's use words you know"
```

Exactly tech.md section 0's spike: nothing new on any approved or current draft (216 files: 108 in `output/`, 108 in `published/`), and the six "in kana" and two self-correction hits on the pre-edit originals. P7 has no pre-edit hit because the 98 and 115 originals weren't stored (tech.md section 0); its spec carries 115 verbatim.

**`authoring:review` on a fixture** (the pre-edit 109 draft from corrections.jsonl #14, copied into the worktree's gitignored `output/`, `EDITOR=true`, fixture and its approved copy deleted after):

```text
$ ts-node -r tsconfig-paths/register src/authoring/review.ts foundation-ja-ch16-l03 --skeleton /Users/sh/workspace/sensei/tools/authoring/output/skeleton.json
authoring:review — opening "foundation-ja-ch16-l03" (F-Grammar)
  [course rules] warning: teach[4]: may be the writer correcting itself: "you don't know くるま yet"
  [course rules] warning: teach[4]: may be the writer correcting itself: "let's use words you know"

Decision: APPROVE  (9/9 checks pass)

Approved → /Users/sh/workspace/sensei/.claude/worktrees/authoring-polish/tools/authoring/published/foundation-ja-ch16-l03.json
Run: pnpm --filter api authoring:publish foundation-ja-ch16-l03
```

## T6 Verification and PR

- `pnpm typecheck && pnpm lint && pnpm test`: green, 64 suites, 1557 tests (1486 at main before this unit).
- `pnpm --filter mobile typecheck`: clean. `expo export --platform ios`: bundled.
- PR #95 against `main`. After the review fixes (`e541cb5`): 64 suites, 1570 tests, typecheck and lint clean. The gate scan, lesson 26's prompt and the audio NEW lines were rerun on the fixed code and came out identical. CI `verify` green on `e541cb5`.

## What I could not check

- **The simulator.** This session can't tap it, so P1 (recap card for lesson 76), P2 (review, practice and chapter 14 test on screen), P3 (one line on screen) and P8 (top-tap runs, before and after submitting) are unscored in the app. All four are the Tester's, per tech.md section 4.
- **The live kanji apply on the throwaway branch.** I ran only the dry run there. tech.md 3.2 gives the apply on the branch to the Tester, and P2's on-screen check needs it (`word_reading` must exist on the branch's rows).
- **The Tester-API P8 count** through a running API. My count goes through `toLessonDetailDto` directly, which is the function the route calls, but not over HTTP.

## For the Tester to look at hard

1. **T4's deviation** (above). Check lesson 26 and an F- lesson's prompt, and whether the Tech Lead accepts the corrected definition.
2. **P8 holds still on screen** only because the app fetches once per showing. Nothing in this PR changes that; the comment at `getLesson` is the guard. Before-and-after-submit screenshots are the evidence.
3. **App and API contract (P3).** An example's `reading` may now be absent. An app build from before this PR drops an example block without a reading entirely, so the old app against the new API would lose 299 example blocks. No API is deployed (Railway isn't provisioned) and Expo Go runs from the same checkout, so there's no skew today. It matters the day an API is deployed ahead of an app build.
4. **P2 grading:** only たべる is right for 食べる, so a learner mid-schedule who learned 食 as しょく now gets it wrong. Intended (G.4.f), and item IDs and FSRS rows are unchanged.
5. **P6 noise:** `wait,` has fair uses in listening lessons ("Wait, listen again"). It's a warning only, and 0 hits on today's 216 files.

## For the Project Manager (outside this plan)

- **Findings inside the review file.** `authoring:review` prints the course rules before the editor opens, as planned. With an interactive editor that takes the screen (vi), they're off screen while the PM reads. Putting them at the top of the review template would keep them in view. Small, but it's a new behaviour, so it's a backlog line, not part of this PR.
- **Placement still asks 食 with く(う)** (tech.md section 5, already flagged by the Tech Lead).
- **P4 has no effect on the audio wave's targets** (T4 above): every audio lesson's targets were taught earlier.

## Code review (`/code-review high` on PR #95)

Ten findings. Eight fixed in `e541cb5`, one partly fixed, one answered with a comment fix and no code change. The reviewer scanned the drafts too: none of these fires on any draft today. Findings 1 to 4 would have hit future drafts, most likely the audio wave.

| # | Finding | Disposition |
|---|---|---|
| 1 | P7 false error on 「」 in a kana example (`「はい」 と いいます` / `hai to iimasu`) | **Fixed.** Quote marks are read past like ・ and … (`READING_MARKS`). Japanese with Latin letters or digits (Tシャツ, 3じ) is skipped: the matcher can't fold it |
| 2 | P7 false error on macron rōmaji (`kōhī`, `ohayō gozaimasu`) | **Fixed.** `macronSpellings()` tries each way to type a macron (ō as oo or ou, ē as ee or ei), capped at 256 spellings |
| 3 | P7 false error on a joined particle in rōmaji (`わたしは がくせい です` / `watashi wa …`), and on an English-only pronunciation note | **Joined particle fixed:** a fallback splits a trailing は/へ/を off its word for rōmaji readings only. **English-only note not fixed, on purpose.** There's no mechanical way to tell "koh-hee, both vowels held" from a wrong rōmaji reading without guessing at English. There are 0 such readings in 216 files. tech.md's risk table names this path: if the audio wave hits it, the Tech Lead narrows the skip rule |
| 4 | P5 refuses "the word written in katakana" | **Fixed.** A lookbehind spares "written", "spelled" and "spelt in …". "(katakana)" still errors, as tech.md specifies |
| 5 | P4 dropped known words by surface, so an earlier homophone vanished | **Fixed, and real in the outline:** さん (after a name) was dropped in the lesson that introduces 三 (さん). `earlierWords` is now built by id |
| 6 | P4 leaves F-Kanji saying "KANJI THE LEARNER HAS MET" over the lesson's own kanji | **Fixed** with `newKanji` and a split kanji line. This goes beyond tech.md 1.4, which only split words and grammar. P4's promise covers it, and it's one line. Tech Lead to confirm. No F-Kanji lesson is left to draft, so only redrafts benefit |
| 7 | `authoring:review` shows warnings only, but a draft made before P5/P7 can carry an error publish refuses | **Fixed.** Errors are printed too, labelled. Today 0 drafts carry one (gate scan) |
| 8 | P3 and P7 each define their own "ignored" characters | **Fixed:** one `READING_MARKS` in `common/japanese-script.ts`. The two rules still differ on purpose: P3 hides a visual duplicate, exact; P7 asks whether the line says the same sentence, so kana, katakana and rōmaji fold |
| 9 | The prompter re-derived kinds with a `ja:vocab:` prefix and computed the lists itself | **Fixed:** `kindOf` is exported from `course-context.ts`, and the lists come from `courseContextFor` |
| 10 | Placement keeps its own splice, so `shuffle.ts`'s "the one helper" claim is false | **Comment fixed, no code change.** tech.md section 6 says "Not to be touched: placement code (P8 adds a spec only)". `withAnswer` inserts at a uniform slot, and the new placement spec pins that. `samplePlacement`'s partial Fisher-Yates samples items rather than ordering options. The comment now says placement predates the helper |

New specs cover each fix: quotes, macrons, joined particle, Tシャツ, "written in katakana", rōmaji sentences that really differ (still refused), the はし homophone fixture, the F-Kanji line, an outline-wide by-id check of the known and new lines, `courseContextFor`'s new fields, and an error from `courseRuleFindings`.
