# CLAUDE.md

Guidance for Claude Code and any agent working in this repository.

## Start here (every session, every agent)

1. Read `ops/CHECKPOINT.md`: where the work stands and the exact next actions.
2. Read `ops/OPERATING_MODEL.md`: roles, gates, autonomy, and when to stop.
3. Read `ops/PROJECT.md`: commands, infrastructure, constraints, personas, gotchas.
4. Read `ops/BLOCKERS.md`: what is waiting on the founder.
5. Continue from the checkpoint's **Next actions**.

**Do not ask the founder what to do next.** Day-to-day product, technical and content decisions were delegated on 2026-11-08 (`decisions.md` OM.1). The team decides, logs and continues. The founder is involved only for the stop list in `ops/OPERATING_MODEL.md`. If the founder makes a specific request, do that first, then return to the checkpoint.

**Persistence rule.** Project state lives in this repo, never in session context or auto-memory. Keep context small: dump detail to `ops/journal.md` or the work unit folder, and keep `ops/CHECKPOINT.md` current so any new session can resume from it alone.

## The team

Five roles, each defined by a file in `.claude/agents/`: project-manager, tech-lead, developer, tester, alpha-user. The top-level session is the Lead and coordinates them. Roles communicate through files in `ops/work/<id>-<slug>/`. See `ops/OPERATING_MODEL.md`.

## Repository map

| Path | What it is |
|---|---|
| `apps/api` | NestJS backend, Prisma schema, ingest and authoring CLIs |
| `apps/mobile` | React Native + Expo client |
| `packages/types` | Shared TypeScript types |
| `ops/` | Operating model, project facts, checkpoint, journal, blockers, work units |
| `.claude/agents/` | Role definitions |
| `decisions.md` | Append-only decision log: what was decided and why |
| `progress.md` | Status board per issue and phase |
| `docs/PRD_v2.md` | Current product spec. Versions up to PRD_v3 if material shifts emerge |
| `docs/PRD_v1.md` | Original vision, historical. Never edit |

## Design state

All design phases A to M plus CC.1 and CC.2 are locked in `decisions.md`. Build against them. A genuinely new question is decided by the owning role and appended as a new entry. Past entries are never rewritten.

## Hard constraints

- **The founder is not a Japanese teacher or linguistic expert, and agents aren't either.** Authoring leans on AI-drafted content with editorial review for tone, flow and naturalness, not linguistic correctness. Correctness comes from canonical data (JMdict, KANJIDIC2, Tanos lists) or a contracted Japanese teacher.
- **The founder wants honest pushback, not flattery.** "be honest and straight. don't want you to please me, or agree with me for the sake of it." Defend recommendations and name problems plainly.
- **Licensing is strict.** Copyrighted reference books (Genki, *Dictionary of Basic Japanese Grammar*, etc.) may be read by the founder to inform prompts but are NEVER ingested. Only freely licensed material goes into the system. See `decisions.md` E.2.

## Product context

- **Philosophy:** real comprehension and speaking ability over memorisation. Speak early, learn from real content, grammar serves communication.
- **Architecture:** fixed scaffold plus AI-generated content within it. A Foundation phase shared by every learner (about JLPT N5, 300 to 500 micro-lessons), with goal-based Track Modules after.
- **Positioning:** the app does not promise personalisation from minute one. Foundation is shared, and personalisation is real after it. "If other apps personalize from minute one, they are either lying or providing useless variation."
- **Out of MVP scope:** full JLPT prep beyond N5, handwriting recognition, tutor marketplace, multi-user or classroom features.

## Conventions

- PRDs use heavy markdown sectioning with short bulleted phrases. Match that voice.
- PRDs version up. Never edit `PRD_v1.md`. Edit `PRD_v2.md` while it's current, and spin up `PRD_v3.md` for material shifts.
- `decisions.md` is append-only. To overturn a decision, add a new entry referencing the old one.
- `progress.md` is the live status board. Update it when an issue or phase moves.
- The README covers how to run the code. Link to the PRD rather than duplicating it.
