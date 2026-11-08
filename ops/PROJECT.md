# Sensei: Project Facts

Everything specific to this project that an agent needs. How the team works is in `ops/OPERATING_MODEL.md`.

## Delegation

**Status: delegated on 2026-11-08.** The founder's words: "these day to day tasks towards building the app and content don't need my input anymore." Routine product, technical and content decisions belong to the roles. The stop list in the operating model is the only route to the founder. Recorded as OM.1 in `decisions.md`.

## The product

Sensei is a Japanese fluency app: real comprehension and speaking ability over memorisation. A fixed scaffold with AI-generated content inside it. A shared Foundation phase (about JLPT N5, the entry-level proficiency band), then goal-based tracks.

**Positioning to protect:** no fake personalisation. Foundation is shared by every learner, and personalisation is real only after it.

## Sources of truth

| File | What it holds |
|---|---|
| `decisions.md` | Decision log, append-only. Overturn a decision only with a new entry that references the old one |
| `docs/PRD_v2.md` | Product spec. `docs/PRD_v1.md` is historical; never edit it |
| `progress.md` | Status board per issue and phase |
| GitHub issues | Backlog at `amshahed/sensei` |

## Hard constraints

- **The founder is not a Japanese expert, and neither are the agents.** Linguistic correctness comes from canonical data (JMdict, KANJIDIC2, Tanos lists) or a contracted teacher. AI output is never treated as linguistically verified.
- **Licensing is strict.** Copyrighted books (Genki, *Dictionary of Basic Japanese Grammar* and so on) are never ingested. Only freely licensed material goes into the system (Tae Kim CC-BY-NC-SA, Tatoeba CC-BY 2.0, Tanos, Wikipedia). See `decisions.md` E.2.
- **Out of MVP scope:** full JLPT prep beyond N5, handwriting recognition, tutor marketplace, multi-user or classroom features.
- **Beta scope** is locked in `decisions.md` M.1 to M.4: about 100 lessons, Foundational plus listening, reading, writing and guided speaking, with the full reachable feature surface.

**Editorial review.** The PM now performs the review that F.4 and F.7 assigned to the founder (see OM.1). AI reviewing AI-written Japanese has overlapping blind spots, so PM approval means "fit for closed beta", not "linguistically verified". Before any wider beta a native speaker must sample the content. That is tracked in `ops/BLOCKERS.md`.

## Stack

React Native + Expo SDK 56 (`apps/mobile`), NestJS + TypeScript (`apps/api`), Prisma 6 on Postgres + pgvector, shared types in `packages/types`, pnpm 11 + Turborepo. CI runs on Node 22. Claude for authoring and Gemini 3.5 Flash-Lite for runtime grading (L.4.b), behind `LlmClient`. See `decisions.md` L.1 to L.6.

## Commands

```bash
pnpm typecheck && pnpm lint && pnpm test   # full verification, required before every PR
pnpm --filter mobile ios                   # run the app on the iOS simulator
```

Mobile bundle check, required after any mobile dependency change, because typecheck doesn't prove the app runs. Run from `apps/mobile`:

```bash
pnpm exec expo export --platform ios --output-dir <scratchpad>
```

## Git workflow

- `main` is the default branch. Keep the main checkout at `/Users/sh/workspace/sensei` on `main`. It holds `apps/api/.env` and is where state files are edited.
- Feature work goes in worktrees at `.claude/worktrees/<name>`. Each new worktree needs `pnpm install --offline --frozen-lockfile`, `pnpm --filter @sensei/types build`, and `pnpm --filter api prisma:generate`.
- Merge with `gh pr merge <n> --merge`, using merge commits, not squash.
- Finish code PRs before starting new ones. Stack only when strictly necessary.

## Infrastructure

| Service | State |
|---|---|
| Neon | Org HowCow, project `sensei-beta` (`dawn-rice-83727032`), Frankfurt, Postgres 18 |
| Clerk | Dev instance, keys in `apps/api/.env` and `apps/mobile/.env` |
| Anthropic, Gemini, Voyage | Keys in `apps/api/.env`. Voyage is on its free tier (3 requests per minute) |
| Azure Speech, Cloudflare R2, Railway | Not provisioned, see `ops/BLOCKERS.md` |

**Secrets** live only in `.env` files in the main checkout. Never print, log or commit them.

**Migrations.** Additive migrations are pre-approved under OM.1 once tested on a throwaway Neon branch. Run `prisma migrate deploy` with the branch's direct (non-pooler) URL, seed edge rows, then deploy for real with `pnpm prisma:deploy` from `apps/api` in the main checkout. Anything non-additive is on the stop list.

## Content pipeline

```text
items (ingest) → outline (skeleton) → draft → critique → PM review → publish
```

- Commands are `pnpm authoring:skeleton`, `authoring:draft`, `authoring:critique`, `authoring:review`, `authoring:publish`, from `apps/api`. Output is in `tools/authoring/output/` (gitignored).
- To run from a worktree against the main `.env`, use `pnpm exec node --env-file=/Users/sh/workspace/sensei/apps/api/.env -r ts-node/register -r tsconfig-paths/register src/authoring/<cli>.ts ...`. `NODE_OPTIONS=--env-file` isn't allowed.
- Regenerating the outline changes lesson IDs, so it needs `--force`. Never regenerate once drafts exist unless they are being thrown away.
- Costs: Opus 4.8 at $5/$25 per million tokens in/out, Haiku 4.5 at $1/$5. Outline about $0.50, draft about $0.15 per lesson. Check the balance assumption in `ops/CHECKPOINT.md` before a batch.

## Personas for the Alpha User

**Absolute beginner (default).** Adult English speaker, no Japanese at all, can't read kana (the Japanese syllabic alphabets). Wants to hold a basic conversation on a trip in a year. Has 15 minutes a day, on the phone, often tired. Has quit a gamified app before and is suspicious of streak guilt.

**Returning learner.** Learned kana and some words years ago, rusty on the rest. Wants the app not to waste their time on what they already know, so placement and skip-tests matter.

**Launching the app for an alpha run.** Use dev-stub auth so no real account is involved:

1. Start the API with `CLERK_SECRET_KEY` and `CLERK_JWT_KEY` empty, so it uses the dev user.
2. Start Expo with `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` empty, and open it on the iOS simulator. The app runs in Expo Go; the founder approved its download on 2026-11-08, and `pnpm --filter mobile ios` installs it if it is missing.

Never sign up or sign in through Clerk during an alpha run. The real sign-in walkthrough stays with the founder (`ops/BLOCKERS.md`).

## Gotchas

**Tooling**
- Prettier: for mobile files, run from `apps/api` with `--config .prettierrc`. The repo-root default reformats `apps/mobile` to double quotes.
- Use `pnpm exec expo install <pkg>` so versions match the SDK.
- Scratchpads get wiped between sessions. Commit early.
- A script that edits files should report a miss and carry on, not assert, because Prettier reflows text. Add imports as a full line at the top of the file, never inside a multi-line import.

**Data**
- Prisma's generated enum-rename SQL (a type swap) breaks on existing rows. Use `ALTER TYPE … RENAME VALUE`.
- Voyage's free tier makes ingest crawl: every batch gets a 429 and goes through on the final retry. Expected, not a bug.
- Grammar items have no meaning text until authoring writes one, and they can't be quizzed until then (G.4.a).

**Models**
- Opus 4.8 rejects `temperature`. Haiku 4.5 accepts it. The critic must stay at `temperature: 0` so its verdict is repeatable.
- `claude-opus-4-8` is the authoring default, in `apps/api/src/llm/model-defaults.ts`.

**Review**
- `/code-review high` has caught real bugs on every PR so far: stranded learners, non-idempotent submits, a non-atomic claim and FSRS write. Never skip it. Push back with evidence when a premise is wrong. For example, FSRS (the spaced-repetition scheduling algorithm) with `enable_short_term:false` gives same-day re-reviews no stability gain, as `fsrs.spec.ts` pins.

**Stacked PRs**
- `gh pr merge --delete-branch` on a parent auto-closes children still targeting it. Retarget first with `gh pr edit <child> --base main`.
- After a parent lands, replay children with `git rebase --onto origin/main <old-parent-sha> <branch>`. A plain rebase double-applies merged commits.

**Machine**
- `expo start --ios` exited on its own `osascript` call to System Events and took Metro with it. Use `expo start --offline`, then open `exp://127.0.0.1:8081` with the simulator tool's `open_url`.
- The simulator tool needs the founder to grant access per device in the simulator panel. Reuse `Sensei 22a SE3` so it only has to happen once.
- macOS updates can reset the Xcode license, which blocks `git` and `python3` (`/usr/bin` shims). Only the founder can fix it with `sudo xcodebuild -license accept`. Until then `gh -R amshahed/sensei ...` works and `node` can replace Python.
