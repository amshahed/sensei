# Product Requirements Document (PRD) v2 — DRAFT

# Product: Sensei — AI-Guided Japanese Fluency App
**Version:** v2 draft (work in progress)
**Document Type:** Product Requirements Document
**Status:** DRAFT. Reflects design decisions resolved through Phase E of the structured design grilling. Sections that depend on later phases are flagged **TBD** with the responsible phase.

---

# 0. Document Status

This PRD reflects design decisions resolved through Phase E. Phases F–M are still in design; sections that depend on them are marked TBD.

**Companion documents:**
- `decisions.md` — append-only decision log with reasoning for every resolved decision
- `progress.md` — live status tracker for completed, in-progress, and pending phases
- `docs/PRD_v1.md` — original product vision, preserved as historical

This PRD supersedes v1 in the areas it covers. Sections inherited unchanged from v1 reference v1 directly.

---

# 1. Product Vision

(Unchanged from v1 §1 — see `docs/PRD_v1.md`.)

Mission: enable users to understand and use real Japanese in daily life across conversations, YouTube, songs, social media, articles, anime, and real-world interactions. Real comprehension and speaking ability over memorization.

---

# 2. Product Philosophy

(Inherited from v1 §5.)

Five principles:
1. Learn through usage
2. Speak early
3. Learn from real content
4. Grammar supports communication
5. Confidence drives progress

## 2.1 v2 amendment — anti-fake-personalization positioning

The app does NOT promise personalization from minute one.

The first ~JLPT N5 of content is shared by every learner regardless of stated goal. Personalization within Foundation is limited to themed example sentences in lessons and occasional spotlight chapters tied to interests.

This is intentional product differentiation, positioned honestly:

> "If other apps promise personalization from the first lesson, they are either lying or providing useless variation. You need foundations first."

After Foundation, real branching by goal kicks in via Track Modules.

---

# 3. Architecture Summary

## 3.1 Hybrid AI Curriculum

**Fixed scaffold + AI-generated content within.**

- Curriculum has an authored skeleton (Module → Chapter → Lesson hierarchy) with learning objectives per lesson.
- AI generates the *interactive* parts of lessons at runtime — Practice questions, dialogue prompts, learner Q&A responses, speaking and writing evaluation feedback.
- The *pedagogical core* of each lesson (concept explanations, canonical examples, conjugation tables) is authored ahead of time (AI-drafted, human-reviewed, then frozen) so that grammar correctness is stable and not subject to LLM hallucination.

## 3.2 Two-Phase Learning Journey

- **Foundation Module** (≈ JLPT N5): every learner completes this. ~300–500 micro-lessons covering hiragana, katakana, ~800 vocab, ~100 kanji, ~50 grammar points + Integration lessons across modalities.
- **Track Modules** (post-Foundation): goal-based branching. Examples: Travel, Anime, Exam-N4, Business. Specific Track Module catalog: **TBD Phase I**.

"Foundation Complete" = pass all chapter Assessments in the Foundation Module. That gates Track Module selection.

## 3.3 Lesson Anatomy

Every micro-lesson is 3–8 minutes, single concept, and follows a **3-beat structure:**

1. **Teach (1–2 min, authored, frozen).** Concept explanation + canonical example(s). Pedagogical content lives here; runtime AI does not regenerate it. Drafted by AI, reviewed by humans, then static.

2. **Practice (2–5 min, runtime AI, modality-aware).** Interactive practice scoped to lesson type. Learner Q&A and detours live here — AI can take a brief tangent and return to the lesson. Practice is the fluid beat.

3. **Check (30–60 sec, runtime AI).** Quick assessment. Updates per-item mastery scores. Feeds spaced repetition.

## 3.4 Lesson Taxonomy

**Foundational** (teaches new atoms):
- F-Kana — hiragana / katakana intro + recognition + writing
- F-Vocab — new word + meaning + sound + spelling
- F-Kanji — character + readings + meaning + first contextual use
- F-Grammar — one grammar pattern + canonical use cases

**Integration** (exercises existing knowledge in real contexts):
- I-Listening — audio → comprehension
- I-Speaking — pronunciation + dialogue with AI
- I-Reading — text passage → comprehension
- I-Writing — translation + response writing
- I-Scenario — mixed-modality real-world situations (e.g., ordering food, asking directions)

**Meta-types:**
- Review — scheduled spaced-repetition session over learned items
- Assessment — end-of-chapter / unit gating quiz

**Note:** Media Learning (PRD v1 Feature 8) is a **tool**, not a lesson type. Learner-driven activity (bring-your-own YouTube clip / song). Handled separately. Details: **TBD Phase J**.

## 3.5 Curriculum Hierarchy

Module → Chapter → Lesson. 3 levels.

- **Module** = a track. Foundation, Travel, Anime, Exam-N5, etc.
- **Chapter** = a coherent topic group. Hiragana, Basic Particles, Te-form, Ordering Food.
- **Lesson** = atomic 3–8 min single-concept unit.

## 3.6 Items as First-Class Entities

Mastery, spaced repetition, source indexing, and assessments all attach to **items** — NOT lessons.

Four item types:
- **Kana** — character + sound + writing form (~92 items)
- **Vocab** — word + readings + meanings + POS + audio + examples. Multi-word set expressions live here with `multi_word: true`.
- **Kanji** — character + on/kun readings + meanings + stroke count + radicals + frequency rank
- **Grammar** — pattern + template + explanation + nuance + register + examples

Lessons reference items. Items are reused across lessons; mastery is tracked once per item per learner.

---

# 4. Data Architecture

## 4.1 Two-Layer Data Model

**Relational DB:**
- Item metadata (vocab readings/meanings/POS, kanji readings/meanings/radicals, grammar patterns/explanations, kana data)
- Mastery scores (per learner, per item)
- Learner progress
- Lesson definitions and item references
- Module / Chapter / Lesson hierarchy

**Vector DB:**
- Unstructured reference material indexed by embedding
- Used for: runtime RAG (learner Q&A grounding, themed example retrieval, future media learning)

## 4.2 Data Sources

**Canonical structured data → relational DB:**
- Vocab → JMdict (CC-BY-SA, ~190K entries)
- Kanji → KANJIDIC2
- Kana → public reference data
- Grammar → community taxonomy (Tanos JLPT lists) + AI-drafted explanations grounded in textbook taxonomy
- Audio → TTS (Google / Azure / OpenAI Speech)

**Vector DB Tier 1 (MVP):**
- Tatoeba Japanese sentence corpus (CC-BY 2.0, filtered) — for runtime example retrieval
- AI-drafted grammar reference corpus — for learner Q&A grounding
- NHK News Easy + similar graded-Japanese reading corpora — for I-Reading lessons

**Vector DB Tier 2 (later):**
- Themed corpora (anime, song lyrics, manga, podcast transcripts) — licensing-dependent; for Track Modules
- Indexed authored lesson content — cross-lesson continuity
- Learner ↔ AI conversation history — long-term tutor coherence

**Vector DB Tier 3 (probably never):**
- Copyrighted textbook content (Genki, Tobira) — legal risk too high

## 4.3 Licensing Posture

Strict separation between **legally ingestible** and **personal reference only.**

**Legally ingestible (vector DB candidates):**
- Tae Kim's Guide to Japanese Grammar (CC-BY-NC-SA) ⚠ NC clause — re-evaluate on commercialization
- Tanos JLPT lists
- Wikipedia + Wiktionary (CC-BY-SA)
- Japan Foundation Marugoto open materials
- Tatoeba (CC-BY 2.0)
- NHK News Easy (verify TOS)

**Personal reference only (do NOT ingest):**
- *A Dictionary of Basic Japanese Grammar* (Makino & Tsutsui) ~$30
- *A Handbook of Japanese Grammar Patterns* (Chino) ~$25
- Genki I + II ~$80 combined
- Total ~$200 budget. Used to inform AI prompt design and the user's pedagogical mental model. Their text never appears in the app.

**Underlying principle:** Purchase = read rights, not distribution rights. Copyright protects specific expression (text, examples, illustrations). It does NOT protect facts or taxonomies — lesson order can resemble Genki's without infringement.

## 4.4 Item Schemas (sketch — iterates during authoring)

Common fields per item:
- `item_id`, `type`, `jlpt_level`, `frequency_rank`, `prerequisites[]`, `tags[]`, `version`, timestamps

Type-specific fields mirror canonical source data (JMdict fields → Vocab; KANJIDIC2 fields → Kanji; community grammar taxonomies → Grammar).

Full sketch in `decisions.md` §E.4.

---

# 5. Authoring Workflow

**Direction (mid-Phase F grilling — pending user confirmation):**

- AI drafts each lesson's content (Teach beat + Check beat questions + Practice beat templates) from item data + vector DB references.
- User reviews for **editorial quality** (tone, flow, length, naturalness, audio plays) — NOT linguistic correctness.
- **Linguistic correctness is delegated to canonical data sources** (JMdict / KANJIDIC2 / Tanos), which are pre-vetted.
- Grammar lessons specifically deferred to contracted Japanese teacher review at v2 (~50 N5 grammar points, ~$500–2000 budget).
- Corrections log feeds future AI drafts — AI converges on the user's editorial taste over time without requiring linguistic expertise.

**User constraint:** the user is not a Japanese teacher. The workflow must produce linguistically correct content without depending on the user's linguistic expertise.

Full details: **TBD Phase F** (workflow specifics, authoring UI, contractor onboarding, corrections-log mechanics).

---

# 6. Evaluation Surfaces

Multiple evaluation contexts; same scoring infrastructure underneath.

**In-curriculum (handled by lesson types):**
- **Check** — every lesson's beat 3. Single-concept micro-assessment.
- **Review** (meta-type lesson) — scheduled spaced-repetition session.
- **Assessment** (meta-type lesson) — end-of-chapter gating quiz.

**Out-of-curriculum (separate features, shared infrastructure):**
- **Practice / Quiz Mode** — learner-initiated, on-demand. Doesn't advance the curriculum.
- **Placement Quiz** — at intake. Sets curriculum starting position.
- **Confidence Self-Rating** (PRD v1 §9) — qualitative.

Per-modality scoring mechanics (speaking, writing, listening, reading): **TBD Phase H**.

---

# 7. Features

## 7.1 Inherited from PRD v1 (with v2 deltas)

Refer to `docs/PRD_v1.md` for descriptions; below are v2 deltas where applicable.

- **Feature 1 — Kana** — implemented as F-Kana lessons
- **Feature 2 — Kanji** — F-Kanji lessons
- **Feature 3 — Grammar** — F-Grammar lessons, with grammar gap mitigation per §5
- **Feature 4 — Listening** — I-Listening lessons
- **Feature 5 — Speaking** — I-Speaking lessons (STT provider TBD Phase H)
- **Feature 6 — Reading** — I-Reading lessons
- **Feature 7 — Writing** — I-Writing lessons
- **Feature 8 — Media Learning** — deferred from MVP first cut. Architecture: **TBD Phase J**.
- **Scenario-based learning** (v1 §8) — I-Scenario lessons

## 7.2 New in v2

- **Intake Survey + Placement Quiz** — **TBD Phase I**. Sets initial Foundation entry point + records primary goal for eventual Track Module selection.
- **Track Module Selection (post-Foundation)** — **TBD Phase I**.
- **Practice / Quiz Mode** — **TBD Phase J**. Standalone evaluation surface, doesn't advance the curriculum.
- **Progress Dashboard** — **TBD Phase J**. Refines PRD v1 §10; emphasizes item-level mastery and modality-specific progress.
- **Internal Authoring UI** — for the user-as-editor workflow. **TBD Phase F**.

---

# 8. Out of MVP Scope

(From v1 §13, with v2 additions.)

- Full JLPT preparation modes beyond N5
- Handwriting recognition
- Tutor marketplace
- Multi-user / classroom features
- Live human tutors
- Themed Track Modules requiring licensed media (anime / song lyrics / manga) — at minimum until licensing is sorted

---

# 9. Technical Architecture

**TBD Phase L.** Open decisions:
- Backend language + framework
- Relational DB provider (likely Postgres)
- Vector DB provider (Pinecone / Weaviate / pgvector / etc.)
- AI provider(s) — Anthropic / OpenAI / multi-provider
- Frontend — web-first vs mobile-first; React / Next / Flutter / native
- Audio + STT provider
- Hosting + infrastructure posture

---

# 10. MVP Scope Cut + Beta Launch

**TBD Phase M.** Anticipated direction:
- Beta ships a subset of Foundation (e.g., kana + first ~20 grammar + ~200 vocab ≈ ~100 lessons), not the full ~300–500 lesson Foundation.
- Beta modalities likely defer Speaking-dialogue and Media Learning.
- Beta evaluation likely defers Practice/Quiz Mode standalone surface.
- Beta is invite-only / closed for early feedback before scaling.

---

# 11. Success Metrics

(Inherited from v1 §15. Will be augmented with item-mastery-curve metrics, modality-specific accuracy targets, and retention curves once Phases G & H land.)

---

# 12. Risks (v2 amendments to v1 §16)

**R1 — Grammar explanation accuracy (per §5).** AI-drafted grammar explanations are not expert-reviewed at v1/beta. Mitigated by Tanos-taxonomy grounding + beta user feedback + contracted teacher review at v2. **Flagged on the launch checklist.**

**R2 — Foundation scale.** ~300–500 lessons is a real authoring effort even with AI drafting. Mitigated by MVP scope cut (beta ships a subset) and AI-drafted/user-edited workflow.

**R3 — Speech recognition accuracy** (inherited from v1).

**R4 — Content licensing for themed corpora** (anime, song lyrics, manga). Affects post-Foundation Track Modules. **TBD Phase J.**

**R5 — Vector DB cost at scale.** Tier 1 corpora are bounded, but embedding refresh and per-query cost grow with active users. Monitor; revisit Phase L.

**R6 — Tae Kim NC clause.** Tae Kim's Guide is CC-BY-NC-SA. The NC (non-commercial) clause may be violated by ingesting into a commercially monetized app. Re-evaluate before commercialization; may need to use as reference rather than reproduce inline.

---

# 13. Next Steps

Continue the design grilling through Phases F–M. Update this PRD as decisions resolve.

Current open phase: **F (lesson schemas + authoring workflow)**, mid-grilling. See `progress.md`.
