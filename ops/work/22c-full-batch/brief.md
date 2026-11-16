# Brief: the full lesson batch

Unit `22c-full-batch`. Written by the Lead, 2026-11-14. Content only: no code changes, so no `tech.md`. The deliverable and its promises are the same as 22b at full scale, so this file points to 22b rather than restating it.

## What

Draft, gate, critique, PM-review, approve and publish the 114 lessons of the 120-lesson outline that aren't live yet. The 6 live lessons (1 seed, 2, 19, 20, 21, 43) stay, except lesson 1: its draft replaces the seed in place (F.1.b).

## Promises

The 22b promises carry over unchanged, per lesson type (`ops/work/22b-sample-lessons/brief.md` section 4). The Alpha run scores them on the full course.

## How it runs

- **Waves, so the corrections loop works.** Each wave is drafted, then reviewed by the PM. Systematic flaws go into `tools/authoring/corrections.jsonl` before the next wave is drafted, so later drafts are steered away from them (F.2). A flaw found in wave 1 costs at most one wave of redrafts.

  | Wave | Lessons | Chapters | To draft | What it calibrates |
  |---|---|---|---|---|
  | 1 | 1 to 40 | 1 to 7 | 35 | Kana, sound lessons 15 to 18 and 39, I-Reading 4, 8, 13, 32, 38 before any grammar is taught |
  | 2 | 41 to 77 | 8 to 12 | about 30 | The first grammar run and the first kanji |
  | 3 | 78 to 120 | 13 to 17 | about 38 | The rest |
  | Audio | 12 I-Listening and I-Speaking | all | 12 | Drafted last, published only after Azure Speech exists (Blocker 2) |

- **Driver:** `node ops/work/22c-full-batch/run-wave.mjs <from> <to> <cap-usd>`, run from the main checkout. Course order; skips audio lessons, existing drafts and existing rejections; drafts each lesson with `--max-cost 0.4`, then critiques it; stops before the running total passes the cap. One line per lesson in `run-log.txt`.
- **Rejections:** read the `.rejected.json`. If a code fix would cure it, fix and `--recheck` ($0). Otherwise redraft once with `--force` (the redraft is told why). A second rejection of the same lesson goes to the PM and Tech Lead as a prompt problem, not a third paid try.
- **PM review** (22b `content-review.md` section 6): every I-Reading, F-Grammar and sound lesson in full; skim F-Kana, F-Kanji and phrase lessons. Verdicts and edits go in `content-review.md` here. A second strike on an on-watch type stops that type until the prompt is fixed.
  - Once `check-explanation` ships, learners see every check's explanation after every answer (`check-explanation` brief 3.5, B.2.a). Review explanations against those rules: present, one or two sentences, no praise, reads right after a miss, and never spells out how to type a word before the check that asks for it. Flag any open (AI-graded) check before it is published (`check-explanation` brief section 5).
- **Publish:** the Lead approves with `EDITOR=true pnpm --filter api authoring:review <id>` after the PM's edits are in the draft, then `authoring:publish <id>`.

## Money

- About $18.90 of credit. Measured cost in 22b was $0.055 to $0.09 per lesson, draft plus critique. 108 lessons is about $8 to $10 with a few redrafts.
- Caps: $3.50 per wave. If a wave hits its cap, stop and look before raising it. If the balance drops below $3, record Blocker 1 as needed now and stop paid runs.

## Out of scope

- Mobile changes, including showing explanations after a miss (unit `check-explanation`).
- Particle-gate refinements (22b `test.md` N1, N2). PM review is the backstop.
