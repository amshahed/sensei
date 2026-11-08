# Checkpoint

Last updated: 2026-11-08 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get real lessons into the app and run them end to end. The app has its full feature surface but only one lesson, and no learner has completed anything (`ops/journal.md`, state audit). Target: the about-100-lesson beta slice ([#22](https://github.com/amshahed/sensei/issues/22)).

## State

- Operating model written and awaiting publication on `chore/operating-model`.
- PR #66's review fixes are committed and pushed as `f0ce56d`; CI green. Awaiting the Tester.

## Next actions

1. Publish the operating model (PR from `chore/operating-model`).
2. Tester verifies PR #66 (`ops/work/66-authoring-live-api/`). On PASS, merge it.
3. Unit `22a-outline-gaps`: PM brief (add set phrases and core grammar, cover sound variants; founder approved the recommendation), Tech Lead plan, Developer ingest and prompt changes, Tester, merge.
4. Regenerate the outline with `--force` (about $0.50). PM reviews it.
5. Unit `22b-sample-lessons`: draft 3 lessons, critique, PM review, publish, Alpha run on the simulator.
6. Unit `22c-full-batch`: draft the rest within the credits available.

## In flight

| What | Where | State |
|---|---|---|
| PR #66 `fix/authoring-live-api` | `.claude/worktrees/wt-14` | Pushed, CI green, not merged |

## Live facts

- Anthropic credit: about $19.50 left.
- Neon: migrations through `20261104230000_reminders`. 1 lesson, 1 user, 0 completions.
- Outline at `tools/authoring/output/skeleton.json` has known gaps. Do not draft from it.
