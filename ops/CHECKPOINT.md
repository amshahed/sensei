# Checkpoint

Last updated: 2026-11-28 by the Lead (server session).

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

1. **Unit age confirmation at sign-up** (M.5, beta is 18+). Before any real learner. Brief and `tech.md` done (M.5.a, M.5.b). Founder items are Blockers 12 and 13.
   - Branch `feat/age-confirmation` (`9aa0ed2`, pushed): the migration, types, AgeGuard, `POST /onboarding/age` and the integration spec. The Lead ran the API specs on the server on 2026-11-28: all green, so the "WIP" spec passes.
   - Server worktree: `.claude/worktrees/age-confirmation`, installed and generated.
   - **Developer started 2026-11-28** to finish T4 (the app), T5, T6, `dev.md` and the PR. No PR yet.
   - **Lead ruling on T5:** the server can't run the simulator. The Developer smokes the API on `br-winter-poetry-baq6sbs4` and runs `expo export`. The SE screenshot moves to the Tester's simulator work, which runs on the Mac.
   - Then the Tester (on the Mac, for P1 to P6 on the simulator) runs on `test-age-confirmation` (`br-red-mud-batele3k`).
   - **Lead ruling:** Alpha accepts the Tester's branch evidence for P5 (an existing learner), because live has no dev learner with progress. P6 end to end is only Blocker 7.
2. **Done 2026-11-27: unit B5** (`grading-fallback-honesty`), PR #99 merged (`4a2d305`, Tester PASS on `f96236d`).
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
- **Auto-resume (2026-11-28):** tmux window `sensei:auto-resume` types a resume prompt when a usage limit lifts (`ops/DEVICES.md`). After a limit, check that any cut-off agent was restarted.
- **Sessions now run on the server** (`~/workspace/sensei` on `turingMachine`, tmux session `sensei`, Remote Control name "sensei").
- The server is Linux. It can't run the iOS simulator, and Chrome isn't installed. Everything else works there: tests, the API, authoring, Neon and `expo export`.
- A Tester that needs on-screen evidence (`xcrun simctl` screenshots), and the Alpha run, must run on the Mac. Hand off with `handoff.sh` on the server, then `setup-device.sh` on the Mac, and back afterwards.
- The Mac's old worktrees are not on the server. The server has its own worktree for `feat/age-confirmation`.

## In flight

| What | Where | State |
|---|---|---|
| `feat/age-confirmation` | Server worktree `.claude/worktrees/age-confirmation`, pushed at `9aa0ed2` | Developer finishing; no PR yet |
| Old worktrees (Mac only) | `.claude/worktrees/wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66` to `test-78`, `authoring-hardening` | Merged work; safe to clean up |
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
