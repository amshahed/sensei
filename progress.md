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
- **L.5** Speech: **Azure Neural TTS** consolidating with Azure STT/pronunciation (H.1); authored audio cached at publish, runtime TTS only for dynamic content
- **L.6** Hosting: **low-ops managed stack** — Railway (NestJS) · Neon (Postgres+pgvector) · Cloudflare R2 (storage) · Clerk (auth) · Expo EAS (mobile distribution); hyperscaler deferred (containerized NestJS stays portable)

### ✅ Phase M — MVP scope cut + Beta launch slice
- **M.1** Beta content slice: **~100-lesson end-to-end vertical** of early Foundation (onboarding/placement → kana → ~150–200 vocab → first ~15–20 grammar → light kanji → basic multimodal → "introduce yourself" milestone). Smallest true vertical slice; 3–6 weeks of material
- **M.2** Beta modalities: Foundational + I-Listening/Reading/Writing + **guided** I-Speaking (Azure pronunciation); defer open speaking-dialogue, I-Scenario, Media Learning
- **M.3** Beta feature surface: **full reachable surface** (core loop + FSRS + placement + skip-tests + Curriculum Outline + Practice Mode + Dashboard + streak/soft-signals). *(User override of recommended lean-core B; rationale: the deferred surfaces are retention mechanics central to the "do they return?" half of the thesis.)* Post-Foundation surfaces out by construction
- **M.4** Launch sequence: **tracer-bullet first** (one lesson end-to-end through every system) → parallel content-authoring + surface-build → dogfood → closed beta → iterate → wider beta

---

## In Progress

**(none — design grilling COMPLETE. All phases A–M locked.)**

Next step is **implementation**, not more grilling. Per M.4, begin with the **tracer bullet**: build one complete lesson flowing end-to-end through every system (item DB → lesson player → check → AI grading → FSRS → review → progress), then scale content authoring in parallel with surface build.

Per project convention, the repo is still pre-implementation: confirm stack scaffolding intent before generating code.

---

## Pending Phases

**(none — all design phases resolved.)**

---

## Session conventions

- **Honest pushback over flattery.** User explicitly asked for this.
- **User is not a Japanese expert.** Authoring/review workflows must accommodate.
- **Each grilling question:** 2–4 options with one recommended, defended with reasoning. User picks, pushes back, or clarifies.
- **Decisions log is append-only.** Don't rewrite — add new entries with references when overturning.
