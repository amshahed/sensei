# Checkpoint

Last updated: 2026-11-08 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get real lessons into the app and run them end to end. The app has its full feature surface but only one lesson, and no learner has completed anything (`ops/journal.md`, state audit). Target: the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)), now 120 lessons in 17 chapters (M.1.a).

## State

- Operating model merged (PR #67). Global standard at `~/.claude/CLAUDE.md`, template at `~/.claude/templates/project-ops/`.
- PR #66 (authoring fixes) merged. PR #69 (AI grading on `gemini-3.5-flash-lite`) merged.
- **PR #70 (`22a-outline-gaps`) is open at `c040271`, CI green, 940 tests.** Code, N1 to N5 and all earlier rounds pass. Ingest passed on the Neon branch: 1,625 items, the original 1,593 unchanged, a second run changes nothing, and the outline compiled 120 lessons.
- **Blocked only on the recap card simulator check (F2).** The simulator tool refuses the device until the founder grants access (BLOCKERS 10). The Tester's verdict stays FAIL until that check has run. Do not merge before it.

## Next actions

1. Once access is granted, start a fresh Tester for the simulator check only, on `c040271`. Follow `ops/work/22a-outline-gaps/test.md` "Simulator check". Use `expo start --offline` without `--ios`, then the simulator tool's `open_url` with `exp://127.0.0.1:8081` (`--ios` exited on its own `osascript` call). No new commit means no code rerun.
2. On PASS with CI green on the same commit, merge PR #70.
3. `tech.md` section 3 steps 4 and 5 on live data: the same ingest on the default branch, verify, then `authoring:outline --force` ($0). Additive and pre-approved (OM.1). PM reviews the outline.
4. Ask the founder to confirm deleting the Neon branch `br-holy-cake-ba5n0te7` is still fine, then delete it (they approved create and delete, and the tool requires asking before delete).
5. Unit `22b-sample-lessons`: draft 3 lessons (about $0.15 each), critique, PM review, publish, Alpha run on the simulator. The Alpha run closes the HTTP paraphrase check from PR #69.
6. Unit `22c-full-batch`: draft the rest in course order, audio-blocked lessons last. Tech Lead recommends the Message Batches API (50% off, about $7 for 120 lessons); confirm cost from 22b usage.

## In flight

| What | Where | State |
|---|---|---|
| PR #70 `feat/22a-outline-gaps` | `.claude/worktrees/wt-22a` | Pushed at `c040271`, CI green, Tester FAIL only on the unrun simulator check |
| Neon branch `test-22a-ingest` (`br-holy-cake-ba5n0te7`) | Copy of live data plus the plan's fixture. Connection string was in the session scratchpad, so recreate with `get_connection_string` if lost; use the non-pooler host | Keep until the simulator check passes |
| Simulator device `Sensei 22a SE3` | UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`, 375pt, Expo Go installed, booted | Awaiting founder access |
| Old worktrees | `.claude/worktrees/wt-14`, `wt-grading`, `test-66`, `test-69` | Merged work; safe to clean up later |

## PM backlog

- Set the beta to 18+ (Gemini terms, BLOCKERS 9).
- Exact-match before calling the grading model would cut most calls.
- Drafts and critiques record the requested model, not the served one (Tester N1 on #66, low).
- Grading: a rare 12-second timeout shows a right paraphrase as wrong in lessons (`grading-model-404/test.md` F2).
- Grading: `grading.service.ts:41-42` comment is stale (F8); a seeded item reviews somewhat more often (F7).
- Writing: an answer of about 6,000 characters causes a 500 (N4); exact kana differing only by punctuation is marked wrong (N6).
- Watch `arigato` at Alpha: long vowels are taught, so it stays wrong (H.2.a).

## Live facts

- Anthropic credit: about $19.40 left.
- Neon default branch: migrations through `20261104230000_reminders`. 1 lesson, 1 user, 0 completions, 1,593 items. Nothing has been written to it by this work.
- Outline at `tools/authoring/output/skeleton.json` is obsolete. Do not draft from it.
- Agent usage is heavy (140k to 430k tokens each) and hit the founder's 5-hour limit twice. Run one agent at a time, resume agents for small follow-ups, and scope re-tests to the diff.
