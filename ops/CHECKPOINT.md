# Checkpoint

Last updated: 2026-11-23 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)) into the app: 120 lessons in 17 chapters (M.1.a), each drafted, gated, critiqued, PM-reviewed and published. Then a learner runs it end to end (Alpha).

## State

- Merged on 2026-11-16:
  - **#82 authoring-hardening** (`eb65428`). Tester PASS on `89722a5`. Paid replies are never lost, the new gate rules are in, and lessons 38 and 39 are swapped.
  - **#83 README** (`5bccb2c`). Docs only; fixes Tester finding T1.
- Lead post-merge steps are done:
  - Outline rebuilt. The diff was exactly the two ch07 lessons and one sound stage.
  - Drafts renamed. Lessons 38 to 40 published, so **40 lessons are live**.
  - Lesson 67 rechecked at $0.
  - `run-wave.mjs` now skips `.failed.json` and logs `PARSE-FAILED`.
- **Wave 2 (41 to 77) is done.** The PM approved all 30 non-audio lessons after hand edits (`content-review-wave2.md`), and the Lead published them, so **70 lessons are live**. Ruling F.2.j: no exemption for kanji components, and every target kanji gets a reading in kana. Its 4 correction notes are merged (PR #85).
- **Wave 3 (78 to 120, no audio) is done.** It was drafted for $2.62; 99 and 120 were recovered from `.failed.json` at $0. The PM approved 37, with all six gate rejects fixed by hand (`content-review-wave3.md`), and the Lead published them. **107 lessons are live in 17 chapters (857 checks).** That is every lesson except the 12 audio lessons and 120.
- **Lesson 120 is approved but held.** It has the course's one open check. F.2.i and the `check-explanation` brief section 5 bar publishing it until the open-check follow-up unit lands. Its draft is ready in `tools/authoring/output/`.
- Ruling F.1.d: ます stays before を. The 4 wave 3 correction notes are in PR #87.
- The 12 audio lessons aren't drafted. They wait for Azure (Blocker 2).

## Next actions

1. **Briefs done (G1)**, written 2026-11-22: `ops/work/open-check-followup/brief.md` (8 promises) and `ops/work/authoring-polish/brief.md` (7 promises, learner-facing P1 to P3 first). Decisions B.2.c and G.4.f. The PM added a pass rule to lesson 120’s rubric in its local draft (gitignored), and publish rechecks it. **Both `tech.md` files are done (G2)**, with decisions B.2.d, G.4.g and F.2.k. Lead ruling: the 校 live update is routine (authoring-polish tech.md 3.1). The Lead approved lesson 120 locally (`published/`) and created Neon branch `test-open-check-followup` (`br-winter-poetry-baq6sbs4`) for the Developer and Tester; delete it after merge. **PR #91 open-check-followup merged** (`cdc424b`). **Lesson 120 is published, so 108 lessons are live.** That is every lesson except the 12 audio ones. The PM ruled in `open-check-followup/triage.md`, accepting F1, F2 and F5 for closed beta. The PM also added **P8 to `authoring-polish/brief.md`**: multiple-choice options are shuffled (Tester F4, decision B.2.e). `authoring-polish/tech.md` is amended for P8 (G2 met, decision B.2.f): a per-request shuffle in `mapCheck`, as commit T0, then T1 to T6. **Developer implementing authoring-polish now**, using the throwaway branch `test-open-check-followup`. After merge, the Lead runs tech.md 3.3, the kanji supplement import on live, with the backup taken first.
2. Tech Lead, Developer, Tester for `open-check-followup`, then the Lead publishes 120 with `EDITOR=true pnpm --filter api authoring:review foundation-ja-ch17-l07`, then `authoring:publish`.
3. The same chain for `authoring-polish`. It must land before the audio wave and Alpha.
4. Alpha run for the 22b and 22c lessons, in a session with the iOS simulator tool:
   - Device `Sensei 22a SE3` (UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`) has Expo Go.
   - Use `expo start --offline`, then `open_url exp://127.0.0.1:8081`.
   - A fresh learner is needed.

## In flight

| What | Where | State |
|---|---|---|
| Old worktrees | `.claude/worktrees/wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66` to `test-78`, `authoring-hardening` | Merged work; safe to clean up |
| Throwaway Neon branches | `test-78-check-explanation` (`br-red-forest-baxm7pzr`); `test-open-check-followup` (`br-winter-poetry-baq6sbs4`) | Ask the founder before deleting the first; the second is deleted after its unit merges |

## PM backlog

- From `open-check-followup/triage.md`:
  - **B1:** lesson 120’s rubric gets the name pattern and a one-fix line (already written). Apply it after a clean eval, before any real learner.
  - **B3:** the eval’s pair rule (F3).
  - **B4:** Android keyboard behaviour (I1), before any Android build.
  - **B5:** a new unit, after `authoring-polish`, for an honest “couldn’t grade” in reviews and practice (I2).
  - B2 is now part of Blocker 6.

- Age confirmation at sign-up is needed before any real learner (M.5, beta is 18+). New small unit.
- Lesson 20 is live, but publish refuses to republish it until its passage drops と and の (particle gate).
- Lesson 39 doesn't require typed reading; one outline flag turns it on.
- Lesson 67 q8 (typed ゼロ, Teach says "zero") passes the gate by design. Convert it to a reading check if wanted (tech.md section 5).
- Tech Lead: four particle cases still pass the gate (22b `test.md` N1, N2). PM review is the backstop.
- Tester T2 (low): a self-answering prompt with an English-lookalike answer ("reads 'a'") isn't caught.
- Exact-match before calling the grading model would cut most calls.
- Grading: a rare 12-second timeout marks a right paraphrase wrong. Writing: an answer of about 6,000 characters causes a 500. Exact kana differing only by punctuation is marked wrong.
- Watch `arigato` at Alpha: long vowels are taught, so it stays wrong (H.2.a).

## Live facts

- Anthropic credit: **about $10 left**. 22c has spent about $8.7 so far, including lost and redrafted drafts. Measured cost per lesson, draft plus critique: $0.05 to $0.09.
- Neon default branch: migrations through `20261104230000_reminders`. 108 lessons (874 checks), 1 user, 1,625 items.
- `skeleton.json` is gitignored and was rebuilt on 2026-11-16 after the swap. Rebuild it with `authoring:outline --force` only when the outline spec changes, then diff it against a backup.
- Drafts, critiques, `.failed.json` and `.prev.json` files live in the main checkout's `tools/authoring/output/`. Approved lessons live in `tools/authoring/published/`. Both are gitignored, so don't delete them.
- Agent usage is heavy and has hit the founder's 5-hour limit several times. Run one agent at a time and scope re-tests to the diff.
