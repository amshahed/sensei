# Dev notes: unit 22a-outline-gaps

Developer, 2026-11-08. PR #70, branch `feat/22a-outline-gaps`, worktree `.claude/worktrees/wt-22a`. Covers `tech.md` tasks 1 to 8.

Task 9 is not done and not attempted: no Neon branch, no write to the live database, `tools/authoring/output/skeleton.json` untouched.

# What changed

| Task | Result |
|---|---|
| 1. Spec and compiler | `foundation-ja-beta.json`, `outline-compiler.ts`, `outline.ts`, schema additions, guard against `authoring:skeleton` overwriting a compiled outline |
| 2. Supplement ingest | `supplement.ts`, `vocab-supplement.json`, `grammar-supplement.json`, null-meaning fix in `grammar.ts` |
| 3. Kana surface | `learner-surface.ts`, homophone table, たいです line, applied in mastery, practice, lesson mapper, curriculum and placement questions |
| 4. Kanji evidence | `mayInferMastery`, `inferable`, `seedUntested`, `writeBack` filter, full test table including the HTTP test |
| 5. Drafter context | `course-context.ts`, prompts, kana cards, 8000-token cap, passage filter, critic context |
| 6. Gate and open checks | `course-rules.ts` in draft and publish, `grading: "open"` through schema and publisher |
| 7. Draft CLI | Skip by default, `--force`, `--max-cost`, rejected files, `review.ts --regenerate` passes `--force` |
| 8. Live grader check | `grader-check.ts`, `grader-cases.json`, results below |

# Verification

`pnpm typecheck && pnpm lint && pnpm test` pass: 56 suites, 733 tests.

**Meanings are verbatim.** Loading `grammar-meanings.json` and the `meanings` object of `grammar-supplement.json` and comparing them gives equal objects, 24 keys each. The longest is `ja:grammar:に` at exactly 100 characters.

**Outline shape on the real spec.** 120 lessons, 17 chapters, 184 spellings (185 words), 24 grammar, 41 kanji.

| Group | Words | Brief 3.3 |
|---|---|---|
| が / ざ / だ row | 24 / 18 / 21 | 24 / 18 / 21 |
| ば / ぱ row | 7 / 4 | 7 / 4 |
| Combinations | 17 | 17 |
| Small っ | 7 | 7 |
| Long vowels | 41 | about 41 |

**`authoring:outline` against live Neon, read-only, `--output` to a scratch path.** It fails as expected before the ingest, listing exactly 32 missing rows (22 vocab, 10 grammar) and no surface mismatch on the other items. It wrote no file.

**Live grader check.** Run once, 13 cases, 3 runs each, 39 Gemini calls, no Anthropic spend. **`LLM_GRADING_MODEL=gemini-3.5-flash-lite` was set for this run only**, because `gemini-2.5-flash` returns 404 (unit `grading-model-404`, whose plan names this model). All 39 results were `gradedBy: ai`.

| Item | Learner types | Want | Ratings |
|---|---|---|---|
| こんにちは | hi there | Accepted | Good/Good/Good |
| ありがとう | thanks a lot | Accepted | Good/Good/Good |
| すみません | sorry | Accepted | Good/Good/Good |
| おやすみなさい | sleep well | Accepted | Good/Good/Good |
| よろしくおねがいします | nice to meet you | Accepted | Good/Good/Good |
| です | is | Accepted | Good/Good/Good |
| も | too | Accepted | Good/Good/Good |
| に | at | Accepted | Good/Good/Good |
| に | to | Accepted | Hard/Hard/Hard |
| を | object particle | Accepted | Good/Good/Good |
| て-form | connects verbs | Accepted | Good/Good/Good |
| ませんか | do you want to | Accepted | Good/Good/Good |
| か | because | Rejected | Again/Again/Again |

13 of 13 passed, so no meaning needs a PM rewrite. To rerun from a worktree:

```bash
LLM_GRADING_MODEL=gemini-3.5-flash-lite pnpm exec node --env-file=/Users/sh/workspace/sensei/apps/api/.env -r ts-node/register -r tsconfig-paths/register src/authoring/grader-check.ts --source /Users/sh/workspace/sensei/apps/api/data/sources/jmdict-eng-3.6.2.json
```

It pauses 4.5 seconds between calls to stay under the free tier, so a run takes about 4 minutes.

# Deviations from tech.md

1. **A second collision exists, and the table has three entries, not two.** Section 1.2 says kana display creates exactly one collision (さん and 三). There is another: 二 reads に, the same as the grammar item に. Both would have asked "What does 「に」 mean?" with different right answers. The validator caught it once grammar surfaces were included. I added `二: 'as a number'` to the same table. Grammar に keeps its plain prompt, which the grader cases rely on.
2. **`SkeletonSchema` also carries `soundStages`.** The plan names only `surfaces`. `courseContextFor` works from the skeleton alone and has no other way to know which lesson teaches voiced sounds or long vowels.
3. **`grammarPrereqs` also accepts a lesson id as a key.** The two question lessons (63, 64) require か directly. Without it, P7's "か before I'm asked a question" would rest only on ませんか at lesson 100.
4. **`.gitignore` gained `!apps/api/data/curriculum/`.** `apps/api/data/*` is ignored, so the planned files could not be committed otherwise.
5. **`assessments.service.ts` needed no `learnerSurface` call.** Section 2 lists it among the services returning `display`, but it returns only prompts, and those already go through `recallQuestionFor`.
6. **Gate additions the plan doesn't spell out.** でした is treated as a marker that is never taught, per brief section 5, and is allowed only inside a learned phrase. An open check on a multiple-choice question is a gate error, because `ChecksService` always grades multiple-choice as closed. A missing kana card is a warning.
7. **`--max-cost` refuses to start if the model has no known price**, since the limit could not be honoured otherwise.
8. **One prompt rule the plan doesn't state.** The rule "Japanese only from these lists" would leave kana reading lessons (4, 8, 13, 14, 32, 38) nothing to read, because no word has been taught yet. Those lessons may use simple words spelled only with taught kana. The gate still checks each character.

No other deviations.

# For the Tester to look at hard

- **Gate false positives on spaced text.** Superseded by Round 1 (F1, F4): the ます-family endings are now checked per word.
- **The long-vowel check is a heuristic** (`hasLongVowel`). A hard failure on outline words only, a warning on draft text.
- **`--force` when the new draft is rejected** leaves the old `<id>.json` in place and writes `<id>.rejected.json`. A later run skips that lesson. Since Round 1 (F5), `authoring:review` warns that it is showing the older draft.
- **The spec was generated once by a script from the appendix** and committed. The script isn't in the repo. Each lesson's items can be checked directly against the appendix.
- **Minutes.** Kept from the old outline where a lesson matches by title or is a clear rename (six kanji or speaking lessons and five others). Otherwise the plan's rule. The plan's rule has no F-Kanji value, but every F-Kanji lesson maps to an old one.
- **`/code-review high`** was run by the Tester on `0dcaf2d` (`test.md`). Round 1's commits haven't had one.

# Ideas outside the plan, for the Project Manager

- Lesson 17 shows 33 combination cards in about 7 minutes, following the brief's "shown once". It may be heavy for a tired learner, so check it first at 22b.
- The drafter doesn't see an item's committed grammar meaning, so lesson text could disagree with the review answer. Adding `Item.meaning` to the target list is small and would cost a few tokens.
- `authorNote` text is AI-written and not linguistically verified, including the notes on えい, おう, ぢ and づ. Fit for closed beta only, like the rest.

# Round 1 fixes

Developer, 2026-11-08. Implements "Round 1 findings" in `tech.md`, on `feat/22a-outline-gaps`, PR #70. Head is `2427db6`. `origin/main` (with PR #69) was merged first as `3600ab4`, with no conflicts.

| Finding | Commit | What changed |
|---|---|---|
| F1, F4 | `31183ca` | `markerProblems` as ruled: ます-family endings checked per word, `acrossSpaces` on てください and たいです, `TAUGHT_VERBS`, `maskKnown`. The whole F1 table is in `course-rules.spec.ts` |
| F6 | `09daf68` | `looseRomaji` in `typedReadingProblems` |
| F3 | `c93ecd2`, `2427db6` | `matchesSpoken` in `exactMatch`, the gate rule for a joined particle, the prompt line. See deviation 1 |
| F5 | `65b04b5` | `rejectedDraftWarning`, printed by `authoring:review` |
| F7 | `5d10836` | The publisher writes the skeleton's title on create and update |
| F8 | none | Accepted by the Tech Lead |
| F9 | `3fb10d1` | The fake enforces the `where` |
| F2 | `c753148` | `LessonItemDto.recap`, `recapBackFor`, the mapper, the card restacked in `LessonPlayer.tsx` |

## Verification

| What | Result |
|---|---|
| `pnpm typecheck && pnpm lint && pnpm test` on `2427db6` | Each exit 0. 56 suites, 870 tests |
| CI on `2427db6` | `verify` SUCCESS (run 42498924121) |
| `expo export --platform ios` from `apps/mobile` | Exit 0, 800 modules. Not required by the plan, run because the Lead asked |
| F9 mutation: `supplement.ts` `where: { id }` | 2 tests fail, on "fill only empty meanings". Reverted |
| All 342 outline items through `recapBackFor`, read-only Neon query for the 310 live rows plus the supplement builders for the 32 new ones | 92 kana, 185 words, 24 grammar, 41 kanji. 0 null, 0 equal to the front, 0 kanji with a `-` or `.` in the readings |
| Longest front / back | 11 characters (よろしくおねがいします) / 100 characters (`ja:grammar:に`), 生 is 97 |
| 30 gate probes from `test.md` on the real compiled context | All as expected. Lessons 15 and 19 report only the missing typed checks, which my probe draft doesn't have, and no sound error |
| `exactMatch` with the real tokenizer | F3 table in the spec, with and without the tokenizer |

**Spend.** No Gemini calls, no Anthropic calls. No meaning, question text or model changed, so the grader check wasn't rerun. No Neon branch, no write to the live database, `skeleton.json` untouched.

## Deviations from the rulings

1. **F3: the splits also break on ！ and ？ (`2427db6`).** The plan's `matchesSpoken` splits the stored answer on spaces, 、 and 。 only, but strips ！ and ？ from what the learner typed. So a stored answer ending in one could never match. I probed the plan's code with the real tokenizer: `watashi wa gakusei desu ka` against `わたし は がくせい です か？` was wrong, and `konnichiwa` against `こんにちは！` was wrong. That breaks the PM's "must never be marked wrong". The stored answer now splits on the same `SEPARATORS`. The gate's split matches, otherwise `こんにちは！` would be rejected with a misleading particle message. Specs added for both.
2. **One extra case on the F6 tests.** `(OKĀSAN)` and `(oka asan)` are also pinned, since `looseRomaji` handles them. No code difference.

## Not done

- **Simulator check: PENDING.** It needs a throwaway Neon branch for the fixture lessons, and the Lead didn't allow one this round. So `tech.md` Round 1 order step 4 and `triage.md` F2 condition 4 are open, and the card has not been seen rendered. F2 can't close until it has.
- **`tech.md` section 3 steps 1 to 3 on a branch: PENDING**, for the same reason. Real ingest on Postgres stays unexercised.

## For the Tester to look at hard

- **The card on a real screen.** Everything about fit is reasoning so far. A 375pt phone leaves 287pt inside the card (24 screen padding and 20 card padding on each side). 11 characters at 40pt need 440pt, so the scale is about 0.65, above the 0.5 floor. `い-adjective` and `な-adjective` are also 11 characters, narrower.
- **`ゼロ` will trip a naive "recap is not its rōmaji" check.** Its meaning is "zero" and its rōmaji is zero. It is the meaning, from JMdict, and the words coincide. It is the only one of 185.
- **`recap` null drops the card silently.** Nothing in the outline is null today, per the table above.

# Round 2 fixes

Developer, 2026-11-08. Fixes N1 to N3 from `test.md` on `feat/22a-outline-gaps`, PR #70. Head is `9eed6f6`. The Tester's report on `2427db6` is void for this commit.

| Finding | Commit | What changed |
|---|---|---|
| N1 | `9eed6f6` | `exactMatch` takes `{ spokenParticles }`, default on. `ChecksService.gradeClosed` turns it off when `targetItemId` starts with `ja:kana:`. `checks.service.spec.ts` runs the four rows of the N1 table and the honest answers through the real `WritingEvalService` |
| N2 | `9de7fe8` | The joined-particle rule runs only once は, へ or を has been taught, and skips a piece of a known word that the answer writes across spaces |
| N3 | `9eed6f6` | `SPOKEN_REJECTED` pins an extra word at each end of the answer |

## Verification

| What | Result |
|---|---|
| `TURBO_FORCE=true pnpm typecheck`, `lint`, `test` on `9eed6f6` | Each exit 0, `0 cached`. 56 suites, 903 tests |
| CI on `9eed6f6` | `verify` SUCCESS, run 42527725426, `headSha` matches. PR mergeable, state CLEAN |
| 14 mutations of the N1 to N3 code against the three specs | 14 caught, none by a compile error. Includes removing `^`, `$` and both, and always-on and always-off for the kana flag |

**Spend.** No Gemini or Anthropic calls. No Neon branch or write. `skeleton.json` untouched. The mobile bundle wasn't rerun, because no mobile file changed.

## Deviations

1. **N2 goes one condition past the Tester's recommendation.** Applying the rule only from lesson 43 clears the three reported cases, but `おはよう ございます` would be rejected again from lesson 43 on. So a piece is also exempt when a known word contains it and the whole answer contains that word. The second half matters: `ばんは` at lesson 60 is inside こんばんは but stays rejected, and that's pinned.
2. **The start of the rule is any of the three particles, not per particle.** The outline teaches は at 43, を at 89, and へ only together with に, as `ja:grammar:にへ` at lesson 90. Per-particle gating would leave へ unprotected until then. (Corrected in Round 3: this said へ is never taught, which `test.md` D1 showed was wrong.) The cost is that an unknown word such as `おへや` still fails from 43, and from there drafts are limited to known words anyway.

## For the Tester to look at hard

- **Superseded by Round 3 (N5).** A kana-target check with a whole word as its answer is strict too. At lesson 14, `ja:kana:ha` with stored こんにちは marks `konnichiwa` wrong, as it did before this PR. It takes a typed word on a kana target. The plan was to skip the table for every kana target, so I did.
- **`o` for を on a kana target is wrong again.** That's a change from `2427db6`, back to the earlier behaviour, and it matches kana reviews, where the only accepted rōmaji for を is `wo`.
- **Not run over HTTP this round.** N1 goes through the real `ChecksService` and `WritingEvalService` with Prisma faked, not through `AppModule`.

## For the Tech Lead

H.2.a says the gate rule "always applies" and describes the spoken match with no exception. Both are now narrower: kana-target checks are excluded, and the rule starts at the first taught particle. It needs an amending entry in `decisions.md`, which I haven't written.

## For the Project Manager backlog

**N4, not fixed, out of this unit.** `writing-eval.service.ts`: an answer of about 6,000 characters overflows the stack in wanakana and `POST /checks/:id/answer` returns 500. No endpoint caps answer length. Only the sender is affected and nothing is stored. A one-line cap, as a new small unit.

# Round 3 fixes

Developer, 2026-11-08. Fixes N5 and D1 from `test.md` round 3, PR #70. Head is `c040271`, `apps/api` only. The Tester's report on `9eed6f6` is void for this commit.

| Finding | Commit | What changed |
|---|---|---|
| N5 | `c040271` | `spokenParticles` is replaced by `kanaTarget`. Spoken matching now stays on for a kana target, and only a stored answer that is one kana, with separators removed, skips the `SPOKEN` table |
| D1 | `c040271` | `SPOKEN_PARTICLES` names `ja:grammar:にへ`, the real id. No behaviour change, because は at lesson 43 starts the rule first. Round 2 deviation 2 above is corrected. `decisions.md` H.2.b left alone, as instructed |

Skipping only the table, not the whole match, also fixes `ha.` and `ha!` for は, the separator rows in N5.

## Verification

| What | Result |
|---|---|
| `TURBO_FORCE=true pnpm typecheck`, `lint`, `test` on `c040271` | Each exit 0, `0 cached`. 56 suites, 940 tests |
| CI on `c040271` | `verify` SUCCESS, run 42529777201, `headSha` matches. PR mergeable, state CLEAN |
| All five N5 rows and the four N1 rows, real `ChecksService` and `WritingEvalService` | As ruled: N5 rows right, N1 rows wrong. Prisma faked, not over HTTP |
| 10 mutations of the N1, N3 and N5 code against the specs | 10 caught, none by a compile error. Includes restoring the round 2 behaviour, which fails 10 tests |

One mutation (`length <= 2` for the single-kana test) survived at first, because no real two-character answer has a table entry. I pinned the boundary with `wa o` for `は を` so the rule is exactly one kana.

**Spend.** No Gemini or Anthropic calls. No Neon branch or write. `skeleton.json` untouched. No ingest or mobile file changed, so the ingest and bundle results from round 3 carry.

## Deviations

None.

## For the Tester to look at hard

- **Kana typed with punctuation is still wrong on every target.** `は。` typed for a stored は fails, because `matchesSpoken` runs only on rōmaji input. It's existing behaviour, not in N5, and I left it.
