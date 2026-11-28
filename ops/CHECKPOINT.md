# Checkpoint

Last updated: 2026-11-28 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)) into the app: 120 lessons in 17 chapters (M.1.a), each drafted, gated, critiqued, PM-reviewed and published. Then a learner runs it end to end (Alpha).

## State

- **108 of 120 lessons are live** (17 chapters, 874 checks): every lesson except the 12 audio lessons, which wait for Azure (Blocker 2).
  - Waves 1 to 3 were reviewed by the PM (`ops/work/22c-full-batch/content-review*.md`).
  - Lesson 120, the one open check, went live 2026-11-23 on the PM's ruling (`open-check-followup/triage.md`).
- Units merged since 2026-11-16, each with a Tester PASS on its last commit:
  - #82 `authoring-hardening`;
  - #91 `open-check-followup`: the grader's comment, an honest "couldn't grade" on lesson checks, the multiline answer box;
  - #95 `authoring-polish`: multiple-choice options are shuffled per request, 校 shows "school", verb kanji are asked as whole words, kana-only readings are shown once, and four draft-gate rules are added.
- **Live kanji apply done 2026-11-23:** 9 rows. The backup is `ops/work/authoring-polish/kanji-rows-before.json`, and rollback is in the journal.
- Decisions this stretch: F.1.c, F.1.d, F.2.f to F.2.k, B.2.c to B.2.f, G.4.f, G.4.g.

## Next actions

1. **Unit B5, "couldn't grade" in reviews and practice** (`open-check-followup/triage.md` I2). Today a grading fallback there shows "Not quite — the expected answer was…" next to "Couldn't grade". On the free Gemini tier, about 1 call in 4 falls back, so the Alpha walker will hit it. **Brief done** (`ops/work/grading-fallback-honesty/brief.md`, P1 to P6, chapter tests included). **`tech.md` done (G2, B.2.g)**, with no schema change. **PR #99 merged** (`4a2d305`, Tester PASS on `f96236d`). Ungraded answers in reviews, practice, chapter tests and skip-tests are now shown and counted honestly. Do it before Alpha.
2. **Unit: age confirmation at sign-up** (M.5, beta is 18+). Before any real learner. **Brief done** (`ops/work/age-confirmation/brief.md`, P1 to P6, decision M.5.a). Founder items are Blockers 12 and 13. **`tech.md` done (G2, M.5.b)**. The migration is additive (an enum and two nullable columns on `User`). The Lead created Neon branch `test-age-confirmation` (`br-red-mud-batele3k`) on 2026-11-24. **Developer stopped mid-task** when a session ended. Its work is on `feat/age-confirmation`: `2ef2b5f` (the additive migration and types) and `938b61e` (the AgeGuard and route), both pushed, plus `9aa0ed2`, a WIP integration spec saved at handoff that may not pass. There is no PR yet. **Next: start a fresh Developer** on the same branch, pointed at `dev.md` (if present) and that commit, to finish, open the PR and run the code review. Paused 2026-11-27 for the founder’s device-handoff request. Testing may also reuse `br-winter-poetry-baq6sbs4`. P6 (sign-out) is proven end to end only by Blocker 7. **Lead ruling:** Alpha accepts the Tester’s branch evidence for P5 (an existing learner), because live has no dev learner with progress. Runs after grading-fallback-honesty.
3. **Alpha run (G4)** for the live course. It is blocked on **Blocker 10**: a session that can tap and type in the simulator.
   - Device `Sensei 22a SE3` (UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`) has Expo Go.
   - Start with `expo start --offline`, then `open_url exp://127.0.0.1:8081`.
   - Use a fresh learner and dev-stub auth.
4. **Audio lessons (12)** once Azure exists (Blocker 2). Drafting is about $1. Use `run-wave.mjs <from> <to> <cap> --include-audio`.
5. **B1** (lesson 120's rubric: the name pattern and one fix) needs a clean grader eval. That is realistic only after Gemini billing (Blocker 9), and it must land before any real learner.

## Devices (2026-11-27)

- The work moves between the OMV server (default), the Mac (needed for the simulator) and Windows. See `ops/DEVICES.md`.
- Secrets, Claude transcripts and memory, drafts, datasets and `~/.claude` config travel through the private store `amshahed/sensei-private`, using `node ops/bin/state.mjs push|pull|status`.
- Leave a device with `bash ops/bin/handoff.sh`. Arrive with `bash ops/bin/setup-device.sh`.
- **Sessions now run on the server** (`~/workspace/sensei` on `turingMachine`, tmux session `sensei`, Remote Control name "sensei").
- The server is Linux. It can't run the iOS simulator, and Chrome isn't installed. Everything else works there: tests, the API, authoring, Neon and `expo export`.
- A Tester that needs on-screen evidence (`xcrun simctl` screenshots), and the Alpha run, must run on the Mac. Hand off with `handoff.sh` on the server, then `setup-device.sh` on the Mac, and back afterwards.
- The Mac's old worktrees are not on the server. `feat/age-confirmation` is pushed (`9aa0ed2`), so create a fresh worktree from it on the server.

## In flight

| What | Where | State |
|---|---|---|
| Old worktrees | `.claude/worktrees/wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66` to `test-78`, `authoring-hardening` | Merged work; safe to clean up |
| Throwaway Neon branches | `test-78-check-explanation` (`br-red-forest-baxm7pzr`), `test-open-check-followup` (`br-winter-poetry-baq6sbs4`), `test-age-confirmation` (`br-red-mud-batele3k`) | Deleting needs the founder's yes (Blocker 11) |

## PM backlog

- From `grading-fallback-honesty/test.md`:
  - **F1:** model comments repeat the verdict, and on a miss the answer too (“That’s incorrect — いしゃ means doctor.”). That is the grading prompt, so bundle it with B1’s eval.
  - **F2:** the end screen keeps 🎉 when nothing counted.
  - **F3:** with the grader down, one meaning such as “hello” is “couldn’t grade”, because the stored answer holds several meanings.

- From `open-check-followup/triage.md`:
  - B3: the eval's pair rule (F3).
  - B4: Android keyboard behaviour, before any Android build.
- From `authoring-polish/test.md`, Low: gate gaps F1 ("spelled in hiragana"), F2 (a katakana-description prompt refused) and F3 (an English note in a reading line refused). None hits today's drafts.
- Untaught-word warning for the drafter: its own unit, before the audio wave (`authoring-polish/brief.md`).
- Placement still asks for 食's reading with く(う) as the answer (Tech Lead flag, outside authoring-polish).
- Lesson 20 is live, but publish refuses to republish it until its passage drops と and の.
- Lesson 39 doesn't require typed reading; one outline flag turns it on. Lesson 67 q8 (typed ゼロ) passes by design.
- Tester T2 (low): a self-answering prompt with an English-lookalike answer isn't caught.
- Exact-match before calling the grading model would cut most calls. A rare 12-second timeout marks a right paraphrase wrong. A writing answer of about 6,000 characters causes a 500. Exact kana that differs only in punctuation is marked wrong.
- Watch `arigato` at Alpha: long vowels are taught, so it stays wrong (H.2.a).

## Live facts

- Anthropic credit: **about $10 left**. The rest of the course (12 audio lessons, a few redrafts) is about $2.
- Neon default branch: migrations through `20261104230000_reminders`. 108 lessons (874 checks), 1 user, 1,625 items.
- `skeleton.json` is gitignored. Rebuild it with `authoring:outline --force` only when the outline spec changes, then diff it against a backup.
- Drafts, critiques, `.failed.json` and `.prev.json` files live in the main checkout's `tools/authoring/output/`. Approved lessons live in `tools/authoring/published/`. Both are gitignored, so don't delete them.
- Testers can't tap the simulator here. They use a throwaway harness plus `xcrun simctl io screenshot` (`open-check-followup/test.md`). The Alpha User can't work that way.
- Agent usage is heavy and has hit the founder's 5-hour limit several times. Run one agent at a time and scope re-tests to the diff.
