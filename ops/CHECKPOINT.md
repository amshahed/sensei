# Checkpoint

Last updated: 2026-11-14 by the Lead.

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)) into the app: 120 lessons in 17 chapters (M.1.a), each drafted, gated, critiqued, PM-reviewed and published. Then a learner runs it end to end (Alpha).

## State

- Operating model, global standard and template in place (PR #67).
- Merged: #66 authoring fixes, #69 grading on `gemini-3.5-flash-lite`, #70 outline gaps, #74 typed-reading transform plus `--recheck`, #76 PM sound-lesson correction. Main at `b4865e4`.
- Live data: 1,625 items. Outline compiled to `tools/authoring/output/skeleton.json` (17 chapters, 120 lessons).
- **Unit `22b-sample-lessons` content is done.** Six lessons live: 1 (old seed), 2, 19, 20, 21, 43. PM verdict (`content-review.md` section 6): go for 22c. F-Grammar, I-Reading and sound lessons are on watch with one strike each; a second strike stops that type for a prompt fix.
- 22b Alpha run not done: it needs a session that has the iOS simulator tool. This session lost it.

## Next actions

1. **Unit `22c-full-batch`, in waves** (`ops/work/22c-full-batch/brief.md`). Driver: `node ops/work/22c-full-batch/run-wave.mjs <from> <to> <cap-usd>`, log in `run.log` there. Wave 1 is lessons 1 to 40 (35 to draft). Then PM review (every I-Reading, F-Grammar and sound lesson in full, skim the rest), corrections into `corrections.jsonl`, approve and publish. Waves 2 (41 to 77) and 3 (78 to 120) follow. Audio lessons (I-Listening, I-Speaking, 12 total) are drafted last and not published until Azure exists (Blocker 2).
2. **New unit `check-explanation`:** show a check's explanation after a miss. PM priority before any 22c Alpha run (22b `content-review.md` section 5 item 5). Run it while drafting runs, since drafting uses no agent.
3. Alpha run for 22b and 22c lessons, in a session with the iOS simulator tool. Device `Sensei 22a SE3` (UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`) has Expo Go. Use `expo start --offline` and `open_url exp://127.0.0.1:8081`. A fresh learner is needed for the full batch.

## In flight

| What | Where | State |
|---|---|---|
| Old worktrees | `.claude/worktrees/wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66`, `test-69`, `test-70`, `test-74` | Merged work; safe to clean up later |

## PM backlog

- Age confirmation at sign-up is needed before any real learner (M.5, beta is 18+). New small unit.
- Lesson 20 is live, but republishing it is refused until its passage drops と and の (particle gate).
- Lesson 39 doesn't require typed reading; one outline flag turns it on.
- Tech Lead: four particle cases still pass the gate (22b `test.md` N1, N2). The Developer has a tested refinement in 22b `dev.md`; it needs an F.2.d amendment. PM review is the backstop.
- Exact-match before calling the grading model would cut most calls.
- Drafts and critiques record the requested model, not the served one (Tester N1 on #66, low).
- Grading: a rare 12-second timeout marks a right paraphrase wrong (`grading-model-404/test.md` F2). Stale comment at `grading.service.ts:41-42` (F8); a seeded item reviews more often (F7).
- Writing: an answer of about 6,000 characters causes a 500 (N4); exact kana differing only by punctuation is marked wrong (N6).
- Watch `arigato` at Alpha: long vowels are taught, so it stays wrong (H.2.a).

## Live facts

- Anthropic credit: about $18.90 left. Measured cost per lesson, draft plus critique: $0.055 to $0.09.
- Neon default branch: migrations through `20261104230000_reminders`. 6 lessons, 1 user, 1,625 items.
- `skeleton.json` is gitignored; rebuild with `authoring:outline --force` only if all drafts are thrown away, because lesson IDs change.
- Drafts, critiques and `published/` live only in the main checkout's `tools/authoring/output/` (gitignored). Don't delete them.
- Agent usage is heavy and has hit the founder's 5-hour limit several times. Run one agent at a time and scope re-tests to the diff.
