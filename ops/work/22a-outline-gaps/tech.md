# Tech plan: fix the beta outline so lessons can be drafted from it

Unit `22a-outline-gaps`. Written by the Tech Lead, 2026-11-08, amended the same day for G.4.d and `content-review.md`. Based on branch `fix/authoring-live-api` at `b6a8960` (`.claude/worktrees/wt-14`, also PR #66's head on GitHub). PR #66 must land first. PR #66 doesn't touch the placement, assessment, mastery or recall code, so section 1.8 is planned against `main`.

Technical decisions logged in `decisions.md`: F.1.b, G.4.c, E.1.c, F.2.a. Product decision this plan implements: G.4.d. One more technical decision is waiting to be logged, at the end of this file.

Checked by read-only spike against Neon and the local JMdict file, no model calls:

| Fact | Result |
|---|---|
| Appendix shape | 120 lessons, 17 chapters, 41 kanji, 184 distinct spellings (185 words counting 人 twice, as the brief does) |
| Appendix items | Every named item resolves to a live row or a planned new row |
| The 22 JMdict ids in brief 3.1 | All exist and carry the stated spelling |
| Live items | 1,593 (92 kana, 1,358 vocab, 103 kanji, 40 grammar). 0 grammar meanings, 0 mastery rows, 0 completions, 1 user |
| Live lessons | 1, the seed tracer: chapter `hiragana-vowels`, lesson `the-five-vowels` |
| The 24 keys in `grammar-meanings.json` | The 14 existing ids are all live rows with no meaning. The 10 new ids, `ja:grammar:がすきです` included, have no row. `slugify` produces every new id from its appendix name. No `ja:grammar:が好きです` row exists |
| `ja:grammar:stem-たいです` | Live, `display` is `stem +たいです`. It's the only pattern in `n5-grammar.json` containing "stem" |

---

# 1. Approach

## 1.1 The outline is compiled from a committed spec, with no model call (F.1.b)

The appendix becomes `apps/api/data/curriculum/foundation-ja-beta.json`. A new `authoring:outline` command validates it and writes the same `tools/authoring/output/skeleton.json` the rest of the pipeline already reads.

- **Cost: $0.** It replaces the about $0.50 regeneration in `ops/CHECKPOINT.md` step 4.
- **P11 and F.1.a hold by construction.** Nothing can reorder the lessons.
- `skeleton-prompter.ts` is untouched. The N5-only loader and "about 100 lessons" prompt no longer matter for this slice, and stay available for later chapters as F.1.a allows.

**Rejected**
- Regenerate with a better prompt plus a check. It pays for output we already have and fails on any drift (F.1.a rejects it too).
- Edit the existing `skeleton.json` by hand. It is gitignored, so the outline would exist on one machine only.
- Have the model fill titles or minutes. Titles are in the appendix, and minutes follow a rule (keep the old value, otherwise F-Vocab 7, F-Grammar 8, Integration 7).

## 1.2 All vocabulary shows in kana for the beta (G.4.c, the G.4.b fallback)

One pure function, `learnerSurface(item)`: a VOCAB item with kanji in `display` returns `reading`, anything else returns `display` (one grammar exception in section 1.9). It is applied where the API builds a response. `recallQuestionFor` then always asks a VOCAB item's meaning. `Item.display` stays as it is, so the live data doesn't change and reversal is one function.

**Why not per-learner switching:** only 39 of the 184 spellings could ever switch, because the other words contain a kanji the slice never teaches or are already kana. The cost is high for that:
- A taught-kanji lookup on every review, practice, assessment and lesson read.
- A prompt and grade path that must agree when the answer type can flip between meaning and reading.
- FSRS history earned on meaning questions, then applied to reading questions.
- Lesson text is shared and fixed at authoring time, so skip-tests would still leave learners seeing kanji they skipped.

It also removes the 人 (ひと/じん) problem from the brief, since neither is ever shown as 人.

**One real cost: homophones.** Kana-only display creates exactly one collision in the slice, さん (honorific) and さん (三). A two-entry context table in `recall-question.ts` fixes it: "What does 「さん」 mean after a name?" and "What does 「さん」 mean as a number?". The outline validator fails on any new collision without an entry.

## 1.3 Drafts get course context and a free deterministic gate (F.2.a)

This is the part the brief doesn't name, and P1, P7 and P9 depend on it. The drafter currently sees only a lesson's target items, so it would write any Japanese it likes. Ordering the outline alone doesn't stop that.

- **Prompt:** taught kana stages, taught grammar and known word surfaces, computed from the skeleton for that lesson. Rules: Japanese only from those lists, kana with spaces between words, kanji only in F-Kanji lessons.
- **Gate:** `course-rules.ts`, deterministic and free. It runs after every draft and again at publish.
- **Critic:** gets the taught-grammar list under `learner-confusion`. It stays at 9 checks (F.4).

What the gate can and can't check is in section 5. Particles are not mechanically checkable in kana-only text.

## 1.4 `authoring:draft` skips existing work by default (F.2.a)

Decision on the Tester's finding: a run never pays twice unless told to.

| Situation | Behaviour |
|---|---|
| `<id>.json` exists | Skip, no API call, say so |
| `<id>.rejected.json` exists | Skip, so a failed draft isn't re-billed by a chapter re-run |
| `--force` | Redraft. Keep the old draft as `<id>.prev.json`, delete the stale `<id>.critique.json`, clear any `<id>.rejected.json` |
| Gate fails | Write `<id>.rejected.json`, never `<id>.json`, so review can't pick it up. Carry on, exit 1 at the end |
| `--max-cost <usd>` | Stop before the next lesson once the running estimate reaches it, and print where it stopped |

Ending line: drafted, skipped, rejected, estimated cost. The batch is therefore resumable after a crash or empty balance. `review.ts --regenerate` must pass `--force`, or it silently stops working.

**Rejected:** refuse-and-exit, as the outline guard does. A batch would halt at the first existing draft. Prompting for confirmation doesn't work in unattended runs.

## 1.5 New items reach Neon through an insert-only ingest (E.1.c)

`ingest:items supplement --source <jmdict.json>` reads two committed files and only inserts. Full detail in section 3.

**Rejected:** add rows to the Tanos CSVs or `n5-grammar.json`. That would give them a JLPT level, breaking E.1.b. A Prisma data migration can't read the JMdict source and would put content in the schema history.

## 1.6 Grammar meanings are committed content, not drafter output

P8 needs a meaning on all 24 points. They go in `grammar-supplement.json` and are applied by the same ingest.

**Source of the meanings.** `ops/work/22a-outline-gaps/grammar-meanings.json` (PM-approved, `content-review.md`) is the source for every meaning in `grammar-supplement.json`. Copy the 24 strings verbatim, keyed by the same ids. The Developer doesn't reword them. If one needs changing, the PM edits `grammar-meanings.json` and the Developer copies it again. `ops/work/` isn't in git yet, so read the file from the main checkout at `/Users/sh/workspace/sensei/ops/work/22a-outline-gaps/grammar-meanings.json`, not from the worktree.

New rows display as the appendix writes them (`content-review.md` C3): `か`, `の`, `じゃありません`, `ます`, `ません`, `ました`, `て-form`, `い-adjective`, `な-adjective`, `〜がすきです`.

**Why not the drafter:** this costs no credit, it doesn't depend on the batch finishing, and a point taught in two lessons (に, lessons 81 and 99) gets one meaning, not two competing ones.

## 1.7 Lesson 1 keeps the tracer's slugs

Spec chapter 1 uses id `hiragana-vowels` and lesson 1 uses `the-five-vowels`. Otherwise the tracer stays beside the new content (18 chapters, 121 lessons, breaking P11), and removing it would be a live deletion on the stop list. With matching slugs, publishing replaces it through the normal upsert. Every other lesson is `foundation-ja-chNN-lNN`.

## 1.8 A kanji is scheduled only with evidence (G.4.d)

**The finding is confirmed, and there are exactly three leaks.** Reviews (`getDue`, `dueTimes`) and Practice (`learnedQuizzable`) only read `ItemMasteryState`, so an item with no row can't reach either. The fix therefore belongs where rows are written.

| Writer | Today | Verdict |
|---|---|---|
| `placement.service.ts` `inferable`, then `seedInferred` | Seeds every untested quizzable item of a skipped chapter, KANJI included | **Leak 1** |
| `assessments.service.ts` `seedUntested` | Seeds every untested quizzable item of a passed chapter, KANJI included | **Leak 2** on a skip-test |
| `assessments.service.ts` `writeBack` | On a passed skip-test `penalise` is true, and `recordCheckResult` creates a row for a wrong answer | **Leak 3**: a missed kanji is scheduled as Again |
| `placement.service.ts` `seedTested` | Correct answers in skipped chapters only | Fine, G.4.d allows it |
| `writeBack` on a failed skip-test | Correct answers only | Fine |
| Exit Assessment | Lessons are all done. A lesson counts as done without completion only through `UserLessonSkip`, and its one writer needs every target answered correctly | Fine, unchanged |
| `checks.service.ts`, reviews, practice | A lesson Check, or an item already scheduled | Fine |

**The change, all on the write side**

1. `learner-surface.ts` gains `mayInferMastery(item)`, true unless `item.type === 'KANJI'`. One function holds the rule for both services, and G.4.d's reversal is one line.
2. `inferable` also filters on `mayInferMastery`. It needs no attempt-kind check, because placement is only for learners with no progress (`assertNew`).
3. `seedUntested` takes the attempt's `kind`, and keeps an item only if `kind === 'EXIT' || mayInferMastery(item)`.
4. `submit`, for a passed `SKIP` attempt only, works out the wrong KANJI answers with no `ItemMasteryState` row, and `writeBack` leaves those out. A row means the learner already has evidence: a lesson Check or an earlier correct test answer.
5. That lookup runs after the outcome is committed, like the rest of the best-effort FSRS work. Catch a read failure, log it and leave out all wrong KANJI answers. Failing closed loses one Again, while throwing would return a 500 for a recorded result.

A SKIP attempt can follow real study, because `kind` is SKIP until every lesson in the chapter is done. So a kanji studied in an earlier lesson of that chapter and missed on the test keeps its Again. That's why step 4 checks for a row instead of dropping all missed KANJI.

Placement and skip-test questions don't change, so they keep showing kanji. Non-KANJI items behave exactly as before.

**Tests**

| File | Case |
|---|---|
| `placement.service.spec.ts` | Skipped chapter: untested KANJI isn't passed to `seedInferred`, untested VOCAB and GRAMMAR are. A KANJI answered correctly is passed to `seedTested` |
| `assessments.service.spec.ts` | Passed SKIP: untested KANJI isn't seeded, untested VOCAB is |
| | Passed SKIP: missed KANJI with no row gets no `recordCheckResult`. Correct KANJI does. Missed KANJI with a row still gets Again. Missed VOCAB still gets Again |
| | Passed SKIP with the row lookup failing: no wrong KANJI is written, the result still returns |
| | Passed EXIT: untested KANJI is seeded and a missed KANJI gets Again, as before |
| `learner-surface.spec.ts` | `mayInferMastery` per item type |
| `app.integration.spec.ts` | Over HTTP, with a KANJI item added to the fixture: pass a skip-test with one kanji right and one wrong (four of five correct). `/practice/scopes` then reports `learned.KANJI` as 1 |

**Rejected**
- Filtering on the read side in `getDue`, `dueTimes` and `learnedQuizzable`. That's three queries needing a per-learner "studied" lookup, and the rows would still exist and feed reminders.
- Putting the filter inside `MasteryService.seedInferred`. It doesn't know SKIP from EXIT, and EXIT must still seed.
- An evidence column on `ItemMasteryState`. A migration for something the row's existence already says.

## 1.9 The たいです review reads 「〜たいです」

It's a one-line change, so it's done here and not left for Alpha. `learnerSurface` gains one line for GRAMMAR items: `item.display.replace(/^stem \+/, '〜')`. `meaningQuestion` in `recall-question.ts` builds its prompt from `learnerSurface(item)`, and the services already serve that surface.

**Rejected**
- Editing `pattern` in `n5-grammar.json`. The id is a slug of the pattern, so the row would become `ja:grammar:たいです`, and re-ingesting would add a second row beside the live one.
- Updating `Item.display` through the supplement. That overwrites a live value, so it isn't additive, and any grammar re-ingest would write it back.

Existing rows use a full-width tilde (`～ましょう`, U+FF5E), while this and `〜がすきです` use a wave dash (U+301C), as the PM wrote them. They look almost identical, so it's left alone.

---

# 2. Changes

All paths are under `apps/api/` unless stated.

**New**

| File | Purpose |
|---|---|
| `data/curriculum/foundation-ja-beta.json` | The outline. Chapters, lessons, exact `itemIds`, optional `authorNote`, `kanaCards`, `typedReading`, plus `surfaces` (item id to kana), `grammarPrereqs` and `soundStages` |
| `data/curriculum/vocab-supplement.json` | 22 rows: JMdict id, spelling, reading, `multi_word` |
| `data/curriculum/grammar-supplement.json` | 10 new patterns, and meanings for all 24, copied verbatim from `grammar-meanings.json` (section 1.6) |
| `data/curriculum/grader-cases.json` | The live grader cases (section 3) |
| `src/authoring/grader-check.ts` | CLI `authoring:grader-check --source <jmdict.json>`, Gemini only, no DB |
| `src/authoring/outline.ts` | CLI `authoring:outline [--output] [--force]` |
| `src/authoring/outline-compiler.ts` | Pure `validateOutline(spec)` needing no DB, `compile(spec, rows)` |
| `src/authoring/course-context.ts` | Pure `courseContextFor(skeleton, lessonId)` |
| `src/authoring/course-rules.ts` | Pure `checkCourseRules(draft, ctx)`, returns errors and warnings |
| `src/ingest/supplement.ts` | The insert-only ingest |
| `src/recall/learner-surface.ts` | `learnerSurface`, `mayInferMastery` |

Spec item ids must use these exact rows: 私 is `私:わたし`; 人 is `人:ひと` in lesson 42 and `人:じん` in lesson 45; 中 is `中:なか`; 外 is `外:そと`; 時 is `時:じ`. The "I like" pattern is `ja:grammar:がすきです` in lessons 116, 118 and 119, displayed `〜がすきです`. `ja:grammar:が好きです` must not appear anywhere, because 好 is never taught (`content-review.md` C1). Kana lessons marked "5 items" are copied from the current `skeleton.json`, since that file is not in git.

**Changed**

| File | Change |
|---|---|
| `src/authoring/skeleton-schema.ts` | `LessonSchema` gains optional `authorNote`, `kanaCards: {char, romaji}[]`, `typedReading`. Skeleton gains optional `surfaces` |
| `src/authoring/skeleton.ts` | Refuses to overwrite a compiled outline (`model: "compiled-outline"`), even with `--force` |
| `src/authoring/lesson-prompter.ts` | Course context in draft and critique prompts. Kana cards no longer F-Kana only. `DRAFT_MAX_TOKENS` 4096 to 8000. Tatoeba passages that break the course rules are dropped; `grammar-ref` passages stay, marked reference-only |
| `src/authoring/lesson-schema.ts` | `CheckQuestionSchema` gains optional `grading: "open"` and `rubric` |
| `src/authoring/lesson-publisher.ts` | An open question writes `{exemplar, rubric}` and no `answer` |
| `src/authoring/draft.ts`, `review.ts` | Section 1.4 |
| `src/authoring/publish.ts`, `critique.ts` | Publish runs the gate. Critique loads the skeleton for context |
| `src/ingest/index.ts` | `supplement` kind |
| `src/ingest/vocab.ts` | `level` may be null on the build path |
| `src/ingest/grammar.ts` | Update no longer writes a null `meaning` (see section 5) |
| `src/recall/recall-question.ts` | VOCAB always asks meaning, using the surface and context table. `meaningQuestion` builds its prompt from the surface, so grammar goes through it too (section 1.9) |
| `src/placement/placement.service.ts`, `src/assessments/assessments.service.ts` | Section 1.8: `inferable`, `seedUntested`, and the `writeBack` filter for a passed skip-test |
| `src/mastery/mastery.service.ts`, `practice/practice.service.ts`, `lessons/lesson.mapper.ts`, `curriculum/curriculum.service.ts`, `placement/placement-questions.ts`, `assessments/assessments.service.ts` | Return `learnerSurface(item)` as `display` |
| `package.json` | `authoring:outline` and `authoring:grader-check` scripts |
| `tools/authoring/README.md` (repo root) | New command and flags |

**Why the publisher changes.** Every published question currently stores a fixed `answer`, so every TYPED check is an exact match. A free self-introduction (P10) could never be marked correct. `CheckService` already has the open path, keyed on a missing `answer`, so only the authoring side needs the change.

**Contracts.** The first version of this plan said no API or DTO changes and no mobile changes. That was wrong for the lesson recap card, because `LessonPlayer.tsx` used `reading` as the card's back (`test.md` F2). `LessonItemDto` gains `recap`, and `LessonPlayer.tsx` changes, as set out under "Round 1 findings". Everywhere else, `display` simply carries kana for words. **No new dependencies.** `wanakana` is already present.

---

# 3. Data

**Schema: none.** No migration. `Item.data` is JSON and `Item.meaning` is nullable.

**Section 1.8 changes no data.** It only stops future writes. `ItemMasteryState` has 0 rows on Neon (queried 2026-11-08), so nothing needs cleaning up. Section 1.9 changes no stored value either.

| Rows | Action | Additive? |
|---|---|---|
| 22 VOCAB (20 phrases, 日本, 日本語) | Insert with `skipDuplicates`. `data.jlpt: null`. Phrases add `multi_word: true`, kana `display`, and `meaning` as all glosses of JMdict's first sense, so the grader has a usable exemplar | Yes |
| 10 GRAMMAR | Insert. `jlpt_level: null`, no `source_order` | Yes |
| 14 existing GRAMMAR | `updateMany` where `meaning IS NULL` | Yes in effect: fills empty values, overwrites nothing |

Expected end state: 1,625 items, 50 grammar, 24 grammar meanings. The re-ingest paths leave the new rows alone: `ingestVocab` only retires rows that have a level.

**Order of work on Neon** (additive, pre-approved under OM.1):

1. Capture the "before" fingerprint on the default branch:
   `SELECT count(*), md5(string_agg(id||display||coalesce(reading,'')||coalesce(meaning,'')||data::text,'|' ORDER BY id)) FROM "Item"`.
2. Create a throwaway Neon branch, setting an expiry if the tool allows it. Run the ingest with `DATABASE_URL` set to the branch's direct URL. Node's `--env-file` doesn't override a variable already set.
3. Verify on the branch:
   - Item count is 1,625.
   - The fingerprint over the original 1,593 rows, with `meaning` left out for the 14 grammar rows, matches "before".
   - All 32 new rows have null `jlpt` / `jlpt_level`.
   - Exactly 24 grammar rows have a meaning.
   - A second run inserts 0 and updates 0.
4. Run the same command against the default branch from the main checkout, after the PR merges. Repeat step 3.
5. Run `authoring:outline --force`. It must find all 120 lessons' items. Record the output in `dev.md`.

**Tests.** `validateOutline` runs on the committed spec in CI with no DB. Ingest logic gets unit tests with a fake Prisma and the JMdict fixture. The Neon branch run is the integration proof.

**Live grader check (P6, P8, `content-review.md` C4).** `authoring:grader-check` builds the rows with the supplement's pure builder, makes each question with `recallQuestionFor`, and calls the real `GradingService.gradeOpen` through `GeminiLlmClient`. It needs no DB and spends no Anthropic credit. From a worktree, use the `--env-file` form in `ops/PROJECT.md`. `grader-cases.json` holds the 5 phrase paraphrases, chosen by the Developer and covering 5 different phrases, plus these 8 grammar cases:

| Item id | Learner types | Must be |
|---|---|---|
| `ja:grammar:です` | is | Accepted |
| `ja:grammar:も` | too | Accepted |
| `ja:grammar:に` | at | Accepted (Hard is fine) |
| `ja:grammar:に` | to | Accepted (Hard is fine) |
| `ja:grammar:を` | object particle | Accepted |
| `ja:grammar:て-form` | connects verbs | Accepted |
| `ja:grammar:ませんか` | do you want to | Accepted |
| `ja:grammar:か` | because | Rejected |

Rules:
- Accepted means `correct: true`, and Rejected means `correct: false`. Run each case 3 times, because the model isn't deterministic. A case passes only if all 3 agree with the table.
- Every result must have `gradedBy: 'ai'`. The fallback is a word-for-word match, so a fallback result fails the run: the check couldn't be evaluated. Exit 1 on any failure.
- Record every rating and any failing feedback in `dev.md`. The Tester reruns the command.
- If a fair answer fails, the Developer doesn't edit the meaning or the case. The PM rewrites it (`grammar-meanings.json` for grammar, the supplement's `meaning` for a phrase), the Developer copies it in, and the check runs again.
- **Run this before the default-branch ingest and before the PR merges.** The ingest fills only empty meanings and phrases are insert-only, so a meaning rewritten after that step would never reach the live row.

**Rollback.** Before any lesson is published: delete the 32 rows by id and set the 14 meanings back to null, or restore from Neon history. After publishing, do not delete: `Item` cascades to `LessonItem`, `Check` and mastery, so a delete would be destructive and is on the stop list. Per E.1.b, drop the rows from the outline and leave them in place.

**Publishing over the tracer (22b).** This replaces that lesson's items and checks through the existing publisher. It's safe today with 0 completions and 0 mastery rows. Re-check both counts before doing it. Don't run `prisma/seed.ts` against Neon after that, since it upserts the same slug.

---

# 4. Promise map

"Later" means the promise also depends on drafted content, so final delivery is judged at the Alpha run in 22b or 22c. G4 can't be met in this unit for those.

| # | Implementation | Test in 22a | Later |
|---|---|---|---|
| P1 | Spec order. `validateOutline` checks each surface against sounds taught so far. Gate checks every kana character in the draft | Spec test on the real file. Gate tests: が before lesson 15 fails, っ before 19 fails, ー before 39 fails | Alpha |
| P2 | `typedReading` on lessons 15 to 20. Gate requires a typed question per target with no rōmaji of the answer in the prompt. Existing wanakana grading | Gate tests. Grading test: `okaasan`, `kitte` and `chotto` pass | Alpha |
| P3 | Spec targets words only in lessons 15 to 20. F-Vocab rule rejects KANA targets. Kana cards carry no `itemId` (gate) | Spec test: no `ja:kana:` id in those lessons. Gate test on a card with an `itemId` | Alpha |
| P4 | `validateOutline` enforces the floors (3 per voiced row, 5 combinations, 5 っ, 5 long vowels). Existing FSRS brings words back | Spec test on real file, and it fails when a floor is broken. Unit: the surfaced word is quizzable | Alpha |
| P5 | Lessons 21 to 25 hold 25 phrases. `authorNote` requires when-to-say-it. Critic and PM check that | Spec test: 25 distinct phrases before lesson 26 | PM review, Alpha |
| P6 | Rows inserted. Phrases get meaning-recall through the kana rule and AI grader, with a full first-sense exemplar | Unit on the question. `authoring:grader-check`: 5 paraphrases against the phrase meanings the ingest will write (section 3, no Anthropic spend) | Alpha |
| P7 | `grammarPrereqs` check in `validateOutline`. Taught list in the prompt. Gate rejects conjugation markers before they're taught | Spec test, and it fails if か is moved after its first use. Gate tests, including that おねがいします doesn't trip ます | PM review, Alpha |
| P8 | 24 meanings from `grammar-meanings.json` by ingest. Existing `getDue` then includes them. たいです reads 「〜たいです」 (section 1.9) | Branch SQL: 24 meanings. Unit: quizzable once a meaning exists. Supplement test: 24 ids, each at most 100 characters, no kanji. Unit: the たいです prompt is `What does 「〜たいです」 mean?`, and `～ましょう` is unchanged. `authoring:grader-check`: the 8 grammar cases from C4 (section 3) | Alpha |
| P9 | `learnerSurface` everywhere a word is served. Grammar patterns with an untaught kanji are stored in kana (`ja:grammar:がすきです`). Gate: no kanji outside F-Kanji, and F-Kanji uses only taught or target kanji. **G.4.d:** a kanji is scheduled only if it was studied in a lesson or answered correctly on a test (section 1.8). Placement and skip-test questions keep kanji | Unit per service. `recallQuestionFor` never asks a reading of a VOCAB item. Gate tests. Spec test: no GRAMMAR item in the outline has kanji in its display, and it fails on `〜が好きです`. The section 1.8 test table, including the HTTP test through `/practice/scopes` | Alpha, including the returning learner after skipping a chapter with kanji (needs 22c content) |
| P10 | Spec order. Lesson 120 authored as an open question, publisher writes no `answer`, existing AI path grades it | Publisher test. Check-service test on the published shape | Alpha (needs lesson 120) |
| P11 | Compiled from the spec. Positions come from the skeleton | Spec test: 120 and 17, in appendix order. CLI run writes it. Publisher test: lesson 1 lands on the tracer slugs | Course list shows all 120 only after 22c |

---

# 5. Risks

| Risk | What would show it | Response |
|---|---|---|
| **The gate can't check particles.** か, の, は, を, に and で can't be told apart mechanically in kana text | PM review or Alpha finds an untaught particle | Prompt and critic reduce it. PM review is the backstop, and this is stated, not solved |
| Long-vowel check is a heuristic | False warnings on words like おうち | Hard fail on outline words only. Warning on draft text |
| Spaced kana looks odd, or models ignore it | First 3 drafts in 22b | Fix via `authorNote` or prompt before the batch |
| Grammar re-ingest wipes meanings (existing `update` writes null) | Reviews lose grammar questions after a re-ingest | Fixed in this unit, with a test |
| Draft cut off at the old 4096 cap, which is paid and lost | `assertComplete` error | Raised to 8000. You pay only for tokens used |
| JMdict's first sense is a poor exemplar (よろしくおねがいします: "please remember me...") | P6 check rejects a fair paraphrase | PM adjusts `meaning` in the supplement. The file is committed for that reason |
| One meaning for に covers three uses, some before they're taught | A learner's correct answer is rated low | The meaning lists all three. `authoring:grader-check` tries "at" and "to". Watch at Alpha |
| A grammar meaning rejects a fair answer | `authoring:grader-check` fails | PM rewrites the meaning before the default-branch ingest (section 3) |
| Placement and skip-tests still show kanji (KANJI items only) | None expected | PM confirmed in G.4.d: they test prior knowledge and are opt-in |
| A learner who skips a chapter and really knows its unsampled kanji gets no review of them | Returning-learner Alpha run | Cost accepted in G.4.d. They appear once the learner does that lesson |
| A new writer of `ItemMasteryState` bypasses section 1.8 | A KANJI row with no lesson Check and no correct test answer | The rule sits in `mayInferMastery` and the HTTP test. Any new seeding path has to use it |
| Skipped-lesson learners and shared text | None expected, since non-kanji lessons contain no kanji | Consequence of G.4.c |
| Long vowels and っ are silent without Azure | Alpha | Accepted in D.2.a, closed beta needs Blocker 2 |

**Credit.** This unit spends no Anthropic credit. The Tester needs no live Opus call: use fake clients here, and the first paid proof is the 3 lessons in 22b (about $0.30).

The real ceiling is lower than the brief's $18. At the current cap, output is at most 4096 tokens ($0.10) plus input of about $0.02. The extra context adds about $0.01. **Recommendation for 22c: use the Message Batches API, which is 50% off (roughly $7 for 120 lessons), measured from 22b's actual usage.** It would likely avoid Blocker 1 and leaves room for redrafts. It's out of scope here and fits the per-lesson file layout above.

---

# 6. Tasks

One PR, after #66 merges, with a commit per task. Run `pnpm typecheck && pnpm lint && pnpm test` before pushing.

1. **Spec and compiler.** Write `foundation-ja-beta.json`, `outline-compiler.ts`, `outline.ts`, schema additions, the guard in `skeleton.ts`, and spec tests for P1, P3, P4, P5, P7, P9 (no kanji in a grammar display) and P11.
2. **Supplement ingest.** `supplement.ts`, data files, the `grammar.ts` null fix, tests. Copy the 24 meanings verbatim from `grammar-meanings.json` (section 1.6). Show in `dev.md` that the two files match.
3. **Kana surface.** `learner-surface.ts`, `recall-question.ts` with the homophone table, the たいです line (section 1.9), the six services, tests. Update any spec pinning the old reading question.
4. **Kanji evidence.** Section 1.8: `mayInferMastery`, `inferable`, `seedUntested`, the `writeBack` filter, and its test table.
5. **Drafter context.** `course-context.ts`, prompt changes, kana cards, token cap, passage filter, critic context.
6. **Gate and open checks.** `course-rules.ts` wired into draft and publish, `grading: "open"` through schema and publisher.
7. **Draft CLI.** Section 1.4 and `review.ts --force`. Tests prove no client call happens on a skip, using a fake client.
8. **Live grader check**, before merge. `grader-check.ts`, `grader-cases.json`, and the run in section 3. Record the results in `dev.md`.
9. **Neon and outline**, after merge. Section 3 steps 1 to 5. Record results in `dev.md`. No Anthropic spend.

**For the Lead.** Replace `ops/CHECKPOINT.md` step 4 with `authoring:outline` at $0. The 24 grammar meanings are written, so nothing from the PM blocks the Developer. `ops/work/` must stay readable from the main checkout until task 2 is done.

---

# Decision to log

For the Lead to append to `decisions.md`. The id assumes no other entry has taken G.4.e, so renumber if one has.

### G.4.e G.4.d is enforced where mastery rows are written, and a row counts as evidence (decided by Tech Lead, 2026-11-08)

**Decision:** Reviews and Practice read only `ItemMasteryState`, so G.4.d is enforced by not writing a KANJI row without evidence. Placement and a passed skip-test no longer seed untested KANJI items, using one shared rule (`mayInferMastery`). A wrong KANJI answer on a passed skip-test is written only if the learner already has a row for that item, because a row means a lesson Check or an earlier correct test answer. Exit Assessments are unchanged.

**Why:** It closes every path with one small change, needs no schema change and leaves no rows behind to feed reminders. A skip-test can follow real study of part of the chapter, so dropping every missed KANJI would throw away true evidence.

**Rejected:** A read-side filter in `getDue`, `dueTimes` and `learnedQuizzable` (three queries with a per-learner lookup, and the rows would still exist). A filter inside `MasteryService.seedInferred` (it can't tell a skip-test from an Exit Assessment). An evidence column on `ItemMasteryState` (a migration for something a row's existence already says).

**Reverse:** Make `mayInferMastery` return true for KANJI and remove the `writeBack` filter in `assessments.service.ts`. No data change is needed.

---

# Round 1 findings

Tech Lead rulings on `test.md` (PR #70, commit `0dcaf2d`), including the PM's F2 ruling and constraints in `triage.md`. All paths are under `apps/api/src/` unless stated. Everything below goes in PR #70, with a commit per finding. The new commit voids the Tester's report, so section "What the Tester reruns" applies.

| Finding | Ruling |
|---|---|
| F1 High | **Fix.** Exempt exactly あります and います, as whole words, after lessons 74 and 75 |
| F2 Medium | **Fix**, as the PM ruled. Server sends a new `recap` field, and the card is restacked |
| F3 Medium | **Fix in this PR**, in `exactMatch`, plus a gate rule so the fix can't be bypassed |
| F4 Low | **Fix**, in the F1 change |
| F5 Low | **Fix.** `authoring:review` warns |
| F6 Low | **Fix.** Compare rōmaji loosely |
| F7 Low | **Fix.** Publish the skeleton's title |
| F8 Low | **Accepted.** The ingest is insert-only and idempotent, so a retry completes, and all 14 rows it needs are live |
| F9 Low | **Fix.** The fake enforces the `where` clause |

A throwaway spike of the F1, F4 and F3 rules below, using the real compiled outline, matched all 73 expected results. No repo file was changed.

## F1 and F4: whole words, not spaceless text

Both come from matching endings on text with its spaces removed. Exempting bare います across that text would be wrong, because かいます (buy) contains います and would pass before lesson 87. So the ます-family markers are now checked per word.

てください and たいです still match across spaces, because `きて ください` and `たべたい です` are how a draft spaces them. The Tester's script shows no reachable false positive for those two.

In `authoring/course-rules.ts`, add `acrossSpaces: true` to the てください and たいです entries of `MARKERS` (and `acrossSpaces?: boolean` to its type). Replace `markerProblems` with this:

```ts
/**
 * Taught whole by があります and がいます (lessons 74, 75), so the verb on its
 * own is not an early use of the ます lesson. Exactly these words, with か
 * allowed after them. ありません, いました and the like stay rejected.
 */
const TAUGHT_VERBS = [
  { text: 'あります', grammarId: 'ja:grammar:があります' },
  { text: 'います', grammarId: 'ja:grammar:がいます' },
];

/** Blanks out a known string, including when a draft puts spaces inside it. */
function maskKnown(text: string, known: string): string {
  const pattern = [...known]
    .map((c) => c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('\\s*');
  return text.replace(new RegExp(pattern, 'g'), '|');
}

function markerProblems(text: string, ctx: CourseContext): string[] {
  const taught = new Set(ctx.grammar.map((g) => g.id));
  const known = knownStrings(ctx);
  const verbs = new Set(
    TAUGHT_VERBS.filter((v) => taught.has(v.grammarId)).map((v) => v.text),
  );
  return MARKERS.filter((m) => !m.grammarId || !taught.has(m.grammarId))
    .filter((m) => {
      const rest = known
        .filter((k) => k !== m.text && k.includes(m.text))
        .reduce((t, k) => maskKnown(t, k), text);
      if (m.acrossSpaces) return spaceless(rest).includes(m.text);
      return (rest.match(KANA_RUN) ?? [])
        .filter((run) => !verbs.has(run.replace(/か$/, '')))
        .some((run) => run.includes(m.text));
    })
    .map((m) => `uses ${m.text} before it is taught`);
}
```

**Tests in `course-rules.spec.ts`.** Add the Tester's reproduction, and these:

| Lesson | Text | Result |
|---|---|---|
| 77, 81, 83 | The three sentences in `test.md` F1 | Pass |
| 75 | いますか | Passes |
| 73 / 74 | あります | Rejected / passes |
| 74 / 75 | います | Rejected / passes |
| 81 | かいます, ほん を かいます, いきますか | Rejected |
| 86 | たべ ます | Rejected |
| 81, 87 | ありません, いません | Rejected. Pass at 88 |
| 81, 91 | ありました, いました | Rejected. Pass at 92 |
| 21, 22, 23, 24 | おはよう ございます, ありがとう ございます, おねがい します, よろしく おねがい します | Pass |
| 22, 47 | すみません かばん, がくせい じゃありません か | Pass |
| 60 | それ で した | Passes |
| 60 | がくせい でした | Rejected |
| 102 / 103 | きて ください | Rejected / passes |
| 116 / 117 | たべたい です | Rejected / passes |

## F2: the recap card

**How the data reaches the app: the server sends the text.** Add one field, and let the app print it.

`packages/types`, on `LessonItemDto`:

```ts
/** What the Practice card reveals on tap. Null if nothing can be shown yet. */
recap: string | null;
```

`recall/recall-question.ts`, beside `kanjiReadings`, whose `shown` string is what the review answer prints:

```ts
/** The back of the lesson recap card (triage.md, F2). A word never gets rōmaji. */
export function recapBackFor(item: RecallableItem): string | null {
  const meaning = item.meaning?.trim() || null;
  switch (item.type) {
    case 'KANA':
      return dataString(item.data, 'romaji')?.trim() || null;
    case 'VOCAB':
    case 'GRAMMAR':
      return meaning;
    case 'KANJI': {
      const { shown } = kanjiReadings(item);
      return [meaning, shown].filter(Boolean).join('\n') || null;
    }
  }
}
```

`lessons/lesson.mapper.ts`: add `recap: recapBackFor(link.item)` in `mapLessonItem`. The query already loads the whole item, so nothing else changes on the server. Run `pnpm --filter @sensei/types build` after the type change.

**Rejected**
- Sending `Item.data` to the app. The KANJIDIC marker parsing would be duplicated in the client, and the two copies would drift apart.
- Changing what `reading` means. `CurriculumScreen.tsx:321` relies on it.
- Building the text in the app with wanakana. It gives `konnichiha`, as the PM found.
- Storing the text on `Item`. That's a data change for something computable.

**The card can't stay a 40pt single row.** よろしくおねがいします is the longest front in the course, and 11 characters at 40pt need 440pt, wider than any phone. So the card stacks, with the back on its own line. The front stays at 40pt and shrinks only when it wouldn't otherwise fit on one line.

In `apps/mobile/src/lesson/LessonPlayer.tsx`:
- Body text becomes "Tap each card to test yourself before the check."
- Render only items with a `recap`, using `front={item.display}` and `back={item.recap}`. A null never reaches the card, so it can't show a blank back.
- `RecallCard` front:
  ```tsx
  <Text style={styles.recallFront} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
    {front}
  </Text>
  ```
- Add `recallFront: { fontSize: 40, fontWeight: '600' }`. Leave `kanaChar` alone, since the Teach beat uses it.
- `recallCard`: remove `flexDirection`, `alignItems` and `justifyContent`, and add `gap: 6`. The back keeps `kanaRomaji` with no line limit, so it wraps and the card grows. `Screen` already scrolls.

No new dependency, so the bundle check isn't required.

**Tests.** `recall-question.spec.ts`, one case per type: kana gives rōmaji, a word gives its meaning even when its `data` has a `romaji`, grammar gives its meaning, and kanji gives its meaning then clean readings with no `-` or `.`. A shell with no meaning gives null. Update lesson mapper specs for the new field. Add one assertion in `app.integration.spec.ts` that a lesson's item carries `recap` over HTTP.

**Simulator check.** Developer first, then the Tester independently. Nothing published today has words, grammar or kanji, so it needs a fixture on a throwaway Neon branch. **The Lead must allow this**, because the Tester was told not to use a branch last round.

1. On the branch from section 3 step 2, after the ingest and step 3's checks. This also closes the Tester's "real ingest on Postgres" gap.
2. With a SQL file in the scratchpad, not committed, add three lessons after `the-five-vowels` in `hiragana-vowels`, each with a one-question multiple-choice Check so it can be completed:

   | Type | Items |
   |---|---|
   | The tracer, unchanged | Kana |
   | `F_VOCAB` | よろしくおねがいします, ありがとうございます, ごちそうさまでした, かぎ |
   | `F_GRAMMAR` | `ja:grammar:に` (longest meaning, 100 characters), `〜がすきです`, `stem-たいです` |
   | `F_KANJI` | 生 (20 readings, the longest back), 一 |

3. Run the API with `DATABASE_URL` set to the branch's direct URL and dev-stub auth, as in `ops/PROJECT.md`. Run the app on the narrowest iPhone the simulator has, preferably 375pt wide. Work through all four lessons to the Practice beat.
4. Confirm by screenshot, before and after a tap, for each type:
   - Back matches the PM's table, and never repeats the front or shows nothing.
   - よろしくおねがいします is on one line with all 11 characters visible and no ellipsis. Short fronts such as あ and 一 are still at 40pt.
   - The grammar meaning and 生's readings wrap in full. Nothing is clipped, and the last card and the button can be reached.
   - No rōmaji on a word's card, and no `-` or `.` in a kanji reading.
5. Record the device and result in `dev.md` and `test.md`. Let the branch expire, or leave it for the Lead to remove. Only Android stays unchecked: it isn't in this environment.

## F3: particles typed in rōmaji

**Ruling: accept the spoken spellings in `exactMatch`.** Rōmaji normally writes these particles as wa, e and o, so a learner who types that way is right. A gate against typed answers with は, へ or を would stop lesson 43 from asking for は, the point of that lesson, and would leave the bug in place for any later check.

In `writing-eval/writing-eval.service.ts`:

```ts
/** は, へ and を as spoken, and how rōmaji usually spells them (H.2.a). */
const SPOKEN: Record<string, string> = {
  は: '[はわ]',
  へ: '[へえ]',
  を: '[をお]',
  こんにちは: 'こんにち[はわ]',
  こんばんは: 'こんばん[はわ]',
};
const SEPARATORS = /[\s、。,.!?！？]/g;

function matchesSpoken(answer: string, exemplar: string): boolean {
  const pattern = exemplar
    .split(/[\s、。]+/)
    .filter(Boolean)
    .map((w) => SPOKEN[w] ?? w.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&'))
    .join('');
  return new RegExp(`^${pattern}$`).test(answer.replace(SEPARATORS, ''));
}
```

`exactMatch` ends with:

```ts
if (joinedAnswer === joinedExemplar) return true;
return /[a-z]/i.test(answer) && matchesSpoken(normAnswer, normExemplar);
```

Details that matter:
- Each position is independent, so `watashi wa hon wo yomimasu` passes.
- Only whole words change, so `wana` is still wrong for はな, and `wai` for はい.
- Rōmaji input only. The app doesn't convert input, so the server sees what was typed. A learner who types こんにちわ in kana has misspelled it, and it stays wrong.

**The gate closes the one gap, which makes the PM's "never" true.** The rule needs は as its own word in the stored answer, so an answer stored as わたしはがくせいです would still fail `watashi wa`. In `checkCourseRules`, for every closed typed question:

```ts
if (q.answerType === 'typed' && q.grading !== 'open') {
  const words = new Set(ctx.words);
  for (const w of q.correctAnswer.split(/[\s、。]+/)) {
    if (w && !words.has(w) && /[はへを]/.test(w.slice(1))) {
      errors.add(`check ${q.id}: put the particle in "${w}" in its own word`);
    }
  }
}
```

Add "including in a typed correctAnswer" to the spacing rule at `lesson-prompter.ts:170`, so a draft rarely trips this.

**Tests**

| File | Case |
|---|---|
| `writing-eval.service.spec.ts`, with and without the tokenizer | Accepted: konnichiwa, Konnichiwa, konnichi wa, konnichiwa!, konbanwa, watashi wa gakusei desu, watashi ha gakusei desu, kore o kudasai, kore wo kudasai, eki e ikimasu, watashi wa hon wo yomimasu |
| | Rejected: wana for はな, wai for はい, eya for へや, こんにちわ in kana for こんにちは, watashi ga gakusei desu for わたし は がくせい です |
| `course-rules.spec.ts` | Typed answer わたしは がくせい です fails. わたし は がくせい です, ごはん を たべます and こんにちは pass. An open typed question isn't checked |

**Not changed.** `arigato` for ありがとう and `sayonara` for さようなら stay wrong. Those drop a vowel that lessons 18 to 20 teach as real, and P2 tests it. It's a separate question from particles, so the PM should watch for it at Alpha.

## F5: stale draft at review

`authoring/review.ts`: export `rejectedDraftWarning(outputDir, lessonId): string | null`, which returns a message when `<id>.rejected.json` exists: "The last redraft of this lesson failed the course rules. You are reviewing the older draft." `main` prints it right after loading the draft. Test the helper with a temp directory. Keeping the old draft is still right, and the publish gate still runs.

## F6: rōmaji with macrons

`authoring/course-rules.ts`, in `typedReadingProblems`:

```ts
const looseRomaji = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s/g, '')
    .replace(/ou/g, 'o').replace(/([aeiou])\1+/g, '$1');
```

Compare `looseRomaji(q.prompt)` against `looseRomaji(romajiOf(target.surface))` and `looseRomaji(romajiOf(q.correctAnswer))`. Keep the kana `includes` check as it is. Tests: `(okāsan)`, `(okaasan)` and `(gakkō)` are all rejected.

## F7: unchecked title

Publish the outline's title, so a model can't change one. In `authoring/lesson-publisher.ts`, add `lessonTitle: l.title` to the context built from the skeleton, and use `ctx.lessonTitle` in both the `update` and `create` of the lesson upsert, replacing `draft.title`. Test: a draft titled 食べます publishes the skeleton's title. This also protects P11.

## F9: the additive guarantee

`ingest/supplement.spec.ts`: type the fake's `where` as `{ id: string; meaning?: null }`, and add as its first line:

```ts
if (where.meaning !== null) throw new Error('fill only empty meanings');
```

Changing `supplement.ts:137` to `{ id }` must then fail the suite.

## Order for the Developer

1. F1 and F4, then F6, F3, F5, F7, F9.
2. F2's server and mobile change.
3. `pnpm typecheck && pnpm lint && pnpm test`, and push.
4. Section 3 steps 1 to 3 on a throwaway branch, then the simulator check. Steps 4 and 5 stay after the merge.
5. Record everything in `dev.md`, including any deviation.

## What the Tester reruns

- Full verification on the new commit, and CI.
- The gate probes in `test.md`, plus the F1 table above.
- All 342 outline items on real rows: every `recap` is non-null and differs from the front, and no word's `recap` matches its rōmaji.
- `exactMatch` with the real tokenizer on the F3 table.
- Mutations touching the changed code, including F9's.
- The simulator check. The live grader check needs no rerun, because no meaning, question text or model changes.

## Decision to log

For the Lead to append to `decisions.md`. G.4.e above is already there. The ids below are free as of now, so renumber if another entry takes one.

### H.2.a Typed rōmaji may spell particles as they sound (amends H.2) (decided by Tech Lead, 2026-11-08)

**Decision:** A closed typed answer entered in rōmaji is also accepted when は, へ or を, as whole words in the stored answer, are typed as wa, e or o, and when こんにちは and こんばんは end in wa. Each position is independent. The drafting gate rejects a closed typed answer with one of those particles joined to another word, so the rule always applies.

**Why:** Rōmaji normally spells them that way, and a beginner's first phrase lesson would otherwise mark konnichiwa wrong. Whole-word matching avoids accepting `wana` for はな.

**Rejected:** A gate banning typed answers with those particles (lesson 43 could no longer ask for は, and the wrong grading would stay). Finding particles by morphological analysis (unreliable on kana-only text, F.2.a). Accepting わ for は in kana input (that's a real spelling mistake).

**Reverse:** Remove `matchesSpoken` from `exactMatch` and the gate rule.

### B.3.a The server supplies the back of the lesson recap card (decided by Tech Lead, 2026-11-08)

**Decision:** `LessonItemDto.recap` carries the text the Practice card reveals, built by `recapBackFor` from the same helpers as the review answer: rōmaji for kana, meaning for words and grammar, meaning then clean readings for kanji. The app only prints it. The PM's ruling on what each card shows is in `ops/work/22a-outline-gaps/triage.md`.

**Why:** Keeps KANJIDIC marker handling in one place, keeps `reading` meaning what it does elsewhere, and needs no data change.

**Rejected:** Sending `Item.data` to the app (duplicates parsing in the client). Redefining `reading` (`CurriculumScreen` uses it). Building rōmaji in the app (wanakana gives `konnichiha`). Storing the text on `Item` (a data change for something computable).

**Reverse:** Drop the field and point the card at another field. No data change is needed.
