# Test: PR #74, typed reading, `--recheck`, particle gate, N6

Unit `22b-sample-lessons`. Tester, 2026-11-14. Round 1.

## Verdict: FAIL on `b16f481`

- **Commit:** `b16f48189c9adc4e62f491b1afb019c4d3a46a7a` (head of `fix/22b-typed-reading`, PR #74). Checked out detached in `.claude/worktrees/test-74`.
- **Why FAIL:** one High finding is neither fixed nor justified. **F1:** Rule A rejects correct kana and sound lessons, and those are the next lessons 22c pays to draft. The `tech.md` 1.2 premise that "kana and sound lessons need no exemption" is false on realistic content. F2 and F3 are Low but real, and are cheap to fix in the same round.
- **What passes:** everything else. Lesson 19 is recovered at $0 with clean reading prompts (P4). The four served lessons are unchanged apart from N6 and lesson 20's republish refusal. N6 only ever turns wrong into right when punctuation is the only difference. Verification and CI are green.

---

## Evidence

| What | Command or method | Result |
|---|---|---|
| Full verification, uncached | `pnpm typecheck --force && pnpm lint --force && pnpm test --force` in `test-74` | All green. Typecheck 4/4, lint 1/1, test 2/2, **0 cached**. 57 suites, 1045 tests. The `ERROR` lines in the log are deliberate "db down" test cases |
| CI | `gh pr view 74`, `gh run view 43632429419` | `verify` SUCCESS, run on head sha `b16f481` (pull_request event) |
| Code review | `/code-review high` on PR #74 | 10 findings. Each one was checked here before being reported (see Findings) |
| Gate and transform on real drafts | `harness-real.ts`: the PR's own `checkCourseRules` and `addTypedReadingChecks`, real `skeleton.json`, **scratchpad copies** | 2, 21, 43: 0 errors, transform makes no change. 20: 3 errors (`teach[0]` と, `teach[0]` の, `check q5` の), transform makes no change. 19 rejected: 5 errors → transform rewrites q2, q4, q6, q8, q10 → 0 errors, idempotent, still 10 questions. `output/` and `published/` copies byte-identical |
| Gate on the PM's pre-edit originals | Same harness, `original_draft` from `corrections.jsonl` | 2: clean. 20: と, の. 43: か in `teach[7]`, か and を in q1, か in q2. Catches every untaught-particle finding in `content-review.md` |
| Rule A on realistic kana content | `harness-kana.ts`: lessons 3 to 18, built on lesson 2's real structure, real context | See F1 |
| Real `--recheck` | `authoring:draft foundation-ja-ch04 --recheck` from a scratchpad sandbox, all API keys blank, live DB read-only (only the validator's `item.findMany`) | `drafted 0, rechecked 1, skipped 5, rejected 0, ~$0.0000`, exit 0. Saved draft differs from the rejected one only in the 5 prompts and the dropped `courseRuleErrors` |
| Recheck that still fails | Lesson 20 copy written as `ch04-l06.rejected.json`, then `--recheck` | Rejected file rewritten with the 3 current errors. `ch04-l06.json` checksum unchanged. Exit 1 |
| `--recheck --force` | Same sandbox | Refused: "--recheck makes no model call and --force pays for a redraft: pick one." Exit 1 |
| Malformed rejected file | Truncated `ch04-l01.rejected.json`, then chapter `--recheck` | JSON error at l01. The run aborts and l05 is never rechecked (F4) |
| Publish gate | `authoring:publish <id>` from the sandbox with `DATABASE_URL` at `127.0.0.1:1` | l06: "Refusing to publish … と … の … の", before any connection. l02, l21, l43: pass the gate, then "Can't reach database server at 127.0.0.1:1". No write was possible |
| Served lessons vs files | `harness-live.ts`, read-only Prisma `findUnique` | All 4 live lessons match `published/*.json` check by check (prompt, target, answer). Rows last updated 18:52, before this PR. Live TYPED checks: lesson 20 ×5, lesson 43 ×1. Lesson 19 not live |
| Grader, PR against `main` | `harness-grade.ts`: both `WritingEvalService`s, kuromoji loaded on both | 175 cases, 29 changed verdicts, **all wrong → right, all differing only by punctuation**. No right → wrong. Every wrong variant (`gakko`, `gakou`, `okasan`, `choto`, `kipu`, `zashi`, `わ。` for は, `wa` for は。) stays wrong |
| Originals untouched | `shasum -a 256` of all 15 files in `tools/authoring/output` and `published`, before and after | Identical |

Scripts and outputs are in the session scratchpad (`harness-*.ts`, `harness-*.out`). No paid model call, no Neon branch, no live write, no secret printed.

---

## The Lead's three questions

1. **Does Rule A reject correct kana lessons?** Yes. See F1. This is a finding.
2. **Do lessons 2, 20, 21 and 43 still work as served?** Yes. No serving code, mobile code or data changed, and the live rows match the files exactly. Two behaviour changes reach them, both intended:
   - **N6:** lesson 20's 5 typed checks and lesson 43's q4 now accept a kana answer with 。 (for example `ともだちはいしゃです。`). Rōmaji was already punctuation-blind. Lessons 2 and 21 are all multiple-choice, graded by the untouched ASCII `exactMatch`, so nothing changes for them.
   - **Lesson 20 republish is refused** on と, の, の. Lessons 2, 21 and 43 still pass the gate at publish.
3. **Do lesson 19's rewritten prompts meet P4 without leaking rōmaji?** Yes. All 5 read `Read this word and type how it sounds: <kana>`, with no Latin letters beyond the fixed wording. The check screen shows only `check.prompt` and an input box (`LessonPlayer.tsx:318`), and `explanation` is never shown. `gakkou`, `kippu`, `zasshi` (and `zassi`, `issho`, `chotto`) are accepted. Missing the long vowel or the っ is rejected. Two notes for the PM's lesson 19 review, which aren't code findings:
   - `teach[3]` says "say 'ga', pause, then 'kkou'", and `teach[9]` says "'gakou'". The Teach beat spells out one target's reading in rōmaji, against the author note ("write the sound in rōmaji only in the cards"). The check is still fair.
   - `gakkō` (with a macron) is rejected, before and after this PR.

---

## Promises (`tech.md` section 4)

| Promise | Status | How checked |
|---|---|---|
| **P4** small っ: type がっこう, きっぷ, ざっし with no rōmaji shown, and be accepted | **Kept in code**, pending PM review and the Alpha run | Real `--recheck` saves lesson 19 at $0. Prompts carry no rōmaji. Grader accepts all 5 readings. `typed-reading.spec.ts` covers the in-place rewrite, idempotence and the rōmaji of all 30 targets |
| **P5** reading lesson: type the sounds, no hint | **Kept** | Lesson 20's 5 fair checks are left alone by the transform. The grader accepts their rōmaji and rejects the near-misses |
| **P2** "finish each one using only what it shows me": no untaught particle | **Kept for grammar and reading drafts, broken for kana drafts** | Catches every case in lessons 20 and 43. Falsely rejects lessons 4 to 16 (F1), which costs P2 nothing directly but blocks or degrades the drafts behind it |
| **P7** A は B です: no unexplained Japanese, "wa" accepted, kana with 。 accepted | **Kept** | Lesson 43 is clean under Rules A and B, and its originals are caught. `ともだちはいしゃです。` is now accepted |
| P1, P3, P6, P8, P9, P10 | Not touched | Kanji rules unchanged. Recall `reading` grading shares the N6 change, so it helps P8 |

**`tech.md` test plan.** Every case in Tasks 1 to 5 exists by name in the specs, and the Task 3 accept and reject lists match the plan exactly. Task 6's README is updated. It describes the passing cases accurately but not the failing kana-row case (F1).

---

## Findings

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| F1 | **High** | `course-rules.ts:244-267` (Rule A), called at `:330` | A lesson's own target kana, written next to an example word, counts as an untaught particle. **(a) Lesson 2's real shape** is rejected in lessons 5, 6, 8, 9 and 10: a passage that chants the row and then reads words, which the F-Kana correction now pushes the drafter towards ("Spaces go between words, never between the kana of one word…"). `た ち つ て と そと くつ` (と), `な に ぬ ね の ねこ いぬ` (の), `ま み む め も もも あめ` (も), `や ゆ よ やま ゆき` (よ). **(b) Common phrasings** are rejected in **13 of the 16 exposed lessons** (4 to 10 and 12 to 16): `と: そと (outside)`, `Words with ね: ね, ねこ`, `In はな, は says ha.`, `かさ (か + さ)`, `Two small marks turn か into が: かぎ`, `で: でんわ`. Only "as in", "→" and "—" survive. **Why High:** `--recheck` can't cure it without a rule change. The `--force` redraft is then told `uses the particle と before it is taught. Fix every one.` in a lesson whose TARGET ITEMS include `ja:kana:to(と)` (checked with `buildDraftPrompt`). So the cheapest "fix" for the model is to drop its own target kana from the Japanese. Katakana rows and lessons 3, 11, 17 and 18 are unaffected | **Open.** For the Tech Lead: the Developer's option, exempting Rule A where `hasKanaTargets`, leaves 15 and 16 exposed (が and で are kana cards there, not targets). It also drops coverage from I-Reading 4, 8 and 13, where the PM expects real particle use (`はな と ひと` is correctly rejected today). A narrower option: skip a lone token that is this lesson's own target kana or card char in F-Kana, I-Writing and sound lessons, and keep I-Reading strict. Either way the reproduction below must pass |
| F2 | Low | `typed-reading.ts:39,59` with `draft.ts:173` | The transform appends a check for every `ctx.targets` entry, even one the draft left out of `targetItemIds`. `main`'s gate rejected such a draft ("needs a typed check showing しゃしん"). The PR saves it, because a validator failure only warns (`check "q11" references undeclared targetItemId`), and publish never validates. Published, it would have a Check on a word with no LessonItem. Shown on a lesson 20 copy with 写真 dropped. Rare: the model has to drop a target | Open. Append only for declared targets, or let a validator failure reject |
| F3 | Low | `course-rules.ts:287`, `typed-reading.ts:52` | A fair reading check whose `correctAnswer` has trailing punctuation (`がっこう。`) is neither fair nor a recall match, so a second identical reading check is appended. Shown: 2 checks on がっこう, both "Read this word and type how it sounds: がっこう". Introduced by deviation 9 (fair now requires answer == surface) | Open. Compare with `bare()` rather than `spaceless()` |
| F4 | Low | `draft.ts:138-155` | One malformed `<id>.rejected.json` throws out of `runDrafts`, and the rest of the chapter isn't rechecked. The message names neither the file nor the lesson; only the preceding log line does | **Justified** (`dev.md`: deliberate, no suppressed errors). On `--recheck` it costs $0. Naming the file in the error would help |
| F5 | Low | `draft.ts:196` | `--recheck` promotes a passing rejected redraft over an existing `<id>.json` (moved to `.prev.json`), and deletes the critique | **Justified** (`tech.md` 1.1: "a pass is written exactly as a fresh pass is"; `dev.md` #6). Approved content lives in `published/`, which no draft command touches |

### Observations (not blocking, for the owners named)

- **Tech Lead:** the first-draft prompt never lists the untaught particles (`courseContextBlock`, `lesson-prompter.ts:135-173`). The gate now enforces them, so each particle rejection costs a paid redraft that one free prompt line could prevent. Worth adding before 22c.
- **Tech Lead:** a model-written check with partial rōmaji is judged fair and kept by step 1: `How does がっこう sound? (ga + kkou)`, `starts "gak-" and ends "-kou"`. This was already in the old heuristic, and it isn't the case for lesson 19. Treating any Latin text beyond the fixed wording as unfair would close it, because step 2 would then rewrite such prompts.
- **Tech Lead:** Rule A misses particles next to kanji words (`日本 から` in an F-Kanji lesson). This gap is not in the `tech.md` list. PM review is the backstop.
- **PM:** N6's set is exactly H.2.c's. `，` (full-width comma), `・`, `…` and `〜` still make a kana answer wrong. The standard iOS kana keyboard types `、` and `。`, which are covered.
- **Lead:** `ops/work/22b-sample-lessons/` is untracked on `main`, so the PR's pointers to `dev.md` and `tech.md` don't resolve for anyone else. Publish it with `sync-state.sh`.

---

## Reproduction for F1 (Developer)

This is a temporary spec built on `course-rules.spec.ts`'s own fixtures (`errors`, `ctxAt`). On `b16f481`, **9 of 9 fail**, each with the particle error shown. All of them must pass after the fix, and the existing reject list (`ともだち と がっこう` at 20, `はな と ひと` if I-Reading stays strict) must still reject.

```ts
const onlyParticles = (errs: string[]) => errs.filter((e) => e.includes('the particle'));
it.each([
  ['た ち つ て と そと くつ', 5],      // lesson 2's passage shape: the row, then words
  ['な に ぬ ね の ねこ いぬ', 6],
  ['ま み む め も もも あめ', 9],
  ['や ゆ よ やま ゆき', 10],
  ['と: そと (outside)', 5],
  ['In はな, は says ha.', 7],
  ['かさ (か + さ)', 4],
  ['Two small marks turn か into が: かぎ (key)', 15],
  ['で: でんわ (phone)', 16],
])('accepts kana-lesson content %s at lesson %i', (text, n) => {
  expect(onlyParticles(errors(text, n))).toEqual([]);
});
```

F2: a lesson 20 copy with `ja:vocab:写真` removed from `targetItemIds` and its checks dropped. On `main` `checkCourseRules` gives 1 error, and on the PR the transform plus the gate give 0. F3: lesson 19's rejected draft with q2 set to the reading prompt and `correctAnswer: 'がっこう。'`, so the transform returns 2 typed checks on 学校.

---

## Not verified

- **Real model output for lessons 3 to 18.** No paid calls were allowed. F1 rests on lesson 2's real structure and on phrasings built by hand, not on new drafts. The rejection mechanism is certain. The rate per real draft is an estimate.
- **The app on the simulator.** There is no mobile change. Served behaviour was checked at the data and grader level, not by tapping through.
- **Live republish.** Publish was run only against an unreachable DB, so the gate is proven, not the write. The write path is unchanged by this PR.
