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

---

## In Progress

### ⏳ Phase I — Branching: Track Modules + intake + placement
- **I.1** Track selection rule: single primary + secondary flavor ✅ LOCKED
- **I.2** Track Module catalog ✅ LOCKED via two-dimensional framing:
  - **I.2.a** Content Track (mandatory) × Goal Overlay (optional) as orthogonal intake dimensions
  - **I.2.b** Goal Overlay mechanic: gap-fill + mock-exam Assessments + readiness tracker; overlay adds, never subtracts; compatibility surfaced transparently at intake
  - **I.2.c** Goal Overlay catalog at MVP = {None, JLPT-N4}; N5 redundant with Foundation, N3+ deferred for content depth
  - Content Tracks at MVP: Travel · Anime/Manga · Living/Working · Conversational (default)
- **I.3** Intake survey ✅ LOCKED
  - **I.3.a** Two-touchpoint timing (signup intake + Foundation-Complete intake) ✅
  - **I.3.b** Signup intake — 3 questions (interests multi-select / prior experience / daily target) ✅
  - **I.3.c** Foundation-Complete milestone moment — celebration framing + Q1 Content Track (required, preview cards) + Q2 Goal Overlay (required, inline compatibility warning) + optional "customize more" combined screen (secondary interests + daily target, both skippable) ✅
  - **I.3.d** Intake → placement hand-off — same-session, routed by signup Q2 prior_experience ✅
- **I.4** Placement quiz: PARTIAL — grilling started, paused mid I.4.a
  - **I.4.a** Scope + length: IN-FLIGHT. Assistant recommended **fixed-per-tier with early-exit shortcut + Foundation-items-only depth**. Specifics:
    - `some_kana` tier → ~20-25 kana items, ~2-3 min
    - `fair_amount` / `refresher` tiers → ~40 items (20 vocab / 10 grammar / 10 kanji), ~6-8 min
    - Early-exit: if first 10 items perfect, offer "skip rest, mark mastered" button
    - Depth: Foundation items only (no N4 probing — Track Module unlocks at Foundation Complete regardless)
    - Open alternative: adaptive within tier (rejected as overkill for MVP; FSRS calibrates over time anyway)
    - **User paused here — "I'll come back to this later"**
  - **I.4.b** Format (multi-choice vs typed vs spoken): pending. Likely deferred — recommendation will be multi-choice + short typed for speed; spoken excluded as too high-friction at signup.
  - **I.4.c** Mastery integration (what does passing items DO to Foundation sequence?): pending. Open — mark items "already mastered" (FSRS state with high retention) vs skip entire lessons vs skip entire chapters when all items mastered.

---

## Pending Phases

### Phase I — Branching: Track Modules, intake, placement
- Canonical post-Foundation Track Modules (Travel, Anime, JLPT-N4, Business, etc.)
- Single-primary vs multi-track selection rules (system recommends single primary + spotlight content from secondary interests; user open to combinations)
- Intake survey design
- Placement quiz: scope (what it tests), format, what it controls (skip lessons / skip chapters / gate-by-item-mastery)

### Phase J — Standalone surfaces
- Practice/Quiz Mode design (item pool selection, scoring, no curriculum advancement)
- Progress Dashboard (item-level vs lesson-level views, motivation)
- Media Learning Feature 8 (bring-your-own-YouTube/song): processing pipeline, vocab extraction, runtime lesson generation from media, licensing/legal posture for media sources

### Phase K — Confidence + soft signals
- Confidence self-rating (PRD v1 §9): when collected, how surfaced, whether it influences SRS or stays qualitative
- Streaks, daily targets, motivational nudges

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
