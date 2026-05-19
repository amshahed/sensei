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

---

## In Progress

### ⏳ Phase F — Lesson schemas + authoring workflow

**Lesson schemas:** tentatively follow the same "sketch + iterate during authoring" approach as items. Not flagged as a separate grilling sub-decision unless the user pushes back.

**Authoring workflow (active sub-decision):** last AskUserQuestion was paused for clarification. Open options under consideration:

- **AI drafts → user edits → ship; grammar contractor in v2 (recommended).** AI generates Teach/Check/Practice content from item data + vector DB. User reviews for tone/flow/audio/item-ref correctness — not linguistic accuracy. Corrections log trains future drafts. Grammar lessons publish with a "draft explanation" indicator until a contracted Japanese teacher reviews them.
- Pure AI auto-publish (rejected outright, but listed for completeness)
- Pure human authoring (blocked by user's non-expertise)
- AI drafts + community review only (skip user editorial review — supplement to Rec, not replacement)

**User's pending angles for clarification (from the pause):**
- The "skeleton" step is under-specified: who designs the chapter structure (which 8 lessons in what order)? AI-drafted with user reviewing structure, or human-authored?
- Contractor scope/cost concretization
- What "user as editorial reviewer" actually catches if user doesn't speak Japanese well — concrete review checklist
- Corrections log + AI improvement loop mechanics (fine-tune? in-context examples? rule-based?)
- Workflow shapes not yet considered

---

## Pending Phases

### Phase G — Mastery scoring + Spaced repetition
- Per-item mastery score model (continuous 0-1 vs discrete SRS stages vs per-modality sub-scores)
- Spaced repetition algorithm (SM-2 / FSRS / custom)
- How Check beat updates mastery scores
- How Review meta-lessons select items

### Phase H — Per-modality evaluation
- Speaking: STT provider, pronunciation scoring approach, dialogue evaluation
- Writing: correctness checking (Japanese morphology, romaji-to-kana, grammar), feedback granularity
- Listening: comprehension scoring
- Reading: comprehension scoring
- How each modality feeds Check beat → mastery update

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
