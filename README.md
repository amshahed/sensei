# Sensei

AI-guided Japanese fluency app. **The product design is the README** — see
[`docs/PRD_v2.md`](docs/PRD_v2.md) for the full product spec and
[`decisions.md`](decisions.md) for the rationale behind every decision (Phases A–M).
Implementation work is tracked in [GitHub issues](https://github.com/amshahed/sensei/issues)
under the **Sensei Beta Implementation** epic (#1).

This file covers **how to run the code**, not what it does.

## Monorepo layout

```
apps/
  api/        NestJS + TypeScript backend (Prisma, Postgres + pgvector)
  mobile/     React Native + Expo client
packages/
  types/      Shared TypeScript types (@sensei/types)
```

Tooling: **pnpm workspaces + Turborepo**. ORM: **Prisma**. See decisions §L for the stack rationale.

## Prerequisites

- Node >= 20 (repo currently developed on Node 25)
- `pnpm` (`npm i -g pnpm`)
- A Postgres database with the `pgvector` extension (Neon recommended) — for anything beyond `/health`

## Quickstart

```bash
pnpm install

# Backend (http://localhost:3000)
cp apps/api/.env.example apps/api/.env   # then fill values
pnpm --filter api start:dev

# Mobile (Expo)
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_API_URL
pnpm --filter mobile start
```

Whole-repo tasks via Turborepo: `pnpm build` · `pnpm typecheck` · `pnpm test` · `pnpm lint`.

> Running on a physical device? Set `EXPO_PUBLIC_API_URL` to your machine's LAN IP
> (e.g. `http://192.168.x.x:3000`), not `localhost`.

## Database (Postgres + Prisma)

Schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma);
the init migration (incl. enabling `pgvector`) is committed under
`apps/api/prisma/migrations/`. Once `DATABASE_URL` points at a real Postgres:

```bash
pnpm --filter api prisma:deploy   # apply migrations (creates tables + pgvector)
pnpm --filter api db:seed         # seed the first lesson (the five hiragana vowels)

# verify the lesson endpoint
pnpm --filter api start:dev
curl http://localhost:3000/lessons/the-five-vowels
```

> No DB configured? The app still boots and `/health` works (Prisma connects
> lazily); only DB-backed routes like `/lessons/:id` require `DATABASE_URL`.

## Deployment (HITL — accounts required)

- **Backend → Railway:** connect the repo, root `apps/api`, set env from `apps/api/.env.example` (incl. Neon `DATABASE_URL`).
- **Database → Neon:** create a project, enable `pgvector`, run `pnpm --filter api exec prisma migrate deploy`.
- **Mobile → Expo EAS:** `eas build --profile development` (see `apps/mobile/eas.json`).
- **Object storage → Cloudflare R2**, **Auth → Clerk** — wired in later issues (#10, #3).
