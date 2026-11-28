# Checkpoint

Last updated: 2026-11-28 by the Lead (server session).

Resume point for any session. Overwritten, never appended. Details live in `ops/journal.md` and `ops/work/`.

## Objective

Get the beta slice ([#22](https://github.com/amshahed/sensei/issues/22)) into the app: 120 lessons in 17 chapters (M.1.a), each drafted, gated, critiqued, PM-reviewed and published. Then a learner runs it end to end (Alpha).

## State

- **108 of 120 lessons are live** (17 chapters, 874 checks). Only the 12 audio lessons remain, and they wait for Azure (Blocker 2). The PM reviewed every wave (`ops/work/22c-full-batch/`).
- Merged since 2026-11-16, each with a Tester PASS: #82 `authoring-hardening`, #91 `open-check-followup`, #95 `authoring-polish`, #99 `grading-fallback-honesty` (B5) and **#112 `exact-meaning-grading`** (2026-11-28, `8470662`). With #112, a typed listed meaning is marked right without the grader in reviews, practice, chapter tests and skip-tests (G.4.h to G.4.j).
- One code PR is open (#107). Server units run beside it only if they touch none of its files (Lead ruling 2026-11-28, in the journal).

## Next actions

1. **`age-confirmation`, PR #107** (M.5, 18+, before any real learner). Head `4c75871`, CI green.
   - **Tester half 1 (server): PASS** (`ops/work/age-confirmation/test.md`).
   - **Next: Tester half 2 on the Mac**, a fresh Tester on the same commit and on `test-age-confirmation` (`br-red-mud-batele3k`). It runs S1 to S7 exactly as `test.md` "For half 2 (Mac)" lists. If the head moves, half 1 re-runs too.
   - Then G3 and the merge, the live deploy (`tech.md` 3.3: `pnpm prisma:deploy` from the main checkout), and the Alpha run.
   - Standing rulings: F1 is deferred to the backlog. Alpha accepts the branch evidence for P5. P6 end to end is Blocker 7 only.
2. **Next server unit: the PM picks it.** The top candidate is the skip-test outage loophole below. It must touch none of #107's files.
3. **Alpha run (G4)**, blocked on **Blocker 10**: a session that can tap and type in the simulator.
   - Device `Sensei 22a SE3` (UDID `D7C64108-6D56-4043-8801-6B8A84A790B1`) has Expo Go.
   - Start with `expo start --offline`, then `open_url exp://127.0.0.1:8081`.
   - Use a fresh learner and dev-stub auth.
4. **Audio lessons (12)** once Azure exists (Blocker 2). Drafting is about $1. Use `run-wave.mjs <from> <to> <cap> --include-audio`.
5. **B1** (lesson 120's rubric) needs a clean grader eval. That is realistic only after Gemini billing (Blocker 9), and it must land before any real learner.

If a Mac session and the server run at the same time, each edits only its own unit's lines here.

## Devices

- The server `turingMachine` is the default: tmux session `sensei`, with Remote Control under the name "sensei". The Mac is needed for the simulator, the Alpha run and Testers that need on-screen proof. See `ops/DEVICES.md`.
- Move with `bash ops/bin/handoff.sh` (leaving) and `bash ops/bin/setup-device.sh` (arriving). Secrets, transcripts and drafts travel through the private store with `state.mjs`.
- **Auto-resume:** tmux window `sensei:auto-resume` types a resume prompt when a usage limit lifts. After one, check that any cut-off agent was restarted.

## In flight

| What | Where | State |
|---|---|---|
| `feat/age-confirmation` | Server worktree `.claude/worktrees/age-confirmation`, PR #107 | Half 1 PASS; half 2 needs the Mac |
| Tester worktree (#107) | Server `.claude/worktrees/test-age-confirmation`, detached at `4c75871` | Kept for a re-run; remove after merge |
| Old worktrees (Mac only) | `wt-14`, `wt-grading`, `wt-22a`, `wt-22b`, `test-66` to `test-78`, `authoring-hardening` | Merged work; safe to clean up |
| Throwaway Neon branches | `test-78-check-explanation` (`br-red-forest-baxm7pzr`), `test-open-check-followup` (`br-winter-poetry-baq6sbs4`), `test-age-confirmation` (`br-red-mud-batele3k`) | Deleting needs the founder's yes (Blocker 11) |

## PM backlog

- **Skip-test outage loophole, before real learners** (`exact-meaning-grading/test.md` F1, already on `main`). With the grader down, unscored answers drop out of the total, so one right answer plus 19 junk ones passes a skip-test and skips the chapter (`assessments.service.ts:237`). Fix: require a minimum share of scored answers before `passed`, at least for a skip-test.
- **After #107 merges:** `exact-meaning-grading/test.md` F2. `app.integration.spec.ts:731` no longer reaches the grader's fallback. Give its item a meaning like 'sushi; raw fish'.
- **After #107 merges:** `age-confirmation/test.md` F1. Two simultaneous first requests for an account with no row: the loser gets a 500. Make `submitAge`, `submitIntake` and `ensureUser` conflict-safe. In the app, ignore a failed `answerAge` once an answer is stored.
- **Before these words are taught** (`exact-meaning-grading/test.md` F3 to F7):
  - 全然 and ちっとも “(not) at all” would accept “at all”, 決して “(not) ever” would accept “ever”, and それほど “to that degree” would accept “that degree”;
  - 犬's nested brackets mean “dog” isn't accepted;
  - full-width letters, and word-split collisions.
  Each fails safe or is an accepted cost today.
- `grading-fallback-honesty/test.md`:
  - F1: comments repeat the verdict. That is the grading prompt, so bundle it with B1.
  - F2: the end screen keeps 🎉 when nothing counted.
- `open-check-followup/triage.md`: B3 (the eval's pair rule), and B4 (the Android keyboard, before any Android build).
- `authoring-polish/test.md` gate gaps F1 to F3 (Low; none hits today's drafts). Also the untaught-word warning for the drafter, before the audio wave.
- Placement asks for 食's reading with く(う) as the answer.
- Lesson 20 won't republish until its passage drops と and の. Lesson 39 doesn't require typed reading (one outline flag).
- A self-answering prompt with an English-lookalike answer isn't caught (Tester T2, Low).
- A rare 12-second timeout marks a right paraphrase wrong. A writing answer of about 6,000 characters causes a 500. Kana differing only in punctuation is probably fixed by H.2.c, so confirm first.
- Watch `arigato` at Alpha: long vowels are taught, so it stays wrong (H.2.a).

## Live facts

- Anthropic credit: **about $10 left**. The rest of the course is about $2.
- Neon default branch: migrations through `20261104230000_reminders`. 108 lessons (874 checks), 1 user, 1,625 items.
- `skeleton.json` is gitignored. Rebuild it only with `authoring:outline --force` when the outline spec changes, and diff it against a backup.
- Drafts live in `tools/authoring/output/` and approved lessons in `tools/authoring/published/`, both gitignored. Don't delete them.
- The founder is on Claude Pro. Run one agent at a time, and scope re-tests to the diff.
