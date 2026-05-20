# Sensei Design Decisions Log

Append-only log of every design decision resolved during the structured grilling sessions. Each entry includes the question, the chosen answer, alternatives considered, and the reasoning.

**Conventions:**
- Entries are append-only. If a decision is overturned, add a new entry referencing the older one.
- Phase IDs map to the task list and `progress.md`.
- "Why not X" entries are kept because the rejected paths are often re-proposed later.

---

## Phase A — Core design philosophy

### A.1 How dynamic is the system?

**Decision:** Hybrid B + phased C.
- **Foundation phase:** Option B — fixed scaffold (Module → Chapter → Lesson skeleton with learning objectives per lesson), AI generates the *content* within the scaffold (examples, dialogues, exercises, prompts).
- **Post-Foundation phase:** Option C — AI-curated paths by learner goal (Travel, Anime, JLPT-N4, Business, etc.).

**Why:** Japanese has hard pedagogical prerequisites — can't teach て-form requests before stem forms; can't teach manga before kana + ~100 kanji. For the first ~200 hours, every learner needs the same foundations regardless of stated goal, so "personalization" at beginner level is theatrical. Branching becomes substantive at intermediate level when goals genuinely diverge.

**Rejected:**
- Fully static + AI tutor only — leaves the biggest personalization lever (content within lessons) on the table.
- Full AI-curated path from day 1 — personalization at beginner is fake; underestimates how badly learners flounder without a visible spine; bets against decades of pedagogical sequencing.
- Tutor-with-textbook (no lesson structure) — no clear "done" state → no progress signal → no spaced repetition → no retention.

### A.2 When does the AI generate lesson content?

**Decision:** Hybrid — authored core + runtime interactive.

- **Authored (frozen):** Concept explanations, canonical examples, conjugation tables. AI-drafted, human-reviewed, then static.
- **Runtime AI:** Practice questions, dialogue prompts, learner Q&A, evaluation/feedback on speaking and writing.

**Why:** Pedagogical content is too important to regenerate — an LLM hallucinating a grammar rule erodes trust permanently. Interactive content is where personalization actually pays off and where novelty helps. Hybrid gives pedagogical safety + personalization upside + manageable cost + tractable QA.

**Rejected:**
- Pure runtime generation — too expensive, hallucination risk on foundational content (e.g., regenerating kana conjugation tables every session).
- Pure authoring-time — throws away the entire reason for using AI.
- Bucketed pre-generation per goal — 5× content authoring burden; personalization is coarse.

---

## Phase B — Lesson structure

### B.1 Lesson size

**Decision:** Micro-lessons (3–8 min, single concept per lesson).

**Why:** Mobile-first behavior favors short sessions. Single-concept atoms are clean — easier to author, easier for AI to scope Practice, easier to schedule for spaced repetition. "I finished a lesson today" is the strongest possible motivation loop. Duolingo / Bunpro validated this at scale.

**Trade-off accepted:** ~300–500 micro-lessons in Foundation. Some concepts (passive form, transitive/intransitive pairs, は vs が) don't fit in 5 min — split across linked micro-lessons or accept 10–15 min outliers.

**Rejected:** Standard 15–25 min lessons (kills daily completion rate); long 45+ min lessons (mismatches consumer mobile); variable AI-determined (breaks user planning, kills satisfaction of finishing).

### B.2 Lesson anatomy

**Decision:** 3-beat structure — Teach → Practice → Check.

- **Teach (1–2 min, authored, frozen):** Concept explanation + canonical example(s). Pedagogical content lives here; runtime AI does not regenerate it.
- **Practice (2–5 min, runtime AI, modality-aware):** Interactive practice scoped to lesson type. **Learner Q&A and detours live in this beat** — AI can take a brief tangent and return to the lesson. Practice is the fluid beat, not a rigid script.
- **Check (30–60 sec, runtime AI):** Quick assessment. Updates per-item mastery. Feeds spaced repetition scheduling.

**Why:** Clear "done" state → retention tracking works. Practice absorbs the learner's questions and AI's detours, with structure surrounding it. Hooks aren't per-lesson because consecutive lessons in the same area would feel padded — motivational hooks live at the chapter level via dedicated chapter-intro lessons.

**Rejected:** 4-beat with per-lesson Hook (padding); open-ended dialogue (no done state); per-modality custom templates (modality belongs *inside* Practice, not as a separate skeleton).

### B.3 Lesson taxonomy

**Decision:** Two-tier taxonomy + meta-types.

**Foundational (teaches new atoms):**
- F-Kana — hiragana / katakana intro + recognition + writing
- F-Vocab — new word + meaning + sound + spelling
- F-Kanji — character + readings + meaning + first contextual use
- F-Grammar — one grammar pattern + canonical use cases

**Integration (exercises existing knowledge in real contexts):**
- I-Listening — audio → comprehension
- I-Speaking — pronunciation + dialogue with AI
- I-Reading — text passage → comprehension
- I-Writing — translation + response writing
- I-Scenario — mixed-modality real-world situations (PRD v1 §8)

**Meta-types:**
- Review — scheduled spaced-repetition session over learned items
- Assessment — end-of-chapter / unit gating quiz

**Why:** The Foundational vs Integration split captures real prerequisite logic: F-lessons gate further learning (you can't do Integration on items you haven't learned); I-lessons are scheduling-flexible once prerequisites are met. Skill-centric taxonomy (just L/S/R/W) erases what's being taught at Foundation. Untyped taxonomy makes the runtime AI Practice contract become "do whatever," exploding quality variance.

**Note:** Media Learning (PRD v1 Feature 8) is a **tool**, not a lesson type. It's a learner-driven activity (bring your own YouTube clip / song) that processes media for vocab + grammar breakdown. Handled separately under Phase J.

### B.4 Curriculum hierarchy

**Decision:** Module → Chapter → Lesson. 3 levels. Drop "Section."

- **Module** = a track. Foundation Module, Travel Module, Anime Module, Exam-N5 Module, etc. Post-Foundation branching maps cleanly here.
- **Chapter** = a coherent topic group. Hiragana, Basic Particles, Te-form, Ordering Food, etc. ~15–40 lessons each.
- **Lesson** = atomic 3–8 min unit, single concept.

**Why:** The "Section" tier from PRD v1's original `module → chapter → section → lesson` framing is redundant for the lesson scales we're working at. When you'd want sub-grouping, you can just split into more granular chapters. Add depth only if individual chapters routinely exceed ~50 lessons — premature for MVP.

---

## Phase C — Curriculum scope (Foundation boundary)

### C.1 What's in Foundation, and where does it end?

**Decision:** Foundation ≈ PRD v1 Phase 0 + Phase 1 ≈ JLPT N5.

**Contents:**
- All hiragana + katakana → ~20 kana lessons (after grouping)
- ~800 high-frequency vocab → ~80–160 vocab lessons
- ~100 N5 kanji + readings → ~100 kanji lessons
- ~50 core grammar points (basic sentence patterns, particles, all major verb conjugations, basic adjective forms, requests) → ~50–80 grammar lessons
- Integration lessons (listening / speaking / reading / writing) layered through chapters
- Review + Assessment meta-lessons interspersed

**Total:** ~300–500 Foundation lessons.

**"Foundation Complete" = pass all chapter Assessments in the Foundation Module.** At that point, learner is invited to pick Track Module(s).

**Why N5 (not less):** Phase 0 alone is too thin — branched tracks at that level are anemic. A traveler can barely say "where is the bathroom," an anime fan can barely understand one line.

**Why N5 (not more):** Going to N4 delays branching by another ~300 lessons. Motivation depends on seeing personalized content within months, not 6+ months. Spotlight lessons during Foundation provide tasteful per-chapter personalization without paying for full branching.

**Rejected:** No-fixed-Foundation (branch from day 1) — kana would have to live in every track, prerequisite logic duplicates, and the anti-fake-personalization marketing posture disappears.

---

## Phase D — Data model

### D.1 Mastery unit

**Decision:** Items are first-class entities. Mastery, spaced repetition, source indexing, and assessments all attach to items, NOT lessons. Lessons reference items.

**Why:**
- Spaced repetition needs item-level granularity. A learner finishes a 5-vocab lesson with 90% mastery on 3 items and 40% on 2 — SR re-tests the weak ones, not the whole lesson.
- The vector DB indexes by item, not lesson. Theme-specific queries (e.g., "anime-themed example of て-form-requests") use item IDs as primary keys.
- Assessments test items. "Passed chapter 4" = "demonstrated mastery on chapter 4's items."
- Cross-lesson reuse only counts correctly if mastery attaches to items. The vocab 食べる appears in many lessons; lesson-level mastery would multi-count.
- Industry standard: Anki, Wanikani, Bunpro all work this way.

**Rejected:** Lesson-as-mastery-unit (cripples SR + vector DB + cross-lesson reuse); dual lesson+item tracking (adds complexity for marginal value; one or the other drifts).

### D.2 Item types

**Decision:** Four item types — Kana, Vocab, Kanji, Grammar.

- **Kana**: character + sound (audio) + writing form. ~92 items total (hiragana 46 + katakana 46; digraphs and dakuten are derivative).
- **Vocab**: word + reading(s) + meaning(s) + part-of-speech + audio + example sentences. Set expressions (こんにちは, いただきます) live here with a `multi_word: true` flag.
- **Kanji**: character + on-readings + kun-readings + meanings + stroke count + radicals + frequency rank. ~100 in Foundation; ~2,200 if eventually full Jōyō.
- **Grammar**: pattern name + structural template + explanation + nuance + canonical examples + register notes. ~50 in Foundation.

**Why:**
- Wanikani's radical-as-separate-type model is appropriate for kanji-acquisition apps; overkill for a broader fluency app.
- Phrases have ~95% schema overlap with Vocab; a `multi_word` flag is sufficient.
- Particles and conjugation rules fit inside Grammar items.
- Untyped tag-based items push type-specific logic into prompts → inconsistent runtime quality.

**Open nuance:** Kanji mastery is on the whole character for MVP. Per-reading mastery (a Wanikani-style refinement) can be added at intermediate levels if needed.

---

## Phase E — Item data layer

### E.1 Data sourcing

**Decision:** Curate from canonical open Japanese-language datasets + AI-assisted enrichment + human editorial review (NOT linguistic review — see user constraint below).

- **Vocab** → JMdict (Japanese-Multilingual Dictionary, CC-BY-SA, ~190K entries, decades of professional lexicographer maintenance).
- **Kanji** → KANJIDIC2 (full metadata: readings, meanings, stroke counts, radicals, frequency rank, JLPT level).
- **Kana** → public reference data (~92 characters, trivial).
- **Grammar** → community taxonomy (Tanos JLPT lists) + AI-drafted explanations grounded in textbook taxonomy (Bunpro / Genki referenced, NOT copied).
- **Example sentences** → Tatoeba (~1M Japanese sentences with translations, CC-BY 2.0), filtered + AI-augmented for theme-tagged examples.
- **Audio** → TTS via Google / Azure / OpenAI Speech.

**User constraint surfaced during this phase:** the user is not a Japanese teacher and cannot perform expert linguistic review. The design accommodates:
- Canonical linguistic facts (vocab meanings, kanji readings, kana sounds) → **no user review needed**. Pre-vetted in canonical datasets.
- Example sentences + lesson flow → **user reviews for editorial quality** (tone, flow, length, naturalness), NOT linguistic correctness.
- Grammar explanations → known gap. Bridged phased:
  - **v1 / beta:** AI-drafted, grounded in Tanos taxonomy + Tae Kim corpus. Beta users surface confusion; iterate.
  - **v2 / pre-public-launch:** contract a Japanese teacher for ~50 N5 grammar points review (~$500–2000 budget). Add corrections to a corrections log; AI rewrites future grammar items in line with corrections.
- This is logged as a launch-checklist risk: "Grammar explanations not yet expert-reviewed."

**Why not pure AI:** hallucinates ground-truth linguistic data; silent failure mode (wrong reading served confidently); you'd have to verify against canonical sources anyway.
**Why not author from scratch:** duplicates decades of professional lexicography work.
**Why not commercial license:** no commercial offering beats JMdict / KANJIDIC2 at indie scale. (Commercial licensing matters later for media — anime subs, song lyrics — not for this layer.)

### E.2 Licensing posture for reference materials

**Decision:** Strict separation between **legally ingestible** (vector DB candidates) and **personal reference only** (do NOT ingest).

**Legally ingestible:**
- **Tae Kim's Guide to Japanese Grammar** — CC-BY-NC-SA. Comprehensive N5–N3 grammar reference. ⚠ NC clause: re-evaluate when the app commercializes; may need to use as reference rather than reproduce.
- **Tanos JLPT grammar / vocab / kanji lists** — free, community-maintained. Use as authoritative taxonomy of what to teach per level.
- **Wikipedia + Wiktionary** — CC-BY-SA. Surprising amount of grammar / usage info.
- **Japan Foundation Marugoto materials** — some open educational content. Worth investigating.
- **Tatoeba** — CC-BY 2.0.
- **NHK News Easy** — verify TOS; if usable, good source for graded reading content.

**Personal reference only (DO NOT ingest):**
- *A Dictionary of Basic Japanese Grammar* (Makino & Tsutsui) — ~$30
- *A Handbook of Japanese Grammar Patterns for Teachers and Learners* (Chino) — ~$25
- Genki I + II — ~$80 combined
- Total budget: ~$200. Used to inform AI prompt design, calibrate the user's pedagogical mental model, and verify edge cases. **Their specific text never appears in the app.**

**Not worth pursuing:**
- Bunpro / WaniKani / Tofugu data licenses — these are consumer products, not licensable data vendors at indie scale.
- Multiple JLPT prep books for ingestion — illegal anyway.

**Underlying principle:** "Purchase = read rights, not distribution rights." Copyright protects specific expression (text, examples, illustrations, exercises). It does NOT protect facts (Japanese is what it is) or taxonomies (lesson sequencing). Lesson order can resemble Genki's without infringement; Genki's specific dialogues cannot appear in the app.

**On AI paraphrasing copyrighted text:** unsettled law (publishers vs. AI providers actively litigating). Conservative-and-correct stance for an indie: do NOT ingest copyrighted textbook content even for AI grounding. Lawsuit cost > content value.

### E.3 Vector DB scope

**Decision:** Reference corpora only in vector DB; structured item data lives in the relational DB.

**Two layers, kept architecturally separate:**

1. **Relational DB** — vocab/kanji/grammar item metadata, mastery scores, learner progress, lesson definitions, hierarchy. Indexed by item_id. Sourced from JMdict / KANJIDIC2.
2. **Vector DB** — unstructured passages, example sentences, grammar reference text, themed corpora. Indexed by embedding. Used for runtime RAG (learner Q&A grounding, themed example retrieval, future media learning).

**Tier 1 (MVP):**
- Tatoeba (filtered) — for runtime example retrieval, varied practice content
- AI-drafted grammar reference corpus (taxonomy-grounded) — for learner Q&A
- NHK News Easy + similar graded-Japanese reading corpora — for I-Reading lessons

**Tier 2 (later):**
- Anime / song / manga / podcast corpora (licensing-dependent) — for themed spotlights + post-Foundation Track Modules
- Past authored lesson content (vector-indexed) — for AI cross-lesson continuity ("learner saw this example in lesson 23")
- Learner ↔ AI conversation history — for long-term tutor coherence

**Tier 3 (probably never):**
- Copyrighted textbooks (Genki, Tobira) — legal risk too high.

**Why:** Item data is structured; semantic search is the wrong tool for "what does 食べる mean." Exact lookup by item_id is faster, cheaper, exact. The vector DB earns its keep where retrieval-by-meaning beats retrieval-by-key.

### E.4 Item schema density

**Decision:** Sketch below + iterate during authoring. Don't pre-engineer fields for use cases that don't exist yet, but include the fields that are cheap-to-add-now and load-bearing-later (tags, prerequisites).

**Common fields (all items):**
```
item_id        // "vocab:猫", "kanji:食", "grammar:te-form-request"
type           // {kana, vocab, kanji, grammar}
jlpt_level     // N5..N1 or null
frequency_rank // int or null
prerequisites  // item_id[] — items that should be mastered first
tags           // ["food", "anime", "travel"] — for theme retrieval
created_at, updated_at, version
```

**Type-specific (sketch, mirroring canonical sources):**
- **kana**: script (hira/kata), character, romaji, audio_ref, stroke_count
- **vocab**: writing_forms[], readings[], senses[{meanings, POS, register, notes}], audio_ref, example_sentences[{ja, en, sourced_from, item_refs}], multi_word
- **kanji**: character, meanings[], on_readings[], kun_readings[], stroke_count, radicals[], example_vocab (item_refs)
- **grammar**: pattern_name, pattern_template, explanation (AI-drafted), nuance_notes, register, canonical_examples[{ja, en, item_refs}], common_mistakes, contrasted_with (item_refs)

**Why:** Tags + prerequisites are load-bearing later (theme retrieval, lesson sequencing) and cheap now. Denser metadata up front is premature for an N5 MVP. Bare-minimum causes rework. JSONB-everything is defensible only for very-early prototypes — we're past that.

---

## Phase F — Lesson schemas + authoring workflow

### F.0 Lesson schemas (deferred)

**Decision:** Lesson schemas follow the same "sketch + iterate during authoring" approach as item schemas. Not flagged as a separate grilling sub-decision.

### F.1 Skeleton author

**Decision:** AI proposes the chapter skeleton (ordered items + lesson types per chapter); user reviews pacing and proportionality, not item-by-item order.

Mechanism: AI ingests Tanos's N5 grammar order + JMdict frequency rank + prerequisite graph + Genki/Bunpro structural reference (taxonomy only, not text). Outputs a chapter-by-chapter list of items and lesson types. User reviews chapter density and thematic coherence.

**Why:** Item order for N5 is mostly canonical convention — Tanos and Genki agree on most of it. User can judge pacing as a learner-stand-in without expertise. Hiring a curriculum designer ($2-5K + weeks) is deferrable; AI baseline is good enough to start. User hand-authoring is blocked by non-expertise.

**Rejected:** Deterministic taxonomy-only (rigid, no density balancing); hire curriculum designer (slow, defer); user hand-authored (blocked).

### F.2 Lesson drafter

**Decision:** AI single-pass draft from structured input.

For each lesson, AI receives: item refs (item data from relational DB) + vector DB query results for themed examples + lesson type template + recent corrections-log entries (few-shot). Outputs Teach content + Check question pool + Practice templates.

**Why:** Item data is already structured (JMdict-sourced); AI shapes rather than invents. Single-pass is sufficient quality; multi-pass triples token cost for marginal gain. Human writers add coordination overhead and aren't faster for templated output.

**Rejected:** AI multi-pass (premature optimization); outsourced human writers (slow, coordination cost); mixed AI-for-non-grammar + human-for-grammar (workflow complexity for limited benefit — grammar is bridged by contractor review at v2, not different drafter).

### F.3 Pre-review quality gate

**Decision:** Structural validation + AI critic pass.

- **Structural validation** (deterministic, free): field-presence, ref-validity, lesson-type adherence, audio file existence. Always runs.
- **AI critic** (~$0.05/lesson, ~$25 for Foundation): second LLM pass against the 9-point checklist before user sees draft. Catches lesson-type drift, example mismatch, policy violations.

**Why:** Structural validation is essentially free; no reason to skip. AI critic catches ~30-50% of issues a second human pass would find, with ~5-15% false positive rate — net positive on editorial burden. ~$25 for full Foundation is trivial.

**Rejected:** Structural only (more semantic issues reach user); no gate (dumb errors waste user time); two AI critics (premature redundancy).

### F.4 Editorial review format

**Decision:** Structured 9-point checklist + free-text revision notes.

Each draft shows the checklist: tone, length, flow, example feel, audio, lesson-type adherence, item-ref match, theme-tag accuracy, learner-confusion. Pass/fail per. Free-text per fail. Approve OR send-back-with-notes (which prepend to drafter prompt for regeneration).

**Why:** Structured feedback enables mechanically-extractable corrections-log entries. ~30 sec/lesson. Shared vocabulary with AI critic. Click-through approve-only would empty the corrections log; open prose feedback is slower and unstructured; inline editing UI is premature.

**Rejected:** Click-through approve-only (kills convergence loop); open prose (unstructured, slow); inline editing with diff (high UI cost, defer to v2).

### F.5 Corrections feedback loop

**Decision:** Few-shot prompting from recent corrections, filtered by lesson type.

Each "send back" creates a log entry `{original_draft, your_notes, regenerated_version}`. Drafter prompts for new lessons prepend the N most recent corrections *of the same lesson type* as few-shot examples (N ~5-10, bounded by token budget).

**Why:** Zero infrastructure (flat file + prompt template). Continuous improvement with use. ~1-2K extra tokens per draft prompt; bounded. F-Vocab corrections inform future F-Vocab drafts specifically.

**Refinement deferred to v2:** Filter few-shot by vector similarity to the new draft (semantic relevance), not just recency. Better quality, more infra.

**Rejected:** Rule extraction (premature, brittle); fine-tuning (needs ~1000+ examples, far future); no improvement loop (defeats convergence premise).

### F.6 Publish gate

**Decision:** Deferred to Phase M (MVP scope cut + beta launch).

The publishing-gate decision is bound up with beta launch strategy — closed alpha vs public beta vs commercial launch each warrant different gate logic. Not an authoring-workflow decision; defer until launch sequence is being designed.

### F.7 Editorial review intensity

**Decision:** Adaptive sampling — start at 40% for first 3-4 chapters, drop to 20% once critic-vs-user agreement is consistent.

User reviews: 40% random sample + 100% of AI-critic-flagged drafts initially, dropping to 20% after calibration. Total editorial time across Foundation: **~9-14 hours** at adaptive sampling (vs ~30-50 hours at full review or ~6-12 hours at flat 20%).

**Why:** Front-loads calibration when AI-critic accuracy is unknown; lightens once trust is established. Pure-zero-input was rejected because (a) corrections loop dies without user signal, (b) AI critic is not ground truth (overlapping blind spots with the drafter), (c) product-feel judgment uniquely requires human reviewer. The user's learner-stand-in perspective is actually a *strength* for catching beginner-confusion issues, not a deficit — the late-Foundation content the user doesn't yet know is exactly where authentic beginner reactions matter most.

**Trade-off accepted:** Some unreviewed lessons ship with tone/example-feel issues; beta feedback fills the gap. Linguistic correctness still protected by canonical data sources + contractor grammar review.

**Concrete time estimate:** ~3-4 min/lesson editorial time; ~2-3 hours per chapter (~25 lessons); per-chapter wall clock ~1 week of evening sessions or 1 weekend of focused work.

**Rejected:** Flat 20% (under-calibrates early); flat 40% (over-invests in convergence; diminishing returns past ~75 corrections); full review (~30-50 hrs, slower without proportional quality gain at MVP); zero input (kills convergence loop, breaks brand).

---

## Phase G — Mastery scoring + Spaced repetition

### G.1 Mastery data model

**Decision:** Continuous float 0-1 per item + per-modality breadcrumbs. Display labels derived from score ranges.

Per item per learner:
- `mastery: float (0-1)` — primary SRS input
- `modality_history: {recognition: [pass/fail timeline], recall: [...], production: [...]}`
- "Fully mastered" = score > threshold AND tested in all modalities with success
- UI labels (Apprentice / Guru / Master / Enlightened / Burned) derived from score ranges; display layer only, not a separate data layer

**Why:** Continuous score is the right primitive for modern SRS algorithms (FSRS operates on probability-of-recall). Per-modality breadcrumbs distinguish recognition vs production cheaply (a learner can read 食べる perfectly while being unable to produce it). Stage labels are display only — same data, friendlier UI.

**Rejected:** True discrete state machine (lossy, no continuous score, incompatible with FSRS); full multi-dimensional sub-scores (more storage/update complexity for marginal benefit; breadcrumbs suffice); single continuous score with no modality tracking (loses critical recognition-vs-production signal).

### G.2 SRS algorithm

**Decision:** FSRS (Free Spaced Repetition Scheduler).

Modern (~2022) ML-trained algorithm; predicts retention probability accurately; operates on continuous scores; reference implementations available in multiple languages (Python/Rust/TS/Go). Default parameters work at MVP; per-learner calibration happens automatically once review history accumulates.

**Why:** ~15-25% better retention predictions than SM-2 (Anki's 1987 classic). Anki itself defaulted to FSRS after years of SM-2 for this reason. Custom is a well-known anti-pattern (worse than FSRS for zero benefit). Leitner box is too coarse for the continuous scores we just chose.

**Rejected:** SM-2 (older, worse); custom (reinventing); Leitner (coarse, defeats G.1's precision); defer (clear best choice exists now).

### G.3 Check-answer → mastery rating

**Decision:** AI judges answer quality → 4-level FSRS rating (Again / Hard / Good / Easy).

The AI evaluating the Check answer (already in the loop) also assigns the rating based on correctness + latency + partial correctness + hedging signals. FSRS uses rating + item history + time since last review to update mastery score.

**Why:** AI is already evaluating; rating assignment is essentially free. Uses FSRS's full 4-level precision. No friction added to learner. User self-rating adds per-question friction over thousands of reviews (real motivation cost) and beginners self-rate poorly. Binary correct/wrong loses 2 of FSRS's 4 ratings. Mechanical time-based mapping is noisier than AI judgment.

**Rejected:** User self-rate Anki-style (friction); binary mapping (lossy); time+correctness mechanical (noise from distractions, mobile lag, reading vs thinking time).

### G.4 Review session item selection

**Decision:** FSRS-due items (predicted retention < 90%), sorted by lowest predicted retention, capped at 10-15 items per session. AI picks per-item modality favoring the learner's weakest one (from breadcrumbs).

**Why:** Use FSRS for what it's built for. Lowest-retention-first targets items closest to being forgotten. Cap 10-15 matches the ~5-10 min session length (same micro-lesson philosophy). Per-modality targeting closes recognition-vs-production gaps using G.1's breadcrumb data.

If <10 items are due, session is short — signal the learner is on track, not a bug.

**Rejected:** FSRS-due + near-due recency-weighted (wastes review time on items not at risk); all-items-in-recent-chapter (misses forgetting curve); random sample (no retention optimization).

---

## Phase H — Per-modality evaluation (partial — H.2-H.5 pending)

### H.1 Speaking evaluation

**Decision:** Azure Speech (STT + Pronunciation Assessment) + AI semantic evaluation.

Pipeline: audio captured in-browser → Azure Speech endpoint → returns transcription text + per-word confidence + per-phoneme accuracy scores + overall pronunciation score → bundle + lesson context → AI for semantic evaluation ("did they actually answer the prompt?") → combined into 4-level FSRS rating per G.3.

**Terms:**
- **STT** (Speech-to-Text): service that transcribes audio into text.
- **Phoneme**: smallest distinct unit of sound in a language (Japanese has ~45). Phoneme-level scoring gives feedback like "your /sh/ sound came out as /s/" rather than just "word wrong."

**Why:** Azure has the best Japanese phoneme-level pronunciation scoring among major providers. ~$0.023/min, ~$0.70/year per active learner doing 5 min daily — negligible cost. Mature, well-documented API.

**Known gap:** Azure doesn't evaluate Japanese **pitch accent** (the high/low tonal pattern that distinguishes some words like 橋 hashi-low-high "bridge" vs 箸 hashi-high-low "chopsticks"). Acceptable at N5 where pitch accent isn't a critical beat; flag for v2+ if expanding into intermediate Japanese.

**Rejected:** Whisper + AI heuristic pronunciation (no phoneme data, fuzzy quality signal); specialized pronunciation APIs like SpeechAce (Japanese support less mature than Azure's); STT-only with no pronunciation scoring (misses the entire point of speaking practice).

---

## Cross-cutting design principles

### CC.1 Multi-language future-proofing (cheap insurance)

**Decision:** Apply lightweight forward-compatibility moves now so the architecture can host non-Japanese languages later without major rework. Do NOT engineer multi-language support speculatively.

Concrete moves applied to all prior decisions:
- **Item IDs are language-prefixed**: `ja:vocab:猫`, `ja:kanji:食`, `ja:grammar:te-form-request`. Trivial cost now; painful to retrofit if added later.
- **Foundation scope is per-Module configurable**, not a global constant. "Foundation = N5" is a setting on the Foundation Module, not a hardcoded fact.
- **Grammar taxonomy is per-language configurable reference**, not embedded constants. Future languages plug in their own taxonomy without code change.

What is NOT done now:
- Multi-language UX selector
- Per-language content pipelines
- Cross-language mastery sharing
- Polyglot brand

**Why:** ~30-50% of design is language-agnostic (architecture, algorithms, workflow); ~50-70% is per-language (content, taxonomy, pronunciation tuning). Forward-compat moves are nearly-free; full multi-language engineering pre-validation is a trap.

**User intent:** Build Sensei for Japanese first; defer polyglot decision (separate brands vs unified platform vs fork) until Sensei is validated.

### CC.2 Multi-platform readiness

**Decision:** Backend remains platform-agnostic. Build for one platform first (web or mobile); expand to others post-validation.

The decisions made so far are all server-side or platform-neutral. Platform-specific concerns (audio capture, IME, offline cache, storage limits) live in client code and don't affect architecture. To be revisited as **Phase L (tech stack)** sub-decision.

**Why:** Single-platform MVP ships faster than three-platform MVP. The architecture doesn't constrain platform choice, so the decision can be deferred without lock-in.

---

## Pending Decisions

See `progress.md` for live status. Active sub-decision when this log was last updated: **Phase H.2 — Writing evaluation**, last AskUserQuestion paused for clarification.
