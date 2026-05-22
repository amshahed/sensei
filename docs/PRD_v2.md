# Product Requirements Document (PRD) v2 — DRAFT

# Product: Sensei — AI-Guided Japanese Fluency App
**Version:** v2 draft (work in progress)
**Document Type:** Product Requirements Document
**Status:** DRAFT. Reflects design decisions resolved through Phase H plus I.1-I.3 (track selection rule / Track Module catalog with Content Track × Goal Overlay framing / two-touchpoint intake) plus cross-cutting principles CC.1 and CC.2. Sections that depend on later phases (I.4, J-M) are flagged **TBD** with the responsible phase.

---

# 0. Document Status

This PRD reflects design decisions resolved through Phase H (all per-modality evaluation locked), plus I.1 (single-primary track selection rule), plus I.2 (Track Module catalog — Content Track × Goal Overlay framing), plus I.3 (two-touchpoint intake with signup 3-question survey and Foundation-Complete milestone moment), plus cross-cutting principles CC.1 (multi-language future-proofing) and CC.2 (multi-platform readiness). Phase I.4 (placement quiz) and J-M are still in design.

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
- **Track Modules** (post-Foundation): goal-based branching. Selection rule (I.1): single primary track + multi-select secondary interests for example theming. Switching primary or adding parallel tracks is settings-level.

"Foundation Complete" = pass all chapter Assessments in the Foundation Module. That gates Track Module selection.

**Track selection is two-dimensional at intake (I.2):**

1. **Content Track** (mandatory single-select) — drives the curriculum spine. Catalog at MVP:
   - **Travel** — visitor Japanese (tourist functions)
   - **Anime/Manga** — casual Japanese, pop culture, sentence-final particles
   - **Living/Working in Japan** — combined Business + Daily Life (keigo + civic + workplace)
   - **Conversational Japanese** (default) — balanced register, everyday topics

2. **Goal Overlay** (optional single-select) — credential/exam goal that applies orthogonally on top of any Content Track. Catalog at MVP: {None (default), JLPT-N4}. N5 is redundant with Foundation; N3+ deferred pending content depth.

**Goal Overlay mechanic (I.2.b):** Overlay computes the gap between the chosen Content Track's item set and the exam's required item set, injects supplementary lessons to fill the gap (woven into the spine), adds mock-exam Assessments at checkpoints, and exposes an exam-readiness progress meter. **Overlay adds; never subtracts** — Content Track integrity is preserved.

**Compatibility is surfaced transparently at intake.** Combinations have widely different overlap:
- Conversational + N4 ≈ 90% overlap (overlay barely adds content)
- Anime + N4 ≈ 60-70% overlap (~30-40 supplementary lessons; ~4 spine : 1 supplementary)
- Travel + N4 ≈ 30-40% overlap (~70-90 supplementary lessons; experience tilts toward N4 prep)

The system shows the learner the trade-off before commit and offers to adjust. Honest framing > silent bait-and-switch.

## 3.3 Lesson Anatomy

Every micro-lesson is 3–8 minutes, single concept, and follows a **3-beat structure:**

1. **Teach (1–2 min, authored, frozen).** Concept explanation + canonical example(s). Pedagogical content lives here; runtime AI does not regenerate it. Drafted by AI, reviewed by humans, then static.

2. **Practice (2–5 min, runtime AI, modality-aware).** Interactive practice scoped to lesson type. Learner Q&A and detours live here — AI can take a brief tangent and return to the lesson. Practice is the fluid beat.

3. **Check (30–60 sec, runtime AI).** Quick assessment. Each answer is graded by AI quality (Again / Hard / Good / Easy → FSRS 4-level rating). Updates per-item mastery scores. Feeds spaced repetition.

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

Item IDs are **language-prefixed** (`ja:vocab:猫`, `ja:kanji:食`) to support eventual multi-language expansion without retrofit (see §5 Cross-Cutting Principles).

---

# 4. Data Architecture

## 4.1 Two-Layer Data Model

**Relational DB:**
- Item metadata (vocab readings/meanings/POS, kanji readings/meanings/radicals, grammar patterns/explanations, kana data)
- Mastery scores (per learner, per item) — continuous 0-1 + per-modality breadcrumbs
- Learner progress
- Lesson definitions and item references
- Module / Chapter / Lesson hierarchy
- Corrections log (from authoring workflow)

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
- `item_id` (language-prefixed: `ja:vocab:猫`), `type`, `jlpt_level`, `frequency_rank`, `prerequisites[]`, `tags[]`, `version`, timestamps

Type-specific fields mirror canonical source data (JMdict fields → Vocab; KANJIDIC2 fields → Kanji; community grammar taxonomies → Grammar).

Full sketch in `decisions.md` §E.4.

---

# 5. Cross-Cutting Principles

## 5.1 Multi-Language Future-Proofing

Sensei v1 ships as a Japanese-only product. The architecture is designed so that adding more languages later requires content work, not deep rework.

**Applied now (cheap insurance):**
- Item IDs language-prefixed (`ja:vocab:猫`)
- Foundation scope is a per-Module setting, not a global constant
- Grammar taxonomy is a configurable per-language reference

**Not done now (speculative):**
- Multi-language UX selector
- Per-language content pipelines
- Cross-language mastery sharing
- Polyglot brand

Roughly **30–50% of design is language-agnostic** (architecture, algorithms, workflow); **50–70% is per-language** (content, taxonomy, pronunciation tuning).

## 5.2 Multi-Platform Readiness

The backend is platform-agnostic by construction. All design decisions made so far are either server-side or platform-neutral. Platform-specific concerns (audio capture, IME, offline cache, storage limits) live in client code.

Recommended path: pick one client platform for MVP (web or mobile); expand to others after validation. Specific platform decision: **TBD Phase L (tech stack)**.

---

# 6. Authoring Workflow

The authoring workflow is designed around the constraint that the user is not a Japanese expert. Linguistic correctness is delegated to canonical data sources (JMdict, KANJIDIC2, Tanos) and a future contracted Japanese teacher. The user's role is editorial review: tone, flow, length, naturalness, audio quality, learner-confusion judgment.

## 6.1 End-to-End Pipeline

1. **Skeleton.** AI proposes the chapter skeleton (ordered items + lesson types) from Tanos's N5 grammar order + JMdict frequency rank + prerequisite graph + Genki/Bunpro structural reference. User reviews pacing and proportionality, not item-by-item order.

2. **Drafting.** AI single-pass drafter receives item refs + vector DB example retrieval + lesson type template + recent corrections-log entries (few-shot). Outputs Teach beat + Check beat question pool + Practice beat templates.

3. **Pre-review quality gate.**
   - Structural validation (deterministic, free): field-presence, ref-validity, lesson-type adherence, audio-file existence.
   - AI critic (~$0.05/lesson): second LLM pass against the 9-point checklist before user sees the draft.

4. **User editorial review.** Structured 9-point checklist (tone, length, flow, example feel, audio, lesson-type adherence, item-ref match, theme-tag accuracy, learner-confusion). Pass/fail per. Free-text revision notes per fail. Approve OR send-back-with-notes.

5. **Corrections loop.** Each "send back" creates a `{original_draft, notes, regenerated_version}` log entry. Drafter prompts include recent corrections of the same lesson type as few-shot examples. AI converges on user's editorial taste over time.

6. **Publish gate.** Deferred to Phase M (depends on beta-launch strategy).

7. **Grammar contractor review (v2).** Contracted Japanese teacher reviews ~50 N5 grammar lessons at ~$500–2000. Until then, grammar lessons publish with a "draft explanation" indicator.

## 6.2 Editorial Intensity (Adaptive Sampling)

User reviews:
- **First 3-4 chapters:** 40% random sample + 100% of AI-critic-flagged drafts. Front-loads calibration when critic-vs-user agreement is uncertain.
- **Subsequent chapters:** 20% sample + 100% critic-flagged. Lighter once critic is calibrated against user taste.

**Time estimates:**
- Per lesson: ~3–4 min editorial time (with ~20% regeneration cycles)
- Per chapter (~25 lessons): ~2–3 hours focused work
- Full Foundation (~15 chapters, ~375 lessons): **~9–14 hours total** at adaptive sampling

## 6.3 Authoring UI (TBD implementation)

Requires:
- Skeleton review interface (chapter density / coherence sign-off)
- Draft review surface (checklist + audio playback + send-back-with-notes)
- Corrections log (automated entry, prompt-retrieval interface)
- Publish trigger (per F.6 decision)

## 6.4 Where Human Expertise Is Required

| Concern | Source of correctness | User's role |
|---------|----------------------|-------------|
| Vocab meanings / readings | JMdict | — |
| Kanji metadata | KANJIDIC2 | — |
| Kana | Public reference | — |
| Grammar explanations | Tanos + AI draft → contractor v2 | None at v1; flag risk |
| Tone, flow, length | AI critic + user review | Yes |
| Example feel, learner-confusion | User review (learner-stand-in) | Yes (uniquely valuable here) |

---

# 7. Mastery + Spaced Repetition

## 7.1 Mastery Data Model

Per item per learner:
- `mastery: float (0-1)` — primary SRS input
- `modality_history: {recognition: [pass/fail timeline], recall: [...], production: [...]}` — per-modality breadcrumbs

"Fully mastered" = mastery > threshold AND tested in all modalities with success. Partial = mastered in score but only in some modalities.

**Display layer:** UI stage labels (Apprentice / Guru / Master / Enlightened / Burned) are derived from score ranges. Same data, learner-friendly labels.

## 7.2 SRS Algorithm

**FSRS** (Free Spaced Repetition Scheduler). Modern ML-trained algorithm operating on continuous retention probability. Default parameters at MVP; per-learner calibration happens automatically with use.

## 7.3 Check-Answer → Mastery Rating

Every Check answer is graded by the AI (already in the loop) on a 4-level rating:
- **Easy** — correct, fast, no hesitation
- **Good** — correct, normal effort
- **Hard** — correct but slowly, partial, or required a hint
- **Again** — wrong or skipped

FSRS uses rating + item history + time since last review to update the mastery score.

## 7.4 Review Session Selection

Review meta-lessons select items where FSRS predicts retention < 90% (configurable threshold). Items sorted by lowest predicted retention first (most-at-risk). Session capped at 10–15 items (~5–10 min session). For each item, AI picks the modality to test, favoring the learner's weakest modality from the breadcrumbs.

---

# 8. Evaluation Surfaces

Multiple evaluation contexts; same scoring infrastructure underneath.

**In-curriculum (handled by lesson types):**
- **Check** — every lesson's beat 3. Single-concept micro-assessment. Per §7.3.
- **Review** (meta-type lesson) — scheduled spaced-repetition session. Per §7.4.
- **Assessment** (meta-type lesson) — end-of-chapter gating quiz.

**Out-of-curriculum (separate features, shared infrastructure):**
- **Practice / Quiz Mode** — learner-initiated, on-demand. Doesn't advance the curriculum. **TBD Phase J.**
- **Placement Quiz** — at intake. Sets curriculum starting position. **TBD Phase I.**
- **Confidence Self-Rating** (PRD v1 §9) — qualitative. **TBD Phase K.**

## 8.1 Speaking Evaluation (Locked)

Pipeline: audio in-browser → **Azure Speech (STT + Pronunciation Assessment)** → transcription + per-word confidence + per-phoneme accuracy + overall pronunciation score → bundle + lesson context → AI semantic evaluation → 4-level FSRS rating.

- **Cost:** ~$0.023/min Azure Speech, ~$0.70/year per active learner at 5 min daily.
- **Known gap:** Azure doesn't evaluate Japanese pitch accent. Acceptable at N5; flag for v2+ intermediate.

## 8.2 Writing Evaluation (Locked)

Hybrid pipeline:
1. **Input normalization** (client-side, wanakana): romaji ↔ kana, full-width/half-width.
2. **Tokenization** (server-side, kuromoji — Japanese morphological analyzer that splits sentences into words).
3. **Route by exercise type:**
   - Exact-match (fill-in-blank, reading typing) → deterministic token comparison
   - Open response (translation, free writing) → AI semantic judgment + granular feedback
4. Combined → 4-level FSRS rating per §7.3.

## 8.3 Listening / Reading Evaluation (Locked)

Both reuse existing pipelines based on *answer modality*, not input modality:
- Multi-choice → deterministic match
- Typed response → §8.2 writing pipeline
- Spoken response → §8.1 speaking pipeline

Comprehension questions are authored frozen at draft time (not runtime-generated).

## 8.4 Multi-Item Check Rating (Locked)

When a Check question exercises multiple items:
- **Target item** (the lesson's teaching focus) always gets the full FSRS rating from the answer.
- **Supporting items** get "exposure" credit (non-rating signal, no mastery change) on success.
- **On failure**, AI attempts error attribution. Clearly attributable → that item gets `Hard`/`Again`. Not attributable → target item takes default failure rating; supporting items still get exposure.

---

# 9. Features

## 9.1 Inherited from PRD v1 (with v2 deltas)

Refer to `docs/PRD_v1.md` for descriptions; below are v2 deltas where applicable.

- **Feature 1 — Kana** — implemented as F-Kana lessons
- **Feature 2 — Kanji** — F-Kanji lessons
- **Feature 3 — Grammar** — F-Grammar lessons, with grammar gap mitigation per §6
- **Feature 4 — Listening** — I-Listening lessons (evaluation TBD H.3)
- **Feature 5 — Speaking** — I-Speaking lessons, evaluation via Azure Speech (per §8.1)
- **Feature 6 — Reading** — I-Reading lessons (evaluation TBD H.4)
- **Feature 7 — Writing** — I-Writing lessons (evaluation TBD H.2)
- **Feature 8 — Media Learning** — deferred from MVP first cut. Architecture: **TBD Phase J**.
- **Scenario-based learning** (v1 §8) — I-Scenario lessons

## 9.2 New in v2

- **Intake Survey** — two-touchpoint design (I.3 locked):
  - **Signup intake** (3 questions, ~25-30 sec): interests (multi-select cards), prior experience, daily time target. Drives Foundation example theming, placement quiz routing, and daily session pacing.
  - **Foundation-Complete milestone moment** (~60-90 sec engaged, ~30 sec speed-skippers): celebration framing → Q1 Content Track (required, with preview cards + soft default from signup interests) → Q2 Goal Overlay (required, inline compatibility warning if awkward combo) → optional combined "customize more" screen (secondary interests + daily target adjust, both skippable). Pre-populated soft defaults from signup interests; both optional extras editable in settings anytime.
- **Placement Quiz** — same-session as signup, routed by signup Q2 prior_experience. Total beginners skip entirely; "some kana" gets focused mini-quiz; "fair amount"/"refresher" gets full quiz. **Format + length + scope TBD Phase I.4.**
- **Track Module Selection (post-Foundation)** — driven by Foundation-Complete milestone. Settings-level switching/adding allowed anytime after.
- **Practice / Quiz Mode** — **TBD Phase J**. Standalone evaluation surface, doesn't advance the curriculum.
- **Progress Dashboard** — **TBD Phase J**. Refines PRD v1 §10; emphasizes item-level mastery and modality-specific progress.
- **Internal Authoring UI** — per §6.3.

---

# 10. Out of MVP Scope

(From v1 §13, with v2 additions.)

- Full JLPT preparation modes beyond N5
- Handwriting recognition
- Tutor marketplace
- Multi-user / classroom features
- Live human tutors
- Themed Track Modules requiring licensed media (anime / song lyrics / manga) — at minimum until licensing is sorted
- Polyglot / non-Japanese language support (architecture is forward-compatible; product is not)

---

# 11. Technical Architecture

**Mostly TBD Phase L.** Decisions made so far that touch the stack:

- **Audio + STT:** Azure Speech (STT + Pronunciation Assessment). Per §8.1.
- **Relational DB:** assumed Postgres (definitive choice TBD L).
- **Vector DB:** provider TBD L; candidates Pinecone / Weaviate / pgvector.
- **AI provider:** TBD L; expect multi-provider (Anthropic Claude for drafter/critic likely, OpenAI Whisper as TTS fallback, etc.).
- **Frontend:** TBD L; web-first vs mobile-first per CC.2.
- **TTS:** Azure or OpenAI or Google — TBD L.
- **Hosting + infra posture:** TBD L.

---

# 12. MVP Scope Cut + Beta Launch

**TBD Phase M.** Anticipated direction:
- Beta ships a subset of Foundation (e.g., kana + first ~20 grammar + ~200 vocab ≈ ~100 lessons), not the full ~300–500 lesson Foundation.
- Beta modalities likely defer Speaking-dialogue and Media Learning.
- Beta evaluation likely defers Practice/Quiz Mode standalone surface.
- Beta is invite-only / closed for early feedback before scaling.
- Publish gate logic (lesson-by-lesson vs chapter-batch vs module-batch) decided here, not in Phase F.

---

# 13. Success Metrics

(Inherited from v1 §15. Augmented with mastery-curve and modality-specific metrics now that Phase G is locked.)

- Item-mastery acquisition rate (items reaching `mastery > 0.8`)
- Per-modality breadcrumb completeness (avoid recognition-only mastery)
- FSRS predicted-retention curves (target 90% retention at scheduled reviews)
- Speaking pronunciation score distribution (catch learners stalling at low Azure scores)
- Lesson completion rate (the micro-lesson scale should make this high)
- Beta editorial-review burden vs target (~9–14 hours total at adaptive sampling)

---

# 14. Risks (v2 amendments to v1 §16)

**R1 — Grammar explanation accuracy (per §6).** AI-drafted grammar explanations are not expert-reviewed at v1/beta. Mitigated by Tanos-taxonomy grounding + beta user feedback + contracted teacher review at v2. **Flagged on the launch checklist.**

**R2 — Foundation scale.** ~300–500 lessons is a real authoring effort even with AI drafting. Mitigated by MVP scope cut (beta ships a subset) and AI-drafted/user-edited workflow.

**R3 — Speech recognition accuracy** (inherited from v1). Now bounded by Azure Speech behavior; revisit if accuracy issues surface in beta.

**R4 — Content licensing for themed corpora** (anime, song lyrics, manga). Affects post-Foundation Track Modules. **TBD Phase J.**

**R5 — Vector DB cost at scale.** Tier 1 corpora are bounded, but embedding refresh and per-query cost grow with active users. Monitor; revisit Phase L.

**R6 — Tae Kim NC clause.** Tae Kim's Guide is CC-BY-NC-SA. The NC (non-commercial) clause may be violated by ingesting into a commercially monetized app. Re-evaluate before commercialization; may need to use as reference rather than reproduce inline.

**R7 — Japanese pitch accent not evaluated.** Azure Speech doesn't score pitch accent; learners may develop unnatural prosody. Acceptable at N5; revisit at intermediate Japanese expansion.

**R8 — Adaptive sampling under-catches early issues.** If the AI critic is poorly calibrated initially, the 40%-then-20% sampling may let too many quality issues ship before correction. Mitigation: extend the 40% window if first 3-4 chapters show high disagreement between user review and critic verdicts.

---

# 15. Next Steps

Continue the design grilling through Phase I.4 (placement quiz), then J–M.

Current open phase: **I — Branching: Track Modules + intake + placement**, specifically **I.4 (Placement quiz)**. With I.3 locked (two-touchpoint intake + signup 3-Q + Foundation-Complete milestone moment + same-session placement hand-off), I.4 resolves the placement quiz format, length, scope, and what mastery signal it produces. See `decisions.md` §I.3 for the upstream intake design and `progress.md` for live status.
