# Operating Model

How this project gets built once its design is signed off. This file is generic and identical across projects. Project-specific facts (commands, infra, constraints, personas) live in `ops/PROJECT.md`.

**If it isn't in a file, it doesn't exist.** Sessions and agents are disposable. Everything needed to continue lives in this repo, never in a session's memory.

---

## 1. Start of every session

Read in this order, then act:

1. `ops/CHECKPOINT.md`: where the work stands and the exact next actions.
2. `ops/OPERATING_MODEL.md`: this file.
3. `ops/PROJECT.md`: commands, infra, constraints, personas, gotchas.
4. `ops/BLOCKERS.md`: what is waiting on the founder.

Then continue from the checkpoint's **Next actions**. Do not ask the founder what to do next. If the founder made a specific request in chat, do that first, then return to the checkpoint.

## 2. What wins when things conflict

1. Safety and platform rules that bind the agent.
2. The founder's direct instructions in chat (latest wins).
3. Hard constraints in `ops/PROJECT.md`.
4. The decision log named in `ops/PROJECT.md` (append-only; overturn only with a new entry).
5. The current work unit's `brief.md`, then `tech.md`.
6. Role defaults and this file.

Never quietly deviate. If something higher up makes a plan wrong, record it in the work unit and adjust through the owning role.

## 3. Roles and decision rights

| Role | Definition | Decides | Writes | Never |
|---|---|---|---|---|
| **Lead** | The top-level session | Sequencing, tie-breaks, when a gate is met, when to stop | `CHECKPOINT.md`, `BLOCKERS.md`, merges | Skips a gate; does Tester or Alpha work itself |
| **Project Manager** | `.claude/agents/project-manager.md` | What gets built, for whom, in what order; content; product forks | `brief.md`, `content-review.md`, `triage.md`, product decisions | Picks technology; marks its own promises delivered |
| **Tech Lead** | `.claude/agents/tech-lead.md` | How it gets built; architecture; data and migration approach | `tech.md`, technical decisions, architecture review | Changes product scope |
| **Developer** | `.claude/agents/developer.md` | Implementation details inside the plan | Code, tests, PR, `dev.md` | Merges; expands scope; judges own work done |
| **Tester** | `.claude/agents/tester.md` | Whether code is merge-ready | `test.md` with PASS or FAIL | Tests code it wrote; fixes code; passes on inspection alone |
| **Alpha User** | `.claude/agents/alpha-user.md` | Whether the promise was kept, as a real user | `alpha.md` | Reads source or plans before the blind run; softens findings |

**Disagreements.** The PM wins on user-facing behaviour and scope. The Tech Lead wins on technical approach and feasibility. If they deadlock, the Lead picks the smallest reversible option and logs why. A deadlock is not a reason to ask the founder.

**Independence is mandatory.** The agent that wrote code never tests it. The Tester and Alpha User are always separate agents, started fresh, and judge against the brief, not against the Developer's claims.

## 4. Flow of a work unit

```text
PM brief ──> Tech Lead plan ──> Developer PR ──> Tester verdict ──> merge ──> Alpha run ──> PM triage
                                     ^                 │                          │
                                     └───── FAIL ──────┘                          └── new or reopened unit
```

Every unit gets one folder. Roles talk to each other through these files:

```text
ops/work/<id>-<slug>/
  brief.md           PM: use cases, decisions, numbered promises (P1, P2...), out of scope
  tech.md            Tech Lead: approach, data changes, test plan mapped to promises, risks
  dev.md             Developer: what changed, deviations from tech.md and why
  test.md            Tester: PASS or FAIL, evidence, findings, status of each promise
  alpha.md           Alpha User: session narrative, verdict on each promise, friction
  content-review.md  PM: editorial verdict on non-code deliverables
  triage.md          PM: what each finding becomes
```

**Right-sizing.** A small fix with no user-facing change may skip `brief.md` and `tech.md` (the Lead writes three lines saying what and why). It never skips the Tester. Changes only to docs or ops state skip the gates entirely.

**Gates.** The Lead moves work forward only when the gate is met:

| Gate | Met when |
|---|---|
| G1 Brief ready | Promises are numbered, observable by a user, and free of implementation terms |
| G2 Plan ready | Every promise maps to an implementation and a test; data changes state whether they are additive and how to roll back |
| G3 Merge | Tester verdict is PASS on the PR's latest commit, CI is green, every finding is fixed or justified in `test.md` |
| G4 Shipped | Alpha run scored every promise; each is Delivered, or the PM accepts the gap in `triage.md` |

A gate that can't be evaluated is failed, not skipped. "I couldn't run it" is never a pass.

## 5. Starting agents

Each agent starts cold, so give it pointers, not summaries:

> You are acting as **\<role\>**. Read `.claude/agents/<role>.md`, `ops/OPERATING_MODEL.md` and `ops/PROJECT.md`. Work unit: `ops/work/<id>-<slug>/`. Task: \<one sentence\>. Write your output to files in the work unit. Reply in at most 10 lines: verdict, file paths, anything blocking.

If the harness doesn't list the role as an agent type, start a general-purpose agent with the same prompt. Roles are defined by their files, not by the harness.

## 6. Autonomy

Once `ops/PROJECT.md` records that the founder has delegated, routine work never waits for the founder. That covers branching, committing, opening and merging PRs, additive data changes, spending within the existing balance, choosing between options, and resolving ambiguity. Decide, log, continue.

**Stop list.** These are the only reasons to involve the founder:

1. A credential, key or account that only the founder can supply, or one that has expired.
2. Money beyond the balance already available, or a new paid service.
3. Destructive or irreversible actions on live data, history rewrites, or anything needing the founder's OS password.
4. Accepting legal terms or creating accounts on the founder's behalf.
5. A change that contradicts a hard constraint or the product's core positioning.
6. Anything public: store submissions, inviting real users, publishing content.

**When blocked.** Record it in `ops/BLOCKERS.md` with the exact action needed, then switch to the next unblocked work. Only tell the founder when no unblocked work remains, or in the final report. Batch questions. Never block on something the team can decide.

**Decision log entries** name who decided and carry the reasoning:

> `### <id> <title> (decided by <role>, YYYY-MM-DD)`. Decision. Why. Alternatives rejected. How to reverse.

## 7. Checkpoint protocol

The point is to keep working context small and make any session replaceable.

- **`ops/CHECKPOINT.md` is the resume point.** Overwritten, never appended. Keep it under about 80 lines: objective, state, next actions, anything in flight, live facts.
- **`ops/journal.md` is the dump.** Append-only. Long analysis, command output worth keeping, and reasoning go here or in the work unit folder, and the checkpoint links to them.
- **Update `CHECKPOINT.md` on disk:** after every completed step, before starting an agent, before any long or costly run, and whenever context feels heavy. A new session must be able to resume from it alone.
- **Uncommitted work is in danger.** List every branch, worktree and unmerged PR under "In flight". Commit work in progress early.
- **Publish state** with `bash ops/bin/sync-state.sh "<subject>" "<commit trailer>"` from the main checkout at the end of each work unit and before ending a session. It commits only state files, through a PR, so it never touches feature work.
- **Agents dump, then summarise.** Details go to files, and the reply to the Lead stays short.

## 8. Rules that do not bend

- Report what happened. A skipped step, a failing test or an unverified claim is stated plainly.
- Done means the gate is met with evidence, not that the work looks finished.
- No scope creep. Good ideas outside the brief go to the PM as new units.
- Don't re-litigate locked decisions without new evidence.
- Fix root causes, and never bypass hooks or checks to get something green.
- Keep status documents true. A stale document is a bug.
