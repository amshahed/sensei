# Checkpoint

Last updated: 2026-11-16 by the Lead.

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
- **Wave 2 (41 to 77), drafted and waiting for PM review.** The six lost lessons were redrafted: 44, 53 and 74 drafted; 54, 55 and 77 rejected. Lesson 67 is a draft now.
- **Wave 3 (78 to 120, no audio), drafted for $2.62:**
  - 32 drafts. Two of them, 99 and 120, were recovered from `.failed.json` at $0.
  - 6 rejected: 83, 86, 87, 94, 95 and 104.
  - Details and patterns are in `ops/work/22c-full-batch/wave3-notes.md`.
- **Still to fix, all saved and recoverable at $0 by PM hand edit plus `--recheck`:**
  - Rejected drafts 54, 55, 76, 77, 83, 86, 87, 94, 95 and 104. For 86 and 87, a `--force` redraft (about $0.07) is the alternative to a hand edit.
  - Open checks in 47 and 75, which publish refuses.
- Audio lessons (12) aren't drafted. They wait for Azure (Blocker 2).

## Next actions

1. **PM: wave 2 review** (lessons 41 to 77), in `ops/work/22c-full-batch/content-review-wave2.md`:
   - Inputs: `wave2-notes.md`, `wave3-notes.md` (the rejected-lesson table and patterns cover wave 2 lessons too) and `run-log.txt`.
   - Read every F-Grammar, F-Kanji and I-Reading lesson in full. Skim the rest.
   - Hand-fix rejected lessons 54, 55, 76 and 77, and the open checks in 47 and 75, then `--recheck` them.
   - Rule on the kanji-components pattern (wave3-notes, pattern 2).
2. Lead: approve and publish the wave 2 lessons the PM passes. Use `EDITOR=true pnpm --filter api authoring:review <id>`, then `authoring:publish <id>`, in course order. Log each in `run-log.txt`.
3. PM: wave 3 review (78 to 120), the same way, including rejected lessons 83, 86, 87, 94, 95 and 104. Then the Lead publishes.
4. Alpha run for the 22b and 22c lessons, in a session with the iOS simulator tool:
   - Device `Sensei 22a SE3` (UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`) has Expo Go.
   - Use `expo start --offline`, then `open_url exp://127.0.0.1:8081`.
   - A fresh learner is needed.

## In flight

| What | Where | State |
|---|---|---|
| Old worktrees | `.claude/worktrees/wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66` to `test-78`, `authoring-hardening` | Merged work; safe to clean up |
| Throwaway Neon branch | `test-78-check-explanation` (`br-red-forest-baxm7pzr`) | Ask the founder before deleting |

## PM backlog

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
- Neon default branch: migrations through `20261104230000_reminders`. 40 lessons, 1 user, 1,625 items.
- `skeleton.json` is gitignored and was rebuilt on 2026-11-16 after the swap. Rebuild it with `authoring:outline --force` only when the outline spec changes, then diff it against a backup.
- Drafts, critiques, `.failed.json` and `.prev.json` files live in the main checkout's `tools/authoring/output/`. Approved lessons live in `tools/authoring/published/`. Both are gitignored, so don't delete them.
- Agent usage is heavy and has hit the founder's 5-hour limit several times. Run one agent at a time and scope re-tests to the diff.
