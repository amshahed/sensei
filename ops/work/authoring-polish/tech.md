# Tech plan: authoring polish

Unit `authoring-polish`. Written by the Tech Lead, 2026-11-22, against `brief.md` (P1 to P7, G.4.f) and the code at `main` `c2b3907`. Technical decisions logged as G.4.g and F.2.k in `decisions.md`. **One Developer PR**, after `open-check-followup` merges. Seven promises fit in one pass: none needs a migration, and P4 to P7 are small, spiked rules. The brief's split isn't needed.

---

# 0. What the code and data are today (verified)

**Kanji rows (Neon default branch, read-only, 2026-11-22)**
- 103 `KANJI` items. Their `reading`, `meaning`, `data.meanings`, `data.kun_readings`, `data.on_readings`, `stroke_count` and `jlpt` hash identically (md5 `93db0419…`) to what `buildKanjiItem()` builds today from the local `apps/api/data/sources/kanjidic2-en-3.6.2.json`. So **re-running the kanji ingest changes nothing except what this unit adds**. No row has been hand-edited.
- 校: `meaning` "exam", `data.meanings` ["exam", "school", "printing", "proof", "correction"]. The ingest takes the first sense.
- The eight verb kanji and the KANJIDIC2 kun reading their lessons teach. All are present in `data.kun_readings`:

  | Kanji | Reading taught |
  |---|---|
  | 食 | た.べる |
  | 飲 | の.む |
  | 読 | よ.む |
  | 書 | か.く |
  | 行 | い.く |
  | 来 | く.る |
  | 見 | み.る |
  | 聞 | き.く |

  食's `reading` column is く.う (kun[0]); the other seven already match.
- **The kanji ingest is an upsert.** It overwrites `display`, `reading`, `meaning` and `data` for all 103 rows, so any fix stored only in the database is lost on a re-import.

**Where a kanji's meaning is shown.** Everything reads `Item.meaning`:
- the lesson recap card back (`recapBackFor`), and the lesson item `meaning` (`mapLessonItem`);
- placement's reading-and-meaning question (`placement-questions.ts`);
- the curriculum screen.

**Where a kanji's reading is asked.** `recallQuestionFor()` is the one builder for reviews (`mastery.service.ts`), practice (`practice.service.ts`) and chapter tests (`assessments.service.ts`). For a kanji it asks `Type a reading for 「食」` and accepts every on and kun reading. Reviews and practice show `learnerSurface(item)` as the big glyph; chapter tests show only the prompt.

**Teach examples.** `lesson.mapper.ts` passes `teach` through untouched. The mobile parser (`apps/mobile/src/lesson/teach.ts`) drops an example block whose `reading` isn't a string. `TeachBlockView` always prints the reading.

**The drafter's context block** (`lesson-prompter.ts`) lists `WORDS THE LEARNER KNOWS: ${ctx.words}` and `GRAMMAR TAUGHT SO FAR`. Both include this lesson's own targets (`course-context.ts`: "this lesson's included"). That is W2.1.

**Gate warnings** print at draft and at publish. `authoring:review`, where the PM reads a draft, doesn't print them.

## Spikes ($0, throwaway, 2026-11-22)

Rules run over every current draft in `tools/authoring/output/` plus every `published/` copy (214 files), and over the 15 `original_draft`s in `corrections.jsonl`.

| Rule | Hits on approved and current drafts | Hits on pre-edit drafts |
|---|---|---|
| P5 "in kana" / "(katakana)" in a closed typed prompt | 0 | 6: ch04-l06 q2, q4, q6, q8, q10 ("type exactly how it sounds in kana"); ch08-l03 q4 ("Type this sentence in kana") |
| P6 self-correction patterns | 0 | 2, both ch16-l03 (109): "you don't know くるま yet", "let's use words you know" |
| P7 kana example whose reading says something else, first version | **20 false positives** (ch04-l01, ch04-l03: `かぎ / か・ぎ` syllable splits) | 1 false positive: `たべます / ta-be-ma-su` |
| P7, final version (section 1.6) | **0** | 0, and the lesson 115 case (`すこし... いいえ、やさい が きらい です` read as `いいえ、おちゃ が きらい です`) is caught |

- **The brief's corpus is thinner than it says.** Pre-edit text for 80, 102, 108 (in kana), 99 and 120 (self-corrections), and 98 and 115 (readings) isn't stored: the PM edited those drafts in place, and `.prev.json` holds only two ch07 redrafts. Those cases go into the specs verbatim from `content-review-wave3.md` and `content-review-wave2.md` instead.
- **P3 reach:** 299 of 386 drafted example blocks have a reading identical to the Japanese once spaces and punctuation are ignored. Another 44 are katakana examples with a hiragana reading, and 47 have a rōmaji reading or a pronunciation guide (ch07-l06: "say こ, hold one beat…"). The last two groups keep their reading.

---

# 1. Approach

## 1.1 Kanji corrections live in a committed supplement, applied by the kanji ingest (P1, P2)

- New `apps/api/data/curriculum/kanji-supplement.json`:

  ```json
  {
    "meanings": { "校": "school" },
    "words": { "食": "た.べる", "飲": "の.む", "読": "よ.む", "書": "か.く",
               "行": "い.く", "来": "く.る", "見": "み.る", "聞": "き.く" }
  }
  ```

  It sits beside the vocab and grammar supplements, with `loadKanjiSupplement()` in `ingest/supplement.ts`.
- `buildKanjiItem(char, supplement)`:
  - **`meaning`** is the supplement's meaning when present, else the first English sense as today. It throws if the override isn't one of that character's KANJIDIC2 English senses, so the supplement can only choose among canonical senses, never invent one (hard constraint).
  - **`data.word_reading`** is the supplement's word reading when present. It throws if that string isn't in the character's `kun_readings` or has no okurigana (`.`).
  - `ingestKanji` throws if the supplement names a character that isn't in the N5 set.
  - The default supplement is empty, so existing callers and specs are unchanged.
- **It survives a re-import** because the re-import is what applies it.
- **`ingest:items kanji --dry-run`** reads the current rows and prints each row whose `reading`, `meaning` or `data` would change, field by field, without writing. That is how the live apply is checked (section 3).
- **Rejected:**
  - **A one-off SQL `UPDATE`.** The next re-import silently undoes it.
  - **Overriding at read time** (`data.taught_meaning` plus a helper at every reader). Four readers today, including placement's distractor pools, and the next one would miss it. P1 says "everywhere".
  - **Changing `Item.reading` for verb kanji to the word reading.** It would also change placement's answer for 食 (section 5, flagged to the PM), which is outside P2.

## 1.2 A verb kanji's reading is asked through its word (P2)

- `recall-question.ts` gains `kanjiWord(item)`. From `data.word_reading` (for example `た.べる`) it returns `{ display: '食べる', answer: 'たべる' }`, using the existing `kanjiReading()` to split stem and okurigana. Without the key it returns null.
- **`RecallQuestion` gains `display: string`**, what the card shows. For every item it is `learnerSurface(item)`, except a verb kanji, which gets the word (`食べる`). Reviews (`mastery.service.ts`) and practice (`practice.service.ts`) use `question.display` instead of calling `learnerSurface(item)` themselves. Chapter tests show only the prompt.
- **A verb kanji's question:**
  - prompt: `Type the reading of 「食べる」`
  - expected: `たべる`
  - accepted: `['たべる']`
  - check: `'reading'`, so `WritingEvalService.exactMatch` accepts `taberu` and katakana as today (H.2)

  しょく, く(う) and every other reading of 食 are no longer accepted for it (G.4.f).
- Every other kanji is unchanged, including the rule that a bare stem never passes (`生` with い).
- The lesson recap card, the lesson item and placement are untouched.
- **Rejected:**
  - **Changing `learnerSurface()` for verb kanji.** It also feeds the lesson recap card front and lesson item `display`, which teach 食 as a kanji.
  - **Accepting the word's reading as well as all the kanji's readings.** G.4.f rules out しょく for 食べる.

## 1.3 An example's reading is hidden when it says the same thing (P3)

- `lesson.mapper.ts` maps `teach` through a new `mapTeach()`. An example block (discriminant `kind` or `type`) whose `reading` equals its `japanese` loses its `reading` key. "Equals" means after removing whitespace, `ANSWER_PUNCTUATION` and 「」『』・…. Every other block, and every malformed shape, passes through untouched.
  - The comparison is exact on what remains, so the cases below keep their reading:
    - a kanji example;
    - a katakana example read in hiragana;
    - a rōmaji reading or pronunciation guide.
  - ー is content, never stripped.
- `teach.ts`: an example's `reading` becomes optional (it is kept only when it is a string), and `TeachBlockView` renders it only when present.
- **Display only.** No lesson is republished and nothing stored changes (brief 4.3).
- **Why in the API and not only in the app:** the rule's edge cases are exactly what a unit test should pin, and the app has no test runner. The app still has to accept a missing reading, which is a two-line change.
- **Rejected:**
  - **Rewriting stored teach JSON.** That means republishing nearly every lesson, and lesson 20 can't be.
  - **Folding katakana to hiragana before comparing.** The brief says "matches", and a hiragana line under katakana isn't a visual duplicate.

## 1.4 The drafter is told which words are new (P4)

`courseContextBlock()` splits each "known" list into earlier and new:
- `WORDS THE LEARNER KNOWS (from earlier lessons): …` excludes this lesson's target surfaces (`ctx.targets`).
- `GRAMMAR TAUGHT IN EARLIER LESSONS: …` excludes them likewise.
- A new line: `NEW IN THIS LESSON (the learner meets these here for the first time; never say they already know them): …`.

The rule "uses only the kana, grammar and words listed above" still covers the new line, so the permitted vocabulary is unchanged. `CourseContext` itself is unchanged, so the gate keeps allowing a lesson's own words.

**Rejected:** a gate warning on "you already know X" for a target X. The prompt is where the defect is caused. A warning would duplicate P6's job.

## 1.5 Gate error: a closed typed check may not ask for kana (P5)

- In `checkCourseRules`, for `answerType === 'typed'` and `grading !== 'open'`, the prompt is tested against `/\b(?:in|using)\s+(?:hiragana|katakana|kana)\b|\(\s*(?:hiragana|katakana|kana)\s*\)/i`.
- Message: `check q4: the prompt asks for kana, but the app accepts rōmaji too; drop "in kana"`.
- It is an error, so it costs nothing to fix: the free redraft loop sees it (F.2.c).

## 1.6 Gate error: a kana example's reading must say the same thing (P7)

- For each example block whose `japanese` has no kanji, compare the `reading`:
  - Skip a reading that mixes Latin letters and kana. That is a pronunciation guide (ch07-l06), not a reading.
  - Otherwise ・ and … count as spaces, and the reading passes if `typedAnswersMatch(reading, japanese)` holds, or holds with hyphens removed (`ta-be-ma-su`). `typedAnswersMatch` is the gate-safe grading comparison: kana, katakana and rōmaji fold together, particles may be spelled as spoken, and ー is handled.
- Message: `teach[3]: the example's reading "いいえ、おちゃ が きらい です" doesn't say "すこし... いいえ、やさい が きらい です"`.
- Spiked at 0 hits on all 214 approved and current files (section 0), so no live lesson is stopped (brief 4.4).

## 1.7 Gate warning: the writer correcting itself (P6)

- Warning patterns over every learner field, case-insensitive:
  - `oops`
  - `wait,`
  - `you don't know … yet` (within 40 characters, no full stop)
  - `let's use words you know`
  - `scratch that`
  - `I mean,`
  - `actually, no` or `actually, wait`

  Both straight and curly apostrophes match.
- Message: `teach[4]: may be the writer correcting itself: "you don't know くるま yet"`.
- A warning only. It never refuses (brief: "a warning can't block fair text"). Spiked at 0 hits on approved drafts.
- **`authoring:review` now prints the course-rule warnings** for the draft it opens, before the editor, using the same `courseContextFor` and `checkCourseRules` that publish uses. That is what puts the warning in front of the reviewer (P6), not only in the Lead's draft log.

---

# 2. Changes

| File | Change |
|---|---|
| `apps/api/data/curriculum/kanji-supplement.json` (new) | 1.1 |
| `apps/api/src/ingest/supplement.ts` | `KanjiSupplement` type, `loadKanjiSupplement()` |
| `apps/api/src/ingest/kanji.ts` | `buildKanjiItem(char, supplement)` with the two guards. `ingestKanji` loads the supplement, checks every named character exists, and takes `--dry-run` (diff, no write) |
| `apps/api/src/ingest/index.ts` | Pass `--dry-run` through; usage text |
| `apps/api/src/recall/recall-question.ts` | `kanjiWord()`, `RecallQuestion.display`, the verb-kanji branch |
| `apps/api/src/mastery/mastery.service.ts`, `apps/api/src/practice/practice.service.ts` | `display` from the question |
| `apps/api/src/lessons/lesson.mapper.ts` | `mapTeach()` |
| `apps/mobile/src/lesson/teach.ts`, `apps/mobile/src/lesson/LessonPlayer.tsx` | Optional example reading |
| `apps/api/src/authoring/lesson-prompter.ts` | 1.4 split |
| `apps/api/src/authoring/course-rules.ts` | P5 and P7 errors, P6 warning |
| `apps/api/src/authoring/review.ts` | Print course-rule warnings |

No new dependencies, and no contract change visible to the app beyond an example's `reading` becoming optional.

---

# 3. Data

## 3.1 What changes in the live database

**Nine `Item` rows, no schema change:**
- `ja:kanji:校`: `meaning` "exam" becomes "school".
- The eight verb kanji: `data` gains `"word_reading": "<kun reading>"`. Everything else in `data` is identical.

**Is it additive?**
- The eight `data` keys are additive.
- **The 校 change is an `UPDATE` of an existing value, so not additive by the letter.** My classification is a reversible content correction, not a stop-list action:
  - it is content, not learner data;
  - the old value stays in the same row (`data.meanings[0]`), in KANJIDIC2, and in the backup below;
  - item IDs don't change, so no FSRS, mastery or completion row is touched;
  - it is the same class of change as a lesson republish, which replaces `Check` rows and was ruled routine under OM.1 (`check-explanation/tech.md` section 3).

  Stop-list item 3 covers destructive or irreversible actions, and this is neither. **The Lead confirms this classification before the live apply** (the role file says non-additive live changes go on the stop list, so I'm flagging it rather than deciding it alone).

  **Lead ruling, 2026-11-22: confirmed, routine under OM.1.**
  - The change is one content value on a canonical-data row.
  - The value is chosen from KANJIDIC2's own senses for 校, which include "school", so it doesn't override the source.
  - It is backed up in a committed file and reversed by re-running the import.
  - No learner row is touched.
  
  The live apply goes ahead after merge, with the backup taken first.

## 3.2 How it was and will be tested

- **Spiked:** live kanji rows equal the current builder's output exactly (section 0). So the dry run must show exactly the nine rows above.
- **Throwaway branch:** before merge, the Tester runs the dry run and then the apply against a throwaway Neon branch created by the Lead. P1 and P2 are scored in the app against that branch.

## 3.3 Live apply (the Lead, after merge, from the main checkout)

1. **Backup.** Save `SELECT id, reading, meaning, data FROM "Item" WHERE id IN ('ja:kanji:校','ja:kanji:食','ja:kanji:飲','ja:kanji:読','ja:kanji:書','ja:kanji:行','ja:kanji:来','ja:kanji:見','ja:kanji:聞')` to `ops/work/authoring-polish/kanji-rows-before.json` and commit it with the state sync.
2. **Dry run.** `pnpm --filter api ingest:items kanji --source ./data/sources/kanjidic2-en-3.6.2.json --dry-run`. Proceed only if it lists exactly the nine rows and fields above. Anything else: stop and hand back to the Tech Lead.
3. **Apply.** The same command without `--dry-run`. All 103 rows are upserted; 94 are written with identical values.
4. **Verify.** Run SQL:
   - 校's meaning is "school";
   - the eight verb kanji have `word_reading`;
   - the meanings of the 41 beta kanji match the PM's audit (brief 4.1).

   Record the output in `ops/journal.md`.

**Order doesn't matter.** Old code ignores `word_reading`, and new code without it asks bare kanji as today.

## 3.4 Rollback

- **Preferred:** revert the supplement entries and re-run the kanji ingest. That re-derives KANJIDIC2's values exactly, as the hash spike proves, and drops `word_reading`, because the upsert replaces `data` whole.
- **Or:** a nine-row `UPDATE` from `kanji-rows-before.json`.
- **Neither touches learner data.**

## 3.5 Other promises

P3 to P7 change no stored data.

---

# 4. Promise map

Test locations:
- **Jest** means unit tests in `pnpm test`, in CI.
- **Gate scan** means `authoring:draft --recheck` ($0) over every draft in `output/` and `published/` from the main checkout, results in `dev.md`.
- **Tester-sim** means `Sensei 22a SE3` against the PR build and the throwaway branch, with screenshots in `test.md`.

| Promise | Implementation | Test that proves it |
|---|---|---|
| **P1** 校 shows "school" everywhere; every other beta kanji keeps its taught meaning | 1.1 supplement and ingest, live apply in 3.3 | <ul><li>Jest `kanji.spec.ts`: 校 with the supplement → "school"; without → "exam"; an override that isn't a KANJIDIC2 sense throws; an unknown character throws</li><li>Dry run on the branch and on live lists only the nine rows</li><li>Tester SQL on the branch: the 41 beta kanji meanings match brief 4.1</li><li>Tester-sim: lesson 76's recap card shows "school"</li></ul> |
| **P2** Review, practice and chapter test show 食べる; たべる and taberu accepted | 1.1 `word_reading`. 1.2 `kanjiWord`, `RecallQuestion.display` | <ul><li>Jest `recall-question.spec.ts`: 食 with `word_reading` → display 食べる, prompt `「食べる」`, accepted `['たべる']`; 校 and 生 unchanged</li><li>Jest `recall-grader` or `reviews.service` spec: `taberu` and `たべる` correct, `しょく` wrong</li><li>Jest `mastery.service` and `practice.service` specs: a verb kanji's queue item has `display` 食べる</li><li>Tester-sim on the branch: make ja:kanji:食 and ja:kanji:来 due for the dev user (after lesson 93/94, or an `ItemMasteryState` row with `due = now()`, branch only). The review shows 食べる; `taberu` is accepted. The same in practice. The chapter 14 test prompt shows 「来る」</li></ul> |
| **P3** An all-kana example shows its Japanese once; a kanji example keeps its reading | 1.3 `mapTeach`, optional reading in the app | <ul><li>Jest `lesson.mapper.spec.ts`: these keep their reading: a kanji example; katakana with a hiragana reading; a rōmaji reading; a pronunciation guide. These lose it: `いただきます。 / いただきます` and `わたし は がくせい です / わたし は がくせい です。`. Both `kind` and `type` blocks are handled, and other blocks pass through</li><li>Tester-sim: an all-kana example in a live lesson shows one line; lesson 93's kanji example still shows its reading</li><li>Mobile typecheck and `expo export`</li></ul> |
| **P4** The learner isn't told the lesson's new words are already known | 1.4 split context | <ul><li>Jest `lesson-prompter.spec.ts`: a target word appears under NEW IN THIS LESSON and not under WORDS THE LEARNER KNOWS; the same for a target grammar point</li><li>`dev.md`: the built prompt for audio lesson 26 (I-Speaking), printed without a model call</li></ul> |
| **P5** A typed check asking for "in kana" or "(katakana)" is refused | 1.5 gate error | <ul><li>Jest `course-rules.spec.ts`: errors on the verbatim ch04-l06 q2 and ch08-l03 q4 prompts from `corrections.jsonl`, and on "(katakana)"; no error on an open check, a multiple-choice prompt, or "the katakana word for coffee"</li><li>Gate scan: 0 new errors on approved drafts</li></ul> |
| **P6** Self-corrections warn the reviewer, saying where | 1.7 warning; review prints it | <ul><li>Jest `course-rules.spec.ts`: warnings, never errors, on the verbatim 109 text ("well, you don't know くるま yet"), 120's "おんがち — oops — おんがく", and "let's use words you know"; none on "Wait for the beep" style text without the comma</li><li>Gate scan: 0 warnings on approved drafts</li><li>`dev.md`: `authoring:review` output for a fixture draft showing the warning before the editor (`EDITOR=true`)</li></ul> |
| **P7** A kana example whose reading says a different sentence is refused | 1.6 gate error | <ul><li>Jest `course-rules.spec.ts`: error on lesson 115's verbatim example; no error on `かぎ / か・ぎ`, `たべます / ta-be-ma-su`, `わたし は いしゃ です。 / watashi wa isha desu.`, `ラーメン / raamen`, `コーヒー / say こ, hold one beat…`, `コーヒー / こーひー`, or a kanji example</li><li>Gate scan: 0 new errors on approved drafts</li></ul> |

---

# 5. Risks

| Risk | What would show it |
|---|---|
| The dry run shows more than nine rows (a KANJIDIC2 file mismatch) | The dry run itself. Stop; nothing is written |
| A later verb kanji is taught without a supplement entry, so reviews ask it bare | PM review of any new F-Kanji lesson. Add "verb kanji → `kanji-supplement.json` words" to the F-Kanji review checklist. No mechanical guard: the outline has no verb items to compare against |
| Placement still asks 食's reading with く(う) as the answer (KANJIDIC2 kun[0]) | Not in P2's list. **Flagged to the PM as a backlog item:** one line, primary reading = word reading for verb kanji |
| A learner mid-schedule on 食 meets a new question shape | Intended. Item IDs and FSRS rows are unchanged |
| P7 refuses fair text in the audio wave (speaking lessons with new reading styles) | Gate scan, then the first audio drafts. If it happens, the Tech Lead narrows the skip rule and logs it, rather than downgrading the rule silently |
| P6 warnings become noise | Spiked at 0 on 214 files. Warnings never refuse |
| P3 hides a reading that differed only in punctuation the learner needed | By design (brief 4.3: spaces and punctuation ignored) |
| The 校 `UPDATE` judged a stop-list action | The Lead's call (3.1). If so, it goes to `BLOCKERS.md` and P1 waits; P2 to P7 are unaffected |

---

# 6. Tasks (one Developer pass, one PR, in this order)

1. **T1 Kanji supplement.** JSON file, loader, `buildKanjiItem` overrides with both guards, the unknown-character check, `--dry-run`. Specs as in P1. Run the dry run read-only against the default branch from the main checkout, and paste it into `dev.md`: it must show exactly the nine rows.
2. **T2 Verb kanji questions.** `kanjiWord`, `RecallQuestion.display`, the verb branch, reviews and practice reading `display`. Specs as in P2.
3. **T3 Example readings.** `mapTeach`, the mobile parser and view. Specs as in P3. `pnpm --filter mobile typecheck`, then `expo export --platform ios`.
4. **T4 Drafter context.** The 1.4 split, with its spec. Print lesson 26's prompt into `dev.md`.
5. **T5 Gate.** P5 and P7 errors, P6 warning, review prints warnings. Specs use the verbatim cases. Run the gate scan over all of `output/` and `published/` (expect 0 new errors and warnings) and over the `corrections.jsonl` originals (expect the section 0 hits). List both in `dev.md`.
6. **T6** Run `pnpm typecheck && pnpm lint && pnpm test`, then `/code-review high`, then open the PR. Record any deviation from this plan in `dev.md`.

**After merge, the Lead:** confirms the 3.1 classification, then runs 3.3. The Tester's pre-merge evidence for P1 and P2 comes from the throwaway branch.

**Not to be touched:**
- the deferred rules W2.3, W2.5, W3.1 and W3.2;
- placement;
- the recap card's reading list;
- anything in `open-check-followup`.
