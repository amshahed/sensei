# Tech plan: authoring pipeline hardening

Unit `authoring-hardening`. Written by the Tech Lead, 2026-11-16, from the Lead's `brief.md`. One Developer PR in five commits. The last commit is the 38/39 swap, on its own. Decisions: `decisions.md` F.2.f to F.2.i and H.2.e.

---

# 0. What the code does today (verified)

- **Paid replies are thrown away.** In `generateDraft` (`lesson-prompter.ts:317-350`), once the paid call returns, `assertComplete` (output cut off at `max_tokens`), `parseLlmJson` (not JSON) and `LessonDraftSchema.parse` can each throw. `runDrafts` (`draft.ts:289`) doesn't catch, so the reply is lost, the summary line never prints, and the driver logs $0.
- **The prompt invites both `grading` slips and open checks.** Every lesson with course context gets "A question with no single right answer has answerType "typed", grading "open"…" (`lesson-prompter.ts:177`). The schema accepts only `"open"` or no value (`lesson-schema.ts:69`). That line is the likely source of the wave 2 parse crashes and of the open checks nobody asked for (lessons 37, 47, 75).
- **P5 collisions** (`course-rules.ts:358-411`): folding collapses doubled vowels and turns `ou` into `o`, so いい becomes `i` and どう becomes `do`. Some rōmaji is simply English (`zero`, `are`, `made`, `man`, `fun`). `ONE_SOUND` only knows small ゃ, ゅ and ょ.
- **The validator only warns** (`draft.ts:173-177`): `<id>.json` is written anyway. `publish.ts` runs the course rules but not the validator, and calls `main()` with no guard, so a test can't import it.
- **Practice templates are never published.** `lesson-publisher.ts` writes `teach`, `LessonItem` rows and `Check` rows only. The Practice beat is the item recap card (B.3.a).
- **The outline is in sync.** The committed outline compiles to today's `skeleton.json` exactly, apart from `generatedAt`. So after the swap, the rebuild diff will show only the swap and the timestamp.

## Spike results (throwaway, $0, 2026-11-16)

I built a prototype of the matcher and rules in 1.3 to 1.7. I ran it over every draft in the main checkout's `tools/authoring/output/` and `published/`: 101 files, covering all approved and published wave 1 and 22b lessons, the wave 2 drafts and both rejected files. Lessons ch07-l06 and ch07-l07 were run against a swapped copy of the outline.

| Rule | Today | New |
|---|---|---|
| P5 explanation give-away | 1 error (lesson 67, "zero") | 0 |
| I-Reading Teach give-away | n/a | 0 on approved content, including lessons 4, 8, 13, 32 and the café menu |
| Prompt spells its own answer | n/a | 0 |
| Open check the outline didn't ask for | n/a | 2: lessons 47 and 75 (wave 2, not approved, already held in `wave2-notes.md`) |

- **Sensitivity.** The PM's pre-edit lesson 13 (kept in the corrections log) gets 6 I-Reading errors: `yama` twice, `tori`, `wani`, `nori`, `hon`. Lesson 20's 22b original gets 0.
- **Probes that pass:**
  - the Tester's F1 cases: "I" for いい, "do" for どう, "are" for あれ, "made" for まで;
  - "zero" for ゼロ, "man" for まん, "fun" for ふん, "so" for そう.
- **Probes that are caught:** `kippu`, `Kippu!`, `gakkō`, `gakkoo`, `ii`, `dō`, `dou`, `nōto`, `no-to`, `na-ni`, `ha-na`, `okāsan`, `konnichiha`, F2's `kip-pu` and `kin’you`, and "tomodachi ha isha desu".
- **A second, collapsed-vowel form was tried and dropped.** It caught `mango`, the meaning of マンゴー, in the PM's approved café menu. Its only extra catches were `kippū` and `gakko`. No model writes `kippū`, and the grader rejects `gakko`, so mentioning it gives nothing away.
- **English collisions in the beta outline** (every surface's rōmaji checked against a word list, then pruned by hand): あれ `are`, それ `sore`, だれ `dare`, まん `man`, ふん `fun`, ゼロ `zero`, plus the one-kana sounds.
- **No outline word contains a small vowel kana** (ァィゥェォ), so wanakana spelling ティ as `tei` is latent (section 5).

---

# 1. Approach

## 1.1 A paid reply is never lost (item 1)

- `generateDraft` keeps its signature. Everything after the call goes into an exported, pure `parseDraftReply(reply, lesson)`.
- On any failure there (cut off, not JSON, schema), `generateDraft` throws a `DraftReplyError` carrying:
  - `model`, `inputTokens`, `outputTokens`, `stopReason`, `receivedAt`;
  - `reply`: the parsed object, exactly as the model wrote it, when it was JSON;
  - `raw`: the text, only when it wasn't JSON;
  - `error`.
- `runDrafts` catches `DraftReplyError` and:
  - adds the cost to `summary.costUsd`, so `--max-cost` counts it;
  - prints `[reply] FAILED — <error>  (tokens: … (~$0.07)) → <id>.failed.json`;
  - writes `<id>.failed.json`, first moving an older one to `<id>.failed.prev.json` (the `.prev.json` pattern), because a paid reply is never overwritten;
  - counts it in a new `summary.failed`, sets exit code 1, and goes on to the next lesson.
- An error of any other kind after the call is saved the same way and then rethrown. It's environmental (for example the database), so the batch should stop.
- **Skipping.** A lesson with `<id>.failed.json` is skipped like one with a draft or a rejected draft (F.2.a), unless `--force`. Its cost was already paid.
- **`--recheck` handles `.failed.json` before `.rejected.json`.** It re-parses the stored `reply` (or `raw`) with today's code, then runs `gateAndSave`.
  - Saved as a draft or rejected by the gate: `.failed.json` is removed.
  - Still failing: its `error` is updated.
  - It's free, and `NO_MODEL` is unchanged. A reply that needs a hand fix is edited in the file's `reply` object, which is plain JSON rather than an escaped string, then rechecked.
- **Rejected:**
  - Always writing every reply to disk (`<id>.reply.json`): doubles the files for the common case.
  - Retrying the call: pays again, and the same slip repeats.
  - Storing only the raw string: can't be edited by hand.

## 1.2 A harmless slip doesn't cost a draft (item 2)

Both remedies, because each is a few lines:

- **Normalise in `parseDraftReply`, before the schema** (`normalizeDraftReply`):
  - A check with a `grading` other than `"open"` and no `rubric` is closed, so `grading` is dropped.
  - `"Open"` and `" open "` become `"open"`.
  - A non-open `grading` *with* a `rubric` might mean open, so it's left as a schema failure. It lands in `.failed.json` (1.1), recoverable at $0.
  - `lessonId`, `lessonType`, `title` and `targetItemIds` are set from the skeleton lesson. The prompt tells the model to copy these verbatim, so any difference is a copy slip, and a slipped `targetItemIds` would otherwise only surface as a foreign-key error at publish.
- **Prompt.** The open-check line appears only where the author note asks for an open check (1.6). Without it, the model has no reason to write `grading` at all.
- **Rejected:**
  - Loosening the schema to any string: every reader of drafts would then have to interpret "closed".
  - A list of closed synonyms: we don't know what the model wrote, and the rubric test is exact.

## 1.3 P5 stops rejecting English (item 3: F1, F2, F4, F5; amends F.2.e)

One matcher, `spellsOut(text, romaji)`, used by every give-away rule (1.3, 1.5 and 1.7). Both the text and the rōmaji go through the same normalisation:

- Lowercased.
- Macrons and circumflexes become doubled vowels (ō is `oo`), and other accents are stripped.
- Apostrophes `'`, `’` and `‘` are removed, so `kin’you` is `kinyou` (F2).
- `ou` becomes `oo`, so `gakkou`, `gakkō` and `gakkoo` are one form.
- A hyphen between letters is read both ways: dropped (`kip-pu`, `na-ni`), and after a vowel as that vowel again (`no-to` is `nooto`, as in H.2.d).
- **Doubled vowels are not collapsed.** That collapse is what made いい `i` and どう `do`.
- Matching is whole words, and a multi-word answer must appear as the whole word sequence (unchanged).

**What counts as the rōmaji of an answer:**
- The rōmaji the app shows after a miss (B.2.b, `answerFormsOf`).
- Also the kana spelled out literally, with は as `ha`, so "tomodachi ha isha desu" is caught (F2).

**English lookalikes are skipped.** If the rōmaji is itself a common English word, it's in `ENGLISH_LOOKALIKES` (about 35 words):
- the vowels;
- short sound-words: to, no, so, go, do, he, me, hi, be, ha, ma, mo, ya, yo, re, ta, pa, pi;
- the outline's collisions: are, sore, dare, man, fun, zero;
- made, same, name, too, you.

The gate can't tell a reading from an English word there. For a loanword such as ゼロ, the meaning gives the learner the same letters anyway, so a lesson can't avoid the "give-away".

**The other findings:**
- **F5:** `ONE_SOUND` becomes `/^[ぁ-ゖ][ぁぃぅぇぉゃゅょゎ]?$/`. It's applied after `normalizeJapanese`, so katakana counts, and ティ and ファ are one sound.
- **F2, one word of a multi-word answer: deferred,** as check-explanation planned. Matching each word would flag every taught word (`desu`, `wa`) mentioned before a sentence check, and a sentence check tests putting the sentence together, not reading the word.
- **F4:** closed by 1.7. A typed reading check whose prompt spells out its own answer (`konnichiwa`) is no longer fair, so the transform rewrites its prompt.
- **H.2.d wording (F3):** amend the wording, not the code (H.2.e).
  - A hyphen typed in rōmaji is ー, so it holds the vowel before it in hiragana answers too: `oba-san` for おばあさん, `o-kii` for おおきい.
  - It only accepts spellings that sound right. おう and えい words still need every kana typed (`gakkou`, `eiga`), and `gakko-` and `e-ga` stay wrong.
  - Narrowing it would need the grader to know whether the stored answer came from katakana, for no gain to the learner.

**Rejected:**
- Downgrading P5 to a warning. The PM wants the same class enforced mechanically in I-Reading, and a warning sends every case to review.
- Skipping rōmaji of three letters or fewer. That still misses made, same and name, and stops catching `ii` and `dou`.
- An English dictionary dependency. The machine's word list calls `ka`, `kore` and `chichi` English, and loanwords such as sushi are both.

## 1.4 A check pointing at an undeclared item is repaired or refused (item 4)

- **Repair.** A new pure transform, `repointUndeclaredTargets(draft, ctx)` in `apps/api/src/authoring/item-refs.ts`, runs first in `gateAndSave`.
  - Condition: a check's `targetItemId` isn't declared, and its `correctAnswer` (compared with `normalizeJapanese` and `asGraded`) equals the surface of exactly one declared target.
  - Result: the check is repointed to that target, and a console line says so.
  - This is the Lead's hand fix for lessons 22 and 25 made mechanical: both answers equal exactly one declared surface (verified).
  - If no target or several match, nothing changes, and the validator rejects the draft.
- **The validator becomes a gate.** A structural failure writes `<id>.rejected.json` like a rule failure. Its errors, prefixed `structure:`, go in the same `courseRuleErrors` list, so a `--force` redraft is told why and `--recheck` can cure it. This applies with or without course context.
- **Publish.** `authoring:publish` refuses a structural failure the same way it refuses a rule failure, before the transaction, with a message naming the check. The foreign key is no longer the only guard. `publish.ts` gets the `require.main` guard and an exported `publishRefusals(draft, skeleton, prisma)`, so a test can call it.
- **Rejected:**
  - A fuzzy match on the garbled ID (`ありがotou`): edit distance across scripts is a judgment, and the answer already settles it for free.
  - Rejecting only: pays for a redraft to fix something mechanical.

## 1.5 An I-Reading Teach beat gives nothing away (item 5)

- **New gate error, I-Reading lessons only.** It fires when any Teach field `spellsOut` the rōmaji of a closed typed check in the same lesson. "Teach field" means every Teach field `learnerFields` reads, including an example's `reading`.
  - Single sounds and lookalikes are skipped, as in P5.
  - Example message: `teach[2]: spells out "yama" in rōmaji, and check q1 asks the learner to type it`.
- **Prompt.** The I-Reading rule line adds "Teach never writes in rōmaji a word that a typed check asks for: give its meaning only." The gate and the prompt say the same thing, F.2.d's pattern.
- This lifts the I-Reading no-go for lessons 55, 77, 83, 95 and 113.

## 1.6 An open check only where the outline asks for one (item 6.1)

- **`openChecksAllowed(authorNote?)`** in `course-rules.ts`: true when the note contains `grading "open"`, which today is exactly lesson 120. A spec over the real outline pins that, so a reworded note fails CI instead of quietly changing the gate.
- **Gate error:** `check q4: an open check is only allowed where the outline's author note asks for one`.
- **Prompt:** the open-check rule appears only where allowed. Elsewhere it says "Every check has one right answer: write no open checks and no grading field."
- Lessons 47 and 75 are refused at publish until the PM converts their open checks. They're already held for exactly that.
- **Rejected:** a new outline flag (`openCheck: true`). It would be cleaner, but it changes lesson 120's skeleton entry, so the post-swap rebuild diff would no longer show only the swap. The note already says it.

## 1.7 A typed check doesn't answer itself (item 6.2)

- **Gate error** on a closed typed check whose prompt, minus the standard reading prompt, `spellsOut` its own answer. Single sounds count here.
  - Example message: `check q3: the prompt spells out "ka", the answer it asks for`.
  - Lookalikes are skipped, so lesson 67 q8 ("Type the Japanese (katakana) for zero.") passes. Strictly it does answer itself. That's flagged to the PM in section 5.
- **`isFairTypedReading`** also requires that the prompt not spell out its own answer, so the typed-reading transform and the gate keep agreeing (F.2.b). This closes F4.

## 1.8 Deferred, with reasons (items 6.3 and 8)

- **6.3, practice templates in `production` mode.** No learner sees one. The publisher doesn't store practice templates (section 0). A template's hint is already gated text. Revisit if templates are ever published.
- **8, particle phrases before grammar, and the critic's `example-feel`.**
  - The drafter already gets the untaught-particle list (F.2.d).
  - Every lesson up to 42 is drafted except the audio ones.
  - Changing the critic mid-batch breaks the repeatability F.2.e kept.
  - The PM treats those critic fails as noise. Not worth it.

## 1.9 Lessons 38 and 39 swap (item 7)

Commit E, on its own:

- Exactly `ops/work/22c-full-batch/content-review.md` section 3 step 1.
- `outline-compiler.spec.ts`: in the test "targets words only in the sound lessons…", the `typedReading` count becomes 7. The test also checks that lesson 38 is the katakana sounds lesson, carries `typedReading` and holds the katakana sound stage, and that lesson 39 is the reading lesson.
- `apps/api/src/testing/typed-answers.ts:328-370`: the strings stay. Add one comment saying the `ch07-l06` and `ch07-l07` sources are the wave 1 drafts from before F.1.c.
- No other code refers to those two IDs or positions (grep).

---

# 2. Changes

| File | Change | Commit |
|---|---|---|
| `apps/api/src/authoring/lesson-prompter.ts` | `DraftReplyError`, `parseDraftReply`, `normalizeDraftReply`. Prompt lines for open checks (1.6) and I-Reading (1.5) | A, C, D |
| `apps/api/src/authoring/draft.ts` | Catch and save failed replies, skip `.failed.json`, `--recheck` of `.failed.json`, `summary.failed`. Repoint transform; validator failure is a rejection | A, B |
| `apps/api/src/authoring/item-refs.ts` (new) | `repointUndeclaredTargets` | B |
| `apps/api/src/authoring/publish.ts` | `publishRefusals` (validator plus course rules), `require.main` guard | B |
| `apps/api/src/authoring/course-rules.ts` | `spellsOut`, `ENGLISH_LOOKALIKES`, the rōmaji of an answer, `giveawayProblems` on the new matcher, `readingTeachProblems`, `selfAnsweringProblems`, `openChecksAllowed`, `ONE_SOUND`, `isFairTypedReading` | C, D |
| `apps/api/data/curriculum/foundation-ja-beta.json` | The swap | E |
| Specs | `draft.spec`, `lesson-prompter.spec`, `course-rules.spec`, `typed-reading.spec`, `item-refs.spec` (new), `publish.spec` (new), `outline-compiler.spec`, `answer-romaji.spec` (pins H.2.e) | each |

- **Contracts.** `LessonDraft` and `CheckQuestion` are unchanged. `DraftRunSummary` gains `failed`. The summary line keeps `estimated cost ~$`, which the driver reads, and adds `failed N`.
- **New local file**, gitignored: `tools/authoring/output/<id>.failed.json` = `{ lessonId, receivedAt, model, inputTokens, outputTokens, costUsd, stopReason, error, reply?, raw? }`.
- No new dependency, no Prisma or API change, no mobile change.

---

# 3. Data

| What | Additive? | Tested by | Rollback |
|---|---|---|---|
| Live database | No change. No migration, no row touched | n/a | n/a |
| Committed outline spec (commit E): two lessons reordered and their IDs swapped, one flag added, one sound stage's `lessonId` changed | **Not additive.** But nothing published or learner-owned refers to either ID: neither lesson is published, and the stop list is about live data | `outline-compiler.spec`. The Lead's skeleton diff after merge | Revert commit E before either lesson is published (F.1.c's reverse) |
| Local authoring files (gitignored): new `.failed.json`; `.rejected.json` now also holds `structure:` errors | Additive. Existing files read as before | `draft.spec` | Revert the PR. Old code ignores `.failed.json`, so delete any by hand, or the next run drafts that lesson again |
| After merge (Lead, main checkout): `content-review.md` §3 steps 2 to 5 | The skeleton rebuild replaces a gitignored file | The diff check | Restore the `skeleton.json` backup and rename the drafts back |

**Expected rebuild diff:** the two ch07 lesson entries, the one sound stage and `generatedAt`. Anything else: restore the backup and stop.

---

# 4. Promise map

Each test fails on today's `main` and passes after, except where marked.

| Brief item | Implementation | Test |
|---|---|---|
| 1 A paid draft is never thrown away | 1.1 | `draft.spec`: a reply failing the schema writes `.failed.json` with the reply and token counts; `costUsd` includes it; the next lesson still drafts; nothing throws. `--max-cost` stops before the next lesson on a failed reply's cost. A plain run skips a lesson with `.failed.json`. `--force` keeps the older one as `.failed.prev.json`. `--recheck` recovers a failed reply once the cause is fixed, with `NO_MODEL` (no call). A `max_tokens` cut-off is saved as `raw` and counted |
| 2 A harmless slip doesn't cost a draft | 1.2 | `lesson-prompter.spec`: `grading: "closed"` with no rubric parses, and the draft has no `grading`. `"Open"` becomes `"open"`. `grading: "ai"` with a rubric still throws `DraftReplyError`. A reply with a slipped `lessonId` or `targetItemIds` gets the skeleton's values. The prompt has no open-check line without the note |
| 3 P5 stops rejecting fair drafts (F1, F2, F5, H.2.d wording) | 1.3 | `course-rules.spec`: the Tester's five F1 probes and a lesson 67 shaped fixture (q7 "ゼロ means zero", q8 typed ゼロ) pass. `kippu`, `gakkō`, `ii`, `dō`, `nōto`, `okāsan` and `konnichiha` are still caught. `kip-pu`, `kin’you` and "tomodachi ha isha desu" are now caught. "ティ is tei" before a typed ティ passes (F5). `answer-romaji.spec` pins `oba-san` as accepted for おばあさん and `gakko-` as rejected. **This pin passes on `main` too: it documents H.2.e, a wording change** |
| 4 An undeclared item is fixed or refused | 1.4 | `item-refs.spec`: the lesson 22 and lesson 25 shapes are repointed. Two matching targets and an English answer are left alone. `draft.spec`: a garbled ID with no match is written to `.rejected.json` with a `structure:` error, not `.json`. `publish.spec`: `publishRefusals` names the check with an undeclared target, and returns none for a clean draft |
| 5 I-Reading gives no answers away | 1.5 | `course-rules.spec`: an I-Reading Teach text "なに is na-ni" and an example `reading: "yama"` before typed checks for them are errors (the pre-edit lesson 13 pattern). A worked example that no typed check asks for passes (lesson 4's あさ). The same Teach in an F-Vocab lesson passes. `lesson-prompter.spec`: the I-Reading prompt line is present |
| 6.1 Open check only where the note asks | 1.6 | `course-rules.spec`: an open check with no note is an error; with lesson 120's note it isn't. `outline-compiler.spec`: in the real outline, exactly `foundation-ja-ch17-l07` allows open checks. `lesson-prompter.spec`: the open-check line appears only with that note |
| 6.2 A typed check that answers itself | 1.7 | `course-rules.spec`: "Type the kana that reads 'ka'" (answer か) and "Type konnichiwa in kana" are errors. "Type the Japanese (katakana) for zero." passes. `typed-reading.spec`: a reading check whose prompt says `konnichiwa` gets its prompt rewritten (F4) |
| 6.3 Practice templates in `production` mode | Deferred (1.8): never published | None. Verified by reading `lesson-publisher.ts` |
| 7 Swap 38 and 39 | 1.9, commit E | `outline-compiler.spec`: 7 typed-reading lessons; lesson 38 is the sounds lesson with `typedReading` and the katakana stage; lesson 39 is the reading lesson |
| 8 Pre-grammar particle phrases and the critic | Deferred (1.8) | None |

**Acceptance checks.** The Developer reports these in `dev.md`, and the Tester repeats them:

1. Run the PR's `checkCourseRules` and `validateStructure` over every file in the main checkout's `tools/authoring/output/*.json`, `*.rejected.json` and `published/*.json`, read-only. Use main's skeleton, and a swapped copy for ch07-l06 and ch07-l07. Point `validateStructure` at the throwaway Neon branch `test-78-check-explanation`, not live.
   - **Expected new errors:** exactly lessons 47 q4 and 75 q4 (open checks). Lesson 67's rejected file passes. Approved and published content: 0 errors.
   - Any other hit is either a wrong rule or something the PM must see.
2. `pnpm typecheck && pnpm lint && pnpm test`, plus `/code-review high`.

---

# 5. Risks

| Risk | What would show it | Response |
|---|---|---|
| `ENGLISH_LOOKALIKES` is curated, not complete. A future word whose rōmaji is English gets falsely rejected | A rejection quoting an English word | Add the word to the list. It fails loudly and costs at most one redraft |
| A real give-away of a lookalike word ("あれ is read are") passes | PM review | Accepted: the gate can't tell a reading from English there |
| Lesson 67 q8 answers itself: typing `zero` is right for ゼロ | PM review of lesson 67 | **For the PM:** passes the gate by design. Convert it to a reading check if wanted |
| Dropping a non-open `grading` turns an intended open check into a closed one | A closed check with a model answer, marking paraphrases wrong | Only dropped when there's no rubric, and an open check needs a rubric to be graded |
| The repoint sends mastery credit to the wrong item | Impossible by construction: only when the answer equals that one target's surface | None |
| The validator as a gate rejects fair drafts, because a validator rule was always noisy | The acceptance scan, and `structure:` rejections in the wave 3 log | The scan must show 0 on approved content. If a rule is wrong, fix the rule, not the gate |
| Forcing `targetItemIds` from the skeleton hides a model that rewrote its targets | None. The outline owns targets (F.1.a) | Accepted |
| The new prompt lines change wave 3's drafts | Wave 3 PM review | Intended. Waves 1 and 2 are already drafted |
| The driver doesn't know `.failed.json`, so a re-run logs "FAILED $0" for a skipped lesson | `run-log.txt` | Lead tweak after merge (section 6) |
| Latent: wanakana spells ティ and ファ as `tei` and `fuxa`. The B.2.b answer line would show those, and typing `ti` would be marked wrong | A word with a small vowel kana entering the outline (none today, verified) | Not in this unit. For the PM backlog |
| The critic also throws away its reply on a parse failure | A critique crash (about $0.005) | Not in this unit. Cheap, so left as is |

---

# 6. Tasks

**Developer, one PR, in this order.** Set up a worktree at `.claude/worktrees/authoring-hardening` per `ops/PROJECT.md`. Each commit is green on its own.

1. **Commit A, items 1 and 2.** `DraftReplyError`, `parseDraftReply` and `normalizeDraftReply` in `lesson-prompter.ts`. Catch and save, skip, `--recheck` and `summary.failed` in `draft.ts`. Specs from the promise map. Update the existing "throws on non-JSON LLM output" spec to expect `DraftReplyError`.
2. **Commit B, item 4.** `item-refs.ts` and its spec. `gateAndSave` order: repoint, typed-reading transform, validator, rules. A validator failure is a rejection. `publish.ts` guard and `publishRefusals`, with a new `publish.spec`.
3. **Commit C, items 3, 5 and 6.2.** The matcher, lookalikes, the answer's rōmaji, the rewritten P5 rule, the I-Reading Teach rule, the self-answer rule, `ONE_SOUND` and `isFairTypedReading` in `course-rules.ts`. The I-Reading prompt line. The H.2.e pin in `answer-romaji.spec`. Delete `foldedWords` once nothing uses it.
4. **Commit D, item 6.1.** `openChecksAllowed`, the gate error, the conditional prompt line, and the real-outline spec.
5. **Commit E, item 7, alone.** The outline edit exactly as in `content-review.md` §3 step 1, the `outline-compiler.spec` update, and the `typed-answers.ts` comment.
6. **Verify.** Run the acceptance checks in section 4 with a throwaway script in the scratchpad, not committed. Results, and any deviation from this plan, go in `dev.md`. Open the PR.

**Lead, after merge** (none of this needs the Developer):

1. The swap steps in `content-review.md` §3 steps 2 to 5. Expected skeleton diff as in section 3.
2. `ops/work/22c-full-batch/run-wave.mjs`: add `.failed.json` to the skip check, and log `PARSE-FAILED` with its cost when one appears.
3. `pnpm --filter api authoring:draft foundation-ja-ch11-l03 --recheck` (lesson 67, $0).
4. Draft lessons 44, 53, 54, 55, 74 and 77 with the driver, at about $0.07 each. A parse failure is now saved and recoverable at $0, so each costs at most one paid draft. I-Reading lessons 55 and 77 are unblocked by item 5.
5. The PM converts the open checks in lessons 47 and 75 before they're published. Publish refuses them until then.
6. Wave 3.
