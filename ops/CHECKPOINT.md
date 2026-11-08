# Checkpoint

Last updated: 2026-11-08 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get real lessons into the app and run them end to end. The app has its full feature surface but only one lesson, and no learner has completed anything (`ops/journal.md`, state audit). Target: the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)), now 120 lessons in 17 chapters (M.1.a).

## State

- Operating model merged (PR #67). Global standard at `~/.claude/CLAUDE.md`, template at `~/.claude/templates/project-ops/`.
- PR #66 (authoring fixes) merged. PR #69 (AI grading on `gemini-3.5-flash-lite`) merged.
- PR #70 (`22a-outline-gaps`) merged after Tester PASS on `c040271`, including the recap card on the simulator (`ops/work/22a-outline-gaps/test-screens/`).
- Live import done and verified: 1,625 items, 50 grammar, 24 grammar meanings, original 1,593 rows byte-identical apart from the 14 meanings filled. A re-run changes nothing. Outline compiled to `tools/authoring/output/skeleton.json` (17 chapters, 120 lessons, 342 items) at $0. Tester confirmed the spec matches the PM's appendix for all 120 lessons, so no separate outline review is needed.
- Throwaway Neon branch deleted.

## Next actions

1. Unit `22b-sample-lessons` (PM brief in progress): draft 3 lessons (about $0.15 each), critique, PM review, publish, Alpha run on the simulator. The Alpha run closes the HTTP paraphrase check from PR #69.
2. Unit `22c-full-batch`: draft the rest in course order, audio-blocked lessons last. Tech Lead recommends the Message Batches API (50% off, about $7 for 120 lessons); confirm cost from 22b usage.

## In flight

| What | Where | State |
|---|---|---|
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
- Neon default branch: migrations through `20261104230000_reminders`. 1 lesson, 1 user, 0 completions, 1,625 items.
- Outline at `tools/authoring/output/skeleton.json` is the compiled 120-lesson one (gitignored; rebuild with `authoring:outline --force`). The old model-written one is kept beside it as `skeleton.opus-113-obsolete.json`. Do not regenerate once drafts exist.
- Agent usage is heavy (140k to 430k tokens each) and hit the founder's 5-hour limit twice. Run one agent at a time, resume agents for small follow-ups, and scope re-tests to the diff.
