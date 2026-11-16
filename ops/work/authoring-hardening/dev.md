# Dev notes: authoring pipeline hardening

Unit `authoring-hardening`. Developer, 2026-11-16. PR #82 (`feat/authoring-hardening`), from main `1499a2d`. Implements `tech.md` in full; items 6.3 and 8 stay deferred as the plan says.

---

# 1. What changed

| Commit | Item | Change |
|---|---|---|
| `9ade9f7` A | 1, 2 | `lesson-prompter.ts`: `ReceivedReply`, `DraftReplyError`, `parseDraftReply`, `normalizeDraftReply`, `replyErrorMessage`. `draft.ts`: `.failed.json` save, skip, `--force` keeps `.failed.prev.json`, `--recheck` of `.failed.json` first, `summary.failed`, exit code 1 on a failure, `failed N` in the summary line |
| `39e6bcc` B | 4 | New `item-refs.ts` (`repointUndeclaredTargets`). `gateAndSave` order: repoint, typed-reading transform, validator, rules. A validator failure is a rejection with `structure:` errors. `publish.ts`: exported `publishRefusals` (validator plus course rules, before the transaction), `require.main` guard |
| `ef66d5e` C, `9e8d8b3` | 3, 5, 6.2 | `course-rules.ts`: `spellsOut`, `ENGLISH_LOOKALIKES` (34 words), the answer's rōmaji (shown and literal), `giveawayProblems` on the new matcher, `readingTeachProblems`, `selfAnsweringProblems`, `ONE_SOUND` with every small kana, `isFairTypedReading` self-answer clause. `foldedWords` deleted. I-Reading prompt line. H.2.e pin in `answer-romaji.spec` |
| `cf35ed2` D | 6.1 | `openChecksAllowed`, the gate error, the conditional prompt line, the real-outline spec |
| `f142305` E | 7 | `foundation-ja-beta.json` swap exactly as `content-review.md` §3 step 1 (`typedReading` placed last in the lesson, as in the other sound lessons). Spec positions updated. `typed-answers.ts` comment |
| `89722a5` | review | Code-review fixes (section 6) |

Order as merged: the swap `f142305` lands before the review fixes `89722a5` (Tester T4; tech.md §1.9 had planned the swap last). Nothing depends on the order.

No dependency, Prisma, API or mobile change.

---

# 2. Deviations from tech.md, and why

1. **`parseDraftReply(received, lesson)` takes the received record, not `(reply, lesson)`.** The record holds the JSON or the raw text plus model, tokens and `receivedAt`, so `--recheck` reads a saved `raw` and stamps the draft's meta from the original call. The `max_tokens` check stays in `generateDraft`: inside the parser, a saved cut-off could never be rechecked, because its stop reason never changes.
2. **A `--force` redraft that drafts or is rejected moves an older `.failed.json` aside** (to the first free `.failed.prev[.N].json`, after code review #2). The plan didn't say. Left in place, a later `--recheck` would pick the old failed reply first and put it over the new draft. Tested.
3. **An environmental error after the call** (disk, database during the gate) saves `.failed.json` with `stopReason: null`, because `generateDraft` keeps its return type and doesn't pass the stop reason out. Its reply is the parsed draft. Then the error is rethrown.
4. **Commit C is not green on its own.** `ef66d5e` left a duplicate `TYPED_READING_PROMPT` export: ts-jest doesn't typecheck, so its specs passed while `tsc` failed. Fixed in `9e8d8b3`. I didn't squash it, because a force-push is a history rewrite and that's on the stop list. Every other commit typechecks and tests green alone.
5. **Commit E touched two more specs than the plan named.** The swap moves ー to lesson 38 (`course-rules.spec`: "fails ー before lesson 38") and adds a seventh typed-reading lesson (`typed-reading.spec`: lessons 15 to 20 and 38, 35 targets, all accepted by the grader).
6. **Two existing assertions changed meaning, both by the plan's decisions:**
   - P5's `gakko` case is now an "allowed" test. F.2.g drops the collapsed-vowel form, and the grader marks `gakko` wrong, so mentioning it gives nothing away. `gakkoo` replaced it in the rejected list.
   - "does not check an open typed question" (lesson 43) now asserts no *particle* error. Lesson 43 can't have an open check at all under F.2.i, which is a separate error.
7. **Log label** `[course rules] REJECTED` is now `[gate] REJECTED`, because the list includes `structure:` errors. The wave driver's `why` filter matches `/reject/i`, so it still reads it.
8. **The repoint needs course context** (surfaces). Without it, the validator alone rejects the draft. `--recheck` still skips a lesson without context, as before: a course-rule rejection can't be rechecked without it.
9. **Code-review fixes refine F.2.f and F.2.c** (`89722a5`, section 6): a saved cut-off is refused on `--recheck` too; a non-open `grading` is never dropped in a lesson that allows open checks; a `--force` redraft after a failed reply is told the parse error.

---

# 3. Tests that fail on main and pass here

Run by checking out main's `lesson-prompter.ts`, `draft.ts`, `course-rules.ts`, `publish.ts` and outline JSON under the PR's specs (and removing `item-refs.ts`): 47 tests fail, plus `item-refs.spec` (no module) and `publish.spec` (main's `publish.ts` calls `process.exit` on import).

| Item | Fails on main |
|---|---|
| 1 | `draft.spec` "a paid reply that is not a draft": saved with tokens and cost, batch goes on; cut-off kept as text and counted; counts against `--max-cost`; skipped next run; `--force` keeps `.failed.prev.json`; redraft puts the old one aside; kept on an environmental error; `--recheck` recovers (no model call), reads before a rejected draft, reads hand-fixed text, keeps a still-failing reply. `lesson-prompter.spec` non-JSON throws `DraftReplyError` with raw and tokens |
| 2 | `lesson-prompter.spec`: `"closed"` dropped; `" Open "` is `"open"`; `"ai"` with a rubric keeps the reply; skeleton id, type, title, targets; cut-off as text |
| 3 | `course-rules.spec`: 7 English probes (I, do, so, are, made, man, fun) and lesson 67 pass; `no-to`, `na-ni`, `konnichiha`, `kip-pu`, `kin’you`, "tomodachi ha isha desu" caught; "ティ is tei" passes (F5); `gakko` allowed. Still caught on both (guards): `kippu`, `Kippu!`, `gakkō`, `ii`, `dō`, `dou`, `nōto`, `okāsan`. H.2.e pin passes on main, as the plan says |
| 4 | `draft.spec` repointed / rejected with `structure:`; `item-refs.spec`; `publish.spec` |
| 5 | `course-rules.spec` pre-edit lesson 13 pattern (text `na-ni`, example reading `yama`); `lesson-prompter.spec` I-Reading line. Guards: lesson 4's worked あさ, the same Teach in F-Vocab |
| 6.1 | `course-rules.spec` lesson 47 open check; `outline-compiler.spec` only `ch17-l07`; `lesson-prompter.spec` no open line in 37, 47, 75 |
| 6.2 | `course-rules.spec` "reads 'ka'" and "konnichiwa in kana"; `typed-reading.spec` F4 rewrite. Guard: lesson 67 q8 "zero" passes |
| 7 | `outline-compiler.spec` 7 typed-reading lessons and the 38/39 entries and stage; `course-rules.spec` ー at 38; `typed-reading.spec` seven lessons |

---

# 4. Acceptance check 1 (tech.md section 4)

**How.** A throwaway script in the scratchpad, not committed, run from the worktree with `TS_NODE_PROJECT=apps/api/tsconfig.json node -r ts-node/register`. It read, never wrote, all 101 files in the main checkout: `tools/authoring/output/*.json` (62 drafts), `*.rejected.json` (2) and `published/*.json` (37). Main's `skeleton.json`, and for `ch07-l06.json` and `ch07-l07.json` a swapped copy (commit E's edit applied to the skeleton), each draft gated under its post-rename id. It ran the PR's `validateStructure` and `checkCourseRules`, and main's `checkCourseRules` for the diff.

**The validator's items.** All 241 declared target ids were looked up on Neon branch `test-78-check-explanation` (`br-red-forest-baxm7pzr`) with one read-only `SELECT id, type FROM "Item" WHERE id IN (...)`: 241 of 241 exist, each with the type of its id's kind. The script's fake `prisma.item.findMany` returns those rows. No connection string was handled and nothing touched the live branch.

**Result.**

| File | Main | This PR |
|---|---|---|
| `output/ch08-l07.json` (lesson 47, wave 2) | 0 | **NEW** `check q4: an open check is only allowed where the outline's author note asks for one` |
| `output/ch12-l04.json` (lesson 75, wave 2) | 0 | **NEW** same, q4 |
| `output/ch11-l03.rejected.json` (lesson 67) | `check q7 ... spells out "zero"` | **0: passes** |
| `output/ch12-l05.rejected.json` (lesson 76) | 2 kanji 木 errors | the same 2 |
| `output/ch04-l06.json` and `published/ch04-l06.json` (lesson 20, 22b) | 3 particle errors | **the same 3** (see below) |
| the other 95 files, including ch07-l06 and ch07-l07 swapped | 0 | 0 |

- Exactly the expected new errors (47 q4, 75 q4). Lesson 67 is recoverable with `--recheck`. 0 structural errors anywhere. No new rule hits approved or published content.
- **For the Lead and PM: the gate as a whole does not pass on lesson 20.** Its published file and its output copy both break the F.2.d particle rule: `と` and `の` in "ともだち と がっこう" and "おかあさん の しゃしん" (teach[0] and check q5). This is identical on `main` and is not from this PR, but it means `authoring:publish foundation-ja-ch04-l06` is refused today, and the brief's "gate passes on every lesson approved or published" isn't literally true. A republish of lesson 20 needs a PM edit or a ruling. I didn't change anything for it.

**The real CLI, $0.** In the worktree's own gitignored `tools/authoring/output/`, with copies of main's `skeleton.json` and lesson 67's rejected file, and the main `.env` (the validator's one `findMany` read the live database; nothing was written):
- `authoring:draft foundation-ja-ch11-l03 --recheck`: `[validator] pass`, saved as a draft, "rechecked 1 … ~$0.0000".
- That draft turned into a wave-2-style `.failed.json` (`grading: "closed"` on q1): a plain run printed "skipping … .failed.json exists" and made no call; `--recheck` then saved it as a draft with no `grading` and the saved call's meta. The copies were deleted afterwards.

**Acceptance check 2.** `pnpm typecheck && pnpm lint && pnpm test` green on `f142305` (API 1434 tests, 61 suites). `/code-review high` on PR #82: section 6.

---

# 5. For the Tester to look at hard

- `spellsOut` normalisation: hyphen readings when a text mixes both kinds in one multi-word answer (only one reading per text is tried), `ou` → `oo` on English text, apostrophes in English words.
- `ENGLISH_LOOKALIKES` is checked on the answer's rōmaji as spelled (`tou` is not `too`).
- The `.failed.json` lifecycle across plain run, `--force` (fails, drafts, rejects) and `--recheck` (recovers, rejects, still fails, environmental error).
- `publishRefusals` now needs the database before the transaction. `publish.ts` has a `require.main` guard, so `pnpm authoring:publish` still runs `main()` (it's run as the script).
- The swap diff is the only data change; `outline-compiler.spec` "passes every rule" covers the reordered outline.

---

# 6. Code review (`/code-review high`, PR #82)

10 findings. Fixed in `89722a5` (5), justified (5). Full verification and the acceptance scan rerun green on `89722a5`: API 1438 tests, same scan result as section 4.

| # | Finding | Verdict |
|---|---|---|
| 1 | `spellsOut` misses `sayonara` for さようなら and `tokyo` for とうきょう (also `arigato`, `kohi`, `gakko`) | **Justified, by design.** F.2.g dropped the collapsed-vowel form on spike evidence: it flagged `mango`, the meaning of マンゴー, in the PM's approved café menu, and its only extra catches were spellings the grader marks wrong (H.2.e: `arigato-`, `gakko-` stay wrong). A learner copying `sayonara` is marked wrong, so it isn't a give-away of a typeable answer. Re-opening it is the Tech Lead's call, with the `mango` cost |
| 2 | `.failed.prev.json` is overwritten on a third failure, against "a paid reply is never overwritten" | **Fixed.** Older failed replies go to the first free `.failed.prev[.N].json`. Test: "never overwrites an older failed reply, however many there are" |
| 3 | `--recheck` of a saved cut-off reply could accept an earlier whole object in the text | **Fixed.** `parseDraftReply` refuses `raw` whose `stopReason` is `max_tokens`, as the fresh path does; a hand fix goes in `reply`. Test: "still refuses text cut off at max_tokens" |
| 4 | A rechecked failed reply that is rejected overwrites an older `.rejected.json` | **Justified.** It's the newer paid attempt, and a `--force` redraft that is rejected has always replaced the older rejected draft (F.2.a). This PR doesn't make that worse; before it, the reply was lost outright. Keeping `.rejected.prev.json` would change F.2.a for every rejection: listed in section 7 |
| 5 | Dropping a non-open `grading` with no rubric could make lesson 120's open check exact-match | **Fixed.** Not dropped where the note allows open checks, so it's a `.failed.json` for a human, at $0. Test: "keeps a non-open grading where the outline allows open checks" |
| 6 | `isFairTypedReading` keeps the old `looseRomaji` substring test (いい → `i`) | **Justified.** tech.md 1.7 says "also requires". The old clause is what catches F6's `(oka asan)` with a space, pinned by an existing spec. It only runs on typed-reading lessons, after the transform, and its cost is a prompt rewritten to the PM's standard wording, never a rejection of fair content. The PR summary's "one matcher for every give-away rule" refers to P5, I-Reading Teach and self-answer |
| 7 | A `--force` redraft after a failed reply isn't told why it failed, and gets stale rejection reasons | **Fixed.** A `.failed.json` is always the newest attempt (a later draft or rejection moves it aside), so its error is sent instead. Test: "--force tells the redraft why the failed reply could not be read" |
| 8 | Open-check permission is a substring of free-text note prose | **Justified.** F.2.i chose this over an outline flag to keep the swap diff clean, and `outline-compiler.spec` pins that exactly lesson 120 allows it, so a reworded note fails CI |
| 9 | `readingTeachProblems` de-duplicates twice; rōmaji forms recomputed per rule | **Fixed** the double de-duplication. Recomputation kept: one gate run per draft over about 20 checks, and caching would add state for no measurable gain |
| 10 | `keepPrevious` duplicates `gateAndSave`'s `.json` → `.prev.json` rename | **Moot after #2.** The failed-reply helper now never overwrites, while the draft's single `.prev.json` slot is F.2.a's behaviour, which this unit doesn't change. Two different semantics, so two helpers |

---

# 7. For the Project Manager (outside this plan)

- Lesson 20's particle errors (section 4).
- Lesson 67 q8 answers itself by design (`zero`), as tech.md section 5 says.
- For the Tech Lead: keep `.rejected.prev.json` (and numbered `.prev.json` for drafts) so no paid draft is ever replaced by a newer attempt (code review #4). Outside this unit.
