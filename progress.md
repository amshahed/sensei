# Sensei Design Progress

Live status tracker for the structured design grilling.

Phases run roughly in topological dependency order — each unblocks the next. Sub-decisions inside a phase are resolved one at a time.

**Source-of-truth pairing:**
- This file = current status (what's done, in-progress, pending)
- `decisions.md` = full rationale for every resolved decision
- TaskList = mirrors the phases here; the in_progress task points at the active phase

---

## Completed Phases

### ✅ Phase A — Core design philosophy
- **A.1** Dynamism: Hybrid B (fixed scaffold + AI content) for Foundation, phased to C (AI-curated paths) post-Foundation
- **A.2** AI generation timing: Hybrid (authored core + runtime interactive)

### ✅ Phase B — Lesson structure
- **B.1** Lesson size: micro (3–8 min, single concept)
- **B.2** Lesson anatomy: 3-beat (Teach authored → Practice runtime → Check runtime)
- **B.3** Lesson taxonomy: Two-tier (Foundational F-Kana/F-Vocab/F-Kanji/F-Grammar + Integration I-Listening/I-Speaking/I-Reading/I-Writing/I-Scenario) + meta-types (Review, Assessment)
- **B.4** Hierarchy: Module → Chapter → Lesson (3 levels)

### ✅ Phase C — Curriculum scope (Foundation boundary)
- **C.1** Foundation ≈ JLPT N5 (~300–500 lessons; "complete" = pass all chapter Assessments)

### ✅ Phase D — Data model
- **D.1** Items first-class; mastery attaches to items, not lessons
- **D.2** Four item types: Kana, Vocab, Kanji, Grammar

### ✅ Phase E — Item data layer
- **E.1** Sourcing: canonical open datasets (JMdict / KANJIDIC2 / Tatoeba / Tanos / Tae Kim) + AI enrichment + user editorial review (NOT linguistic)
- **E.2** Licensing posture: only freely-licensed material ingested; copyrighted reference books read personally, never ingested
- **E.3** Vector DB scope: reference corpora only (Tier 1 = Tatoeba + AI grammar reference + graded news); item data in relational DB
- **E.4** Item schemas: sketched (common + type-specific), iterate during authoring

### ✅ Phase F — Lesson schemas + authoring workflow
- **F.0** Lesson schemas: same "sketch + iterate" approach as items
- **F.1** Skeleton author: AI proposes from Tanos+JMdict+Genki taxonomy; user reviews pacing
- **F.2** Lesson drafter: AI single-pass from structured input (item data + vector DB + few-shot corrections)
- **F.3** Pre-review gate: structural validation + AI critic pass
- **F.4** Editorial review format: 9-point checklist + free-text notes
- **F.5** Corrections loop: few-shot prompting from recent corrections, filtered by lesson type
- **F.6** Publish gate: DEFERRED to Phase M
- **F.7** Review intensity: adaptive (start 40%, drop to 20% after calibration); ~9-14 hrs total user time across Foundation

### ✅ Phase G — Mastery scoring + Spaced repetition
- **G.1** Mastery model: continuous 0-1 + per-modality breadcrumbs (recognition / recall / production); UI stage labels derived
- **G.2** SRS algorithm: FSRS
- **G.3** Check scoring: AI judges quality → 4-level FSRS rating (Again/Hard/Good/Easy)
- **G.4** Review selection: FSRS-due, sorted by lowest retention, capped 10-15; AI picks weakest modality per item

### ✅ Cross-cutting principles
- **CC.1** Multi-language future-proofing: language-prefixed item IDs, per-Module Foundation scope, per-language taxonomy refs. No speculative multi-language engineering.
- **CC.2** Multi-platform readiness: backend platform-agnostic; pick one client for MVP (Phase L decides which).

### ✅ Phase H — Per-modality evaluation
- **H.1** Speaking eval: Azure Speech (STT + Pronunciation Assessment) + AI semantic
- **H.2** Writing eval: hybrid pipeline (wanakana normalization + kuromoji tokenization + rule-based for exact-match + AI for open response)
- **H.3 + H.4** Listening/Reading eval: reuse existing pipelines by answer modality (multi-choice = deterministic; typed = H.2 pipeline; spoken = H.1 pipeline)
- **H.5** Multi-item Check rating: target item gets full rating; supporting items get exposure credit; AI attempts error attribution on failure

### ✅ Phase I — Branching: Track Modules + intake + placement
- **I.1** Track selection rule: single primary + secondary flavor
- **I.2** Track Module catalog via two-dimensional framing:
  - **I.2.a** Content Track (mandatory) × Goal Overlay (optional) as orthogonal intake dimensions
  - **I.2.b** Goal Overlay mechanic: gap-fill + mock-exam Assessments + readiness tracker; overlay adds, never subtracts; compatibility surfaced transparently at intake
  - **I.2.c** Goal Overlay catalog at MVP = {None, JLPT-N4}
  - Content Tracks at MVP: Travel · Anime/Manga · Living/Working · Conversational (default)
- **I.3** Intake survey
  - **I.3.a** Two-touchpoint timing (signup intake + Foundation-Complete intake)
  - **I.3.b** Signup intake — 3 questions (interests multi-select / prior experience / daily target)
  - **I.3.c** Foundation-Complete milestone moment — celebration framing + Q1 Content Track + Q2 Goal Overlay + optional combined "customize more" screen
  - **I.3.d** Intake → placement hand-off — same-session, routed by signup Q2 prior_experience
- **I.4** Placement quiz
  - **I.4.a** Scope + length: fixed-per-tier with early-exit shortcut, Foundation-items-only depth, frequency-stratified sampling
  - **I.4.b** Format: multi-choice for vocab/kanji/kana, cloze typed for grammar; no spoken
  - **I.4.c** Mastery integration: directly-tested + correct → FSRS high retention; prerequisite inference → moderate retention; not-tested → unscheduled, normal lesson flow
  - **I.4.d** Per-chapter pre-evaluation (skip-test): bidirectional Assessment, optional on chapter entry, partial-pass supported
  - **I.4.e** Curriculum Outline: minimal-but-complete navigation surface, nested list for Foundation + graph for Tracks, lesson-level granularity (read-only), per-chapter actions = skip-test / relocate / browse / review

### ✅ Phase J — Standalone surfaces
- **J.1** Practice Mode
  - **J.1.a** Real Practice Mode tab (own destination, available regardless of due reviews), user-directed scope, no curriculum advancement — decisive use case = JLPT-N4 learner acting on mock-exam-identified weak areas
  - **J.1.b** Scope picker reuses Curriculum Outline + item-type filter + "weakest" shortcut; ordering always lowest-retention/weakest-modality first
  - **J.1.c** Full FSRS/mastery write-back + same-session double-count guardrail
  - **J.1.d** Review-style immediate feedback; "Quiz/test" job retired to Assessments + mock exams
  - **J.1.e** Learned-items-only (future items browse/skip-test in Outline, not drillable)
- **J.2** Progress Dashboard
  - **J.2.a** Distinct lean "scoreboard" surface (aggregate mastery / modality / momentum); links to Outline; ships only motivating-or-actionable metrics
  - **J.2.b** Two levels deep: aggregate + four-item-type breakdown + modality profile; weak spots link to Practice Mode; no individual-item list
  - **J.2.c** Cumulative mastery curve + recent-rate callout; effort/consistency deferred to K; exam readiness tracker stays separate
- **J.3** Media Learning (Feature 8) — *deferred from MVP first cut; posture locked*
  - **J.3.a** Transient processing, zero retention (architecturally enforced); only generated breakdown persists, composed of our licensed items
  - **J.3.b** User-supplied text only (no platform fetch) — zero ToS exposure; hybrid paste+fetch noted as future; consequence: no in-app source audio (text-comprehension tool)
  - **J.3.c** Reference breakdown + opt-in scheduling of already-existing items; no item minting from arbitrary media

### ✅ Phase K — Confidence + soft signals
- **K.1** Confidence self-rating: optional one-tap "I guessed" flag on recognition items; checked+correct downgrades FSRS rating (Hard not Good); downgrade-only; no flag on production items
- **K.2** Daily-commitment mechanic: "learning streak" (forgiving), not a login streak — (1) meaningful daily requirement = clear due reviews + hit self-set target (fallback = one completed lesson/practice unit); (2) demoted under the J.2 progress hero; (3) decay-anchored honest nudge; (4) bounded grace. Reframe: redirect streak-gaming so the gamed minimum *is* the highest-value learning act → "come for the streak, stay for the learning"
- **K.3** Soft-signal details:
  - **K.3.a** Streak-freeze grace: earned (bank by over-delivering) + capped (~2–3); grace funded by real learning, not gifted
  - **K.3.b** "Day done" anchors on the due-review session (G.4-capped); Practice Mode counts toward target/fallback but doesn't substitute for due reviews
  - **K.3.c** Daily target: user-editable + system-suggested recalibration on sustained mismatch (user confirms; never silent)
  - **K.3.d** Notifications: decay-driven, hard cap 2/day, role-differentiated (primary + optional evening backstop), smart-suppressed once day-done (→ effectively ≤1 for consistent learners), quiet hours, one-tap off, no streak-guilt
  - **K.3.e** Milestone celebrations: small curated set anchored to capability gains (all-kana, first conversation, first decoded media, chapter/Foundation/Track complete); no hollow counters or per-lesson confetti

### ✅ Phase L — Tech stack
*Founder profile: solo, full-stack (web JS/TS+React, Python, some mobile), mobile-first. Principle: minimize ops + build in strongest language.*
- **L.1** Mobile client: **React Native + Expo** (managed) — reuses React fluency, one codebase iOS+Android, Expo covers mic + notifications, web-extensible later
- **L.2** Backend: **TypeScript + NestJS** — language parity with client; we orchestrate AI APIs (not train models) so Python's moat doesn't apply; JP libs (kuromoji/wanakana/ts-fsrs) + jmdict-simplified are JS-native
- **L.3** Data stores: **Postgres + pgvector, one database** — E.3 reference corpus is small/bounded; one datastore = solo simplification; migration to dedicated vector DB is a cheap exit option
- **L.4** AI provider: **Anthropic (Claude) primary** behind a thin swappable `LLMClient`; tiered — Opus for offline drafting, Haiku/Sonnet for runtime grading/interactivity. Not full multi-provider routing (build the seam, not the framework)
  - **L.4.a** Provider split (amends L.4, 2026-06-15): **Anthropic** for offline authoring (Opus drafter + Haiku critic — one-time, quality-sensitive); **Gemini 2.5 Flash** for runtime grading (recurring, rubric-based, ~3x cheaper than Haiku + real free tier for dev). Both behind the same `LlmClient` interface; per-task provider selection. Follow-up issue tracks `GeminiLlmClient` + switching #8 grading path
- **L.5** Speech: **Azure Neural TTS** consolidating with Azure STT/pronunciation (H.1); authored audio cached at publish, runtime TTS only for dynamic content
- **L.6** Hosting: **low-ops managed stack** — Railway (NestJS) · Neon (Postgres+pgvector) · Cloudflare R2 (storage) · Clerk (auth) · Expo EAS (mobile distribution); hyperscaler deferred (containerized NestJS stays portable)

### ✅ Phase M — MVP scope cut + Beta launch slice
- **M.1** Beta content slice: **~100-lesson end-to-end vertical** of early Foundation (onboarding/placement → kana → ~150–200 vocab → first ~15–20 grammar → light kanji → basic multimodal → "introduce yourself" milestone). Smallest true vertical slice; 3–6 weeks of material
- **M.2** Beta modalities: Foundational + I-Listening/Reading/Writing + **guided** I-Speaking (Azure pronunciation); defer open speaking-dialogue, I-Scenario, Media Learning
- **M.3** Beta feature surface: **full reachable surface** (core loop + FSRS + placement + skip-tests + Curriculum Outline + Practice Mode + Dashboard + streak/soft-signals). *(User override of recommended lean-core B; rationale: the deferred surfaces are retention mechanics central to the "do they return?" half of the thesis.)* Post-Foundation surfaces out by construction
- **M.4** Launch sequence: **tracer-bullet first** (one lesson end-to-end through every system) → parallel content-authoring + surface-build → dogfood → closed beta → iterate → wider beta

---

## In Progress

Design grilling COMPLETE (all phases A–M locked). **Implementing** against the GitHub issues (epic #1, children #2–#22). The core learning loop is merged to `main`, each via a high-reviewed, CI-green PR.

### Implementation status (as of 2026-11-04)

| Issue | Scope | Status |
|---|---|---|
| #2 | Monorepo scaffold + deploy skeleton + **CI** (Actions: typecheck/lint/test/build, Node 22) | ✅ merged to main |
| #4 | Data model: Prisma schema + seeded "five vowels" lesson + `GET /lessons/:id` | ✅ merged |
| #5 | **Tracer bullet** — lesson player end-to-end (Teach→Practice→Check→complete) | ✅ merged |
| #6 | FSRS scheduling + mastery write-back (`enable_short_term:false`) + `GET /reviews/due` | ✅ merged |
| #7 | Review session (due queue, typed recall) | ✅ merged |
| #8 | AI grading of open responses via thin `LlmClient`/Anthropic (flag-gated; deterministic fallback) | ✅ merged |
| #18 | "I guessed" confidence flag (K.1) — MC-only Good→Hard downgrade | ✅ merged |
| #34 | Item ingestion CLI — kana / vocab (jmdict-simplified) / kanji (kanjidic2) / grammar (Tanos shells) | ✅ merged |
| #35 | Reference corpus — ReferenceDoc+pgvector, Voyage AI client, Tatoeba + grammar-ref ingest CLIs | ✅ merged |
| #36 | Skeleton author CLI — F.1 (SkeletonSchema + skeleton-prompter + skeleton.ts CLI) | ✅ merged |
| #37 | Lesson drafter + AI critic + corrections-log loop — F.2/F.3/F.5 | ✅ merged |
| #38 | Editorial review CLI + publish command — F.4/F.6 | ✅ merged |
| #39 | Gemini 2.5 Flash grading client — L.4.a provider split | ✅ merged |
| #9 | Writing eval service (H.2) — wanakana + kuromoji + rule-based + AI fallback | ✅ merged |
| #12 | Reading lessons (H.4) — LessonPlayer teach beat + kana/text/example blocks; normaliseTeach publisher | ✅ merged |
| #16 | Progress Dashboard (J.2) — `GET /progress` API + ProgressScreen | ✅ merged |
| #3 | Auth (Clerk, L.6) — global `AuthGuard` (Clerk JWT verify) + dev-stub fallback, `@Public()`, `GET /me` + users row create-on-sign-in; mobile ClerkProvider + sign-in/up screen + Bearer token | ✅ merged + **verified live** (real Clerk token → `GET /me` → 200, users row created in Neon; idempotent) |
| #34 fix (PR #50) | Ingest against **real** source data — JLPT list-driven vocab join (E.1.a), KANJIDIC2 old-scale mapping, Tatoeba per-item cap K=8 (E.3.a) | ✅ merged |
| PR #51 | Hermetic tests — `apps/api/.env` kept out of every Jest run (Prisma's implicit .env load); `DEV_USER_ID` read per call | ✅ merged |
| #14 | Curriculum Outline (I.4.e, I.4.e.a) — `GET /curriculum`, `GET /curriculum/next`, `POST /curriculum/relocate` (incl. `null` = back to furthest point); next-chapter lookahead gating; mobile Home · Curriculum · Progress tab bar + outline screen | ✅ merged (PR #52) |
| #15 | Chapter Assessment engine (I.4.d, I.4.d.a) — one engine for skip-test + exit gate; ~20 sampled per-item typed-recall Qs, ≥80%; partial-pass lesson collapse; inferred mastery on pass; chapter-intro skip-test offer; idempotent submit | ✅ merged (PR #53) |
| PR #55 | Shared recall (G.4.a) — one typed-recall question + grader for Reviews, Assessments, Practice; kanji readings without KANJIDIC2 markers; no answer leak in the due queue; grader outage → unscored | ✅ merged |
| #17 | Practice Mode (J.1, J.1.f) — `GET /practice/scopes`, `POST /practice/sessions` (weakest / module / chapter + type filter; learned items only; G.4 order; cap 20), `POST /practice/sessions/:id/answer` (first scored answer per item per session writes FSRS, in one transaction with the claim); mobile Practice tab + drill (misses re-asked once, exposure only); Outline `actions.practice` + Progress per-type links | ✅ merged (PR #56) |

**The M.4 loop is closed and live in code** (item DB → lesson player → Check → AI/deterministic grading → FSRS → reviews). Auth is wired (#3) and **verified against live infra**: real Clerk session → `GET /me` → 200 with a `users` row created in the live DB.

**Live infra provisioned (2026-11-02):**
- **Clerk** — dev instance `ins_3LZBi0bt…`; keys set in `apps/api/.env` (`CLERK_SECRET_KEY`) + `apps/mobile/.env` (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`).
- **Neon** — org **HowCow** (`org-lucky-forest-74421541`); project **sensei-beta** (`dawn-rice-83727032`), region `aws-eu-central-1`, Postgres 18. `DATABASE_URL` set in `apps/api/.env`; all migrations through `20261104090000_practice_mode` (#17) applied + seeded (the-five-vowels). The #14/#15 pair was verified on a throwaway branch first, then deployed (2026-11-03); the test branch is deleted. #17's migration (two new tables) was deployed 2026-11-04. Neon MCP (`.mcp.json`) + `neon` skill installed project-scoped.
- **Item + reference data in Neon (2026-11-03):** 92 kana · 1,358 vocab (N5 702 / N4 656) · 103 N5 kanji · 40 grammar shells · 9,694 Tatoeba sentences embedded (Voyage, ~72k tokens ≈ $0.004). Voyage is on its no-payment-method tier (3 RPM): every batch hit a 429 and got through on the last retry.

**No AFK issues left.** Every open issue is `hitl`: #22 content, #20 notifications, #19 streak, #13 signup + placement, #11 speaking, #10 listening (and epic #1). The next build step needs the founder to pick which one to unblock. #13 (placement) will write the `SKIPPED_VIA_PLACEMENT` marks the outline already renders.

**HITL still pending from the founder:**
- **#3 last-mile (optional):** drive sign-up/sign-in through the mobile UI on a device/simulator via EAS (the token→API path is already verified; only the on-device UI walkthrough is unexercised).
- **#22 skeleton blocked on Anthropic credits:** `authoring:skeleton` failed with "credit balance is too low". Top up console.anthropic.com → Plans & Billing, then rerun `pnpm authoring:skeleton` from `apps/api` (the item data it reads is already in Neon).
- **Optional — Voyage payment method:** lifts the 3 RPM / 10K TPM cap. The free token allowance still applies. It only matters for re-ingests and retrieval at authoring scale.
- **Content gap for Practice/Reviews:** grammar items have no meaning yet, so they can't be quizzed (G.4.a). #22 authoring must write one per taught grammar item.
- provision Railway · Azure · R2 (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `GEMINI_API_KEY` are set).

---

## Pending Phases

**(none — all design phases resolved.)**

---

## Session conventions

- **Honest pushback over flattery.** User explicitly asked for this.
- **User is not a Japanese expert.** Authoring/review workflows must accommodate.
- **Each grilling question:** 2–4 options with one recommended, defended with reasoning. User picks, pushes back, or clarifies.
- **Decisions log is append-only.** Don't rewrite — add new entries with references when overturning.
