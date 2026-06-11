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

---

## In Progress

### 🔄 Phase K — Confidence + soft signals
- **K.1** Confidence self-rating — ✅ **locked**: optional one-tap "I guessed" flag on recognition items; checked+correct downgrades FSRS rating (Hard not Good); downgrade-only (conservative); no flag on production items
- **K.2** Daily-commitment mechanic — ✅ **locked**: "learning streak" (forgiving), not a login streak. Four properties: (1) meaningful daily requirement = clear due reviews + hit self-set target (fallback = one completed lesson/practice unit when no reviews due); (2) demoted prominence under the J.2 progress hero; (3) decay-anchored honest re-engagement nudge (tied to FSRS due items, not streak-loss guilt); (4) bounded grace. Reframe: redirect streak-gaming so the gamed minimum *is* the highest-value learning act → "come for the streak, stay for the learning"
- **K.3** Remaining soft-signal details — ⏳ pending grilling (grace-freeze cap mechanic; does Practice Mode count toward "day done"; daily-target adjustment over time; notification cadence/quiet-hours; other milestone nudges)

---

## Pending Phases

### Phase L — Tech stack
- Backend language + framework
- Relational DB (likely Postgres)
- Vector DB provider (Pinecone / Weaviate / pgvector / etc.)
- AI provider(s) — Anthropic / OpenAI / multi-provider
- Frontend — web-first vs mobile-first; React / Next / Flutter / native
- Audio + STT provider
- Hosting + infra posture

### Phase M — MVP scope cut + Beta launch slice
- Beta subset of Foundation (e.g., kana + first ~20 grammar + ~200 vocab ≈ 100 lessons)
- Beta modalities (likely defer Speaking-dialogue and Media Learning)
- Beta evaluation surfaces
- Launch sequence

---

## Session conventions

- **Honest pushback over flattery.** User explicitly asked for this.
- **User is not a Japanese expert.** Authoring/review workflows must accommodate.
- **Each grilling question:** 2–4 options with one recommended, defended with reasoning. User picks, pushes back, or clarifies.
- **Decisions log is append-only.** Don't rewrite — add new entries with references when overturning.
