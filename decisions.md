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

## Phase H — Per-modality evaluation (complete)

### H.1 Speaking evaluation

**Decision:** Azure Speech (STT + Pronunciation Assessment) + AI semantic evaluation.

Pipeline: audio captured in-browser → Azure Speech endpoint → returns transcription text + per-word confidence + per-phoneme accuracy scores + overall pronunciation score → bundle + lesson context → AI for semantic evaluation ("did they actually answer the prompt?") → combined into 4-level FSRS rating per G.3.

**Terms:**
- **STT** (Speech-to-Text): service that transcribes audio into text.
- **Phoneme**: smallest distinct unit of sound in a language (Japanese has ~45). Phoneme-level scoring gives feedback like "your /sh/ sound came out as /s/" rather than just "word wrong."

**Why:** Azure has the best Japanese phoneme-level pronunciation scoring among major providers. ~$0.023/min, ~$0.70/year per active learner doing 5 min daily — negligible cost. Mature, well-documented API.

**Known gap:** Azure doesn't evaluate Japanese **pitch accent** (the high/low tonal pattern that distinguishes some words like 橋 hashi-low-high "bridge" vs 箸 hashi-high-low "chopsticks"). Acceptable at N5 where pitch accent isn't a critical beat; flag for v2+ if expanding into intermediate Japanese.

**Rejected:** Whisper + AI heuristic pronunciation (no phoneme data, fuzzy quality signal); specialized pronunciation APIs like SpeechAce (Japanese support less mature than Azure's); STT-only with no pronunciation scoring (misses the entire point of speaking practice).

### H.2 Writing evaluation

**Decision:** Hybrid pipeline — input normalization + rule-based exact-match for deterministic exercises + AI semantic judgment for open exercises.

Pipeline per writing answer:
1. **Input normalization** (client-side, **wanakana**): romaji → kana; full-width/half-width unified.
2. **Tokenization** (server-side, **kuromoji** — Japanese morphological analyzer that splits sentences into morphemes/words since Japanese doesn't use spaces).
3. **Route by exercise type:**
   - **Exact-match** (fill-in-blank, reading typing): deterministic token comparison.
   - **Open response** (translation, free writing): AI judges semantic correctness + form + generates granular feedback.
4. Combined result → 4-level FSRS rating per G.3.

**Terms:**
- **wanakana**: JavaScript library for client-side romaji ↔ kana conversion.
- **kuromoji**: server-side Japanese morphological analyzer.
- **IME** (Input Method Editor): OS-level software for typing non-Latin scripts. App doesn't depend on it since wanakana handles browser-based romaji input.

**Why:** Deterministic exercises don't need an LLM — exact-match is faster, cheaper, more reliable. Open exercises need AI — multiple valid phrasings exist. Routing happens at exercise type, not inside the LLM.

**Rejected:** Pure AI for everything (expensive, risk of rubber-stamping wrong simple answers); rule-based only (can't grade open responses); AI routes internally (wasted abstraction — exercise type is known at routing time).

### H.3 + H.4 Listening and Reading evaluation

**Decision:** Reuse existing pipelines based on answer modality, not by input modality.

Both Listening and Reading comprehension exercises share architecture; only the *stimulus* differs (audio for Listening, text for Reading). Evaluation depends on the *answer modality*:

- **Multiple choice** → deterministic match (correct option ID matched). No AI needed.
- **Typed response** → routes into H.2 writing evaluation pipeline.
- **Spoken response** → routes into H.1 speaking evaluation pipeline.

The comprehension *question* itself is authored as part of the lesson at draft time, frozen. Not runtime-generated.

**Why:** Answer-grading isn't unique to comprehension. Building separate Listening/Reading evaluators duplicates code already in H.1/H.2. Multi-choice handling is trivial.

**Rejected:** Per-modality bespoke evaluators (duplication for no gain); AI-only end-to-end (couples comprehension to grading, hard to debug, runtime-generated questions unstable); comprehension scored separately from answer correctness (distinction without measurement).

### H.5 Multi-item Check rating

**Decision:** Target item gets full FSRS rating; supporting items get "exposure" credit. AI attempts error attribution on failure; if clear, attributable item gets Hard/Again, otherwise target item takes the default failure rating.

Mechanism:
- Every lesson has a designated **target item** (the item being taught).
- Check answer correct → target item gets `Good`/`Easy` (based on quality signals); supporting items get **exposure** (non-rating signal incrementing exposure counter, no mastery change).
- Check answer incorrect → AI tries to attribute the error. Clearly attributable ("wrong conjugation") → that item gets `Hard`/`Again`. Not attributable → target item takes default failure rating; supporting items still get exposure.

**Why:** Target item should always get full signal — it's what the lesson teaches. Supporting items are already (mostly) mastered; reuse provides exposure without risking mastery drops from mixed failures. AI attribution is a stretch goal — default to target-item-takes-the-fall when ambiguous.

**Rejected:** Uniform rating across all items (one failure tanks unrelated mastery); full AI attribution every time (unreliable for ambiguous failures, premature); target-only with no supporting tracking (wastes exposure signal).

---

## Phase I — Branching: Track Modules + intake + placement (partial — I.2 mid-grilling, I.3 + I.4 pending)

### I.1 Track Module selection rule

**Decision:** Single primary track + secondary interests as "flavor."

- Learner picks ONE primary Track Module post-Foundation. That track defines the lesson path.
- Learner can also tag secondary interests (multi-select). Secondary interests influence example themes and occasional spotlight lessons within the primary path; they don't change the curriculum structure.
- "Switch primary" is a settings change, available anytime.
- "Add a new parallel track" is supported once Track A is reasonably progressed.

**Why:** Multi-track combinations explode combinatorically (5 tracks × any-subset = 32 paths). Optimizing one path is hard, parallel is worse. Learners who say "I want everything" usually mean "I haven't decided." Secondary-flavor delivers most personalization value without path complexity.

**Rejected:** Multi-select parallel (combinatorial; dilutes focus); strict sequential (too rigid for adult learners); branched primary with explicit branch points (UX complexity for marginal benefit).

### I.2 Track Module catalog (LOCKED via I.2.a + I.2.b + I.2.c)

**Decision (final):** Track selection splits into **two independent dimensions** — a Content Track (mandatory single-select) and a Goal Overlay (optional single-select). See I.2.a for the structural framing, I.2.b for the gap-filling mechanic, I.2.c for the Goal catalog scope at MVP.

**Content Tracks at MVP (4):**

- **Travel** — visitor Japanese (tourist functions: tickets, hotels, restaurants, directions, emergencies). Vocab tourist-functional; grammar emphasizes polite-form requests + basic past/future.
- **Anime/Manga** — casual Japanese as found in anime/manga. Sentence-final particles (よ/ね/ぞ/ぜ), casual contractions, character speech patterns. Light on keigo.
- **Living/Working in Japan** — combined Business + Daily Life. Keigo + civic vocab + workplace + everyday-resident contexts (rentals, healthcare, banking, workplace email, customer service). Some register dilution accepted; split into separate Business + Daily Life tracks if post-MVP learner data justifies.
- **Conversational Japanese** (default recommendation) — natural everyday conversation (family, work, hobbies, food, weather), balanced register, continues into N4 territory without exam-format drilling. Genki II-level pedagogy.

**Goal Overlays at MVP:** {None (default), JLPT-N4}.

### I.2.a Track selection framing — Content Track vs Goal Overlay (two dimensions)

**Decision:** Track selection at intake is two independent choices: **Content Track** (theme of the curriculum spine, mandatory) + **Goal Overlay** (credential/exam goal, optional).

- **Content Track** drives the lesson spine — sequence, themes, item selection.
- **Goal Overlay** sits orthogonally on top — applies to ANY content track, adds gap-filling supplementary lessons + mock-exam Assessments + progress tracking toward the exam.
- A learner picks one of each at intake. Goal defaults to "None" so it's truly optional.

**Why:** The flat-list framing forced JLPT-N4 to compete in the same slot as Travel/Anime/Conversational — but those are *content/theme* preferences while JLPT is a *credential goal*. They're orthogonal in real learner intent ("I want to watch anime AND pass N4" is a coherent combination). Splitting them:
- Solves the marketing concern (JLPT gets its own equal-billing intake question, not subordinated to a content track).
- Matches how learners actually think.
- Cross-cuttable for free — resolves the "should JLPT apply to all tracks?" thread (yes, by construction).
- Future-proofs the catalog (adding N3 later = one more option in Goal dimension, not another flat-list entry).
- Resolves the hybrid-vs-first-class-vs-overlay deadlock by reframing the question: JLPT is *both* first-class (its own intake dimension) *and* an overlay (architecturally), with no contradiction.

**Rejected:**
- Flat single-dimension list with JLPT-N4 as one option among Travel/Anime/etc. — the original framing that produced the deadlock. Treats orthogonal concerns as competing.
- Hybrid UX-track + architecture-overlay on Conversational only (the earlier assistant-recommended path). Strictly worse than splitting dimensions: tied JLPT to one content track, lost cross-cuttability.
- Full first-class JLPT-N4 track with ~150 dedicated lessons. ~50% more authoring than overlay-based for no learner benefit when Goal Overlay can target any content track.
- Defer JLPT-N4 to post-MVP. Marketing-relevant; learners actively search for "JLPT app."

### I.2.b Goal Overlay mechanic — gap-fill + assessments + tracker

**Decision:** Goal Overlay does three things on top of the chosen Content Track:

1. **Gap computation.** Compares N4-required item set against the items the Content Track will teach → produces a delta.
2. **Supplementary lesson injection.** Adds lessons covering the delta, woven into natural slots in the spine. Spine items are never *removed* — overlay only adds.
3. **Mock-exam Assessment lessons + progress meter.** Periodic N4-format Assessments at checkpoints; dashboard shows N4 readiness ("18 of 167 N4 grammar covered").

**The boundary rule:** Overlay adds; never subtracts. Content track integrity is preserved.

**Compatibility is surfaced transparently at intake.** Not all (Content × Goal) combinations have equal overlap:
- **Conversational + N4:** ~90% overlap. Overlay barely lifts a finger; experience is essentially Conversational with N4 mock exams.
- **Anime + N4:** ~60-70% overlap. ~30-40 supplementary lessons. Roughly 4 spine lessons : 1 supplementary. Supplementaries are framed honestly when grammar doesn't fit the theme ("this grammar is part of your N4 goal but doesn't come up much in anime").
- **Travel + N4:** ~30-40% overlap. ~70-90 supplementary lessons. Roughly 1:1 — learner's actual experience tilts toward N4 prep with travel garnishes.

At intake, the system surfaces this honestly: *"Travel + N4 means ~80 supplementary lessons that aren't travel-themed. Path will lean more toward N4 prep than Travel content. Still good with this, or want to adjust?"* The learner either commits or flips Content Track to Conversational.

**Why transparent over silent:**
- Silent-and-permissive UX feels like bait-and-switch when a Travel+N4 learner gets 50 hours of supplementary keigo drills.
- Transparent surfaces the trade-off, respects the learner, and naturally nudges incoherent combinations toward Conversational+N4 (the right pairing anyway).
- Reinforces the anti-fake-personalization brand: "we tell you what you're getting."

**Rejected:**
- Overlay subtracts (drop content-track items not in N4 syllabus) — destroys content track integrity, breaks the "ぞ/ぜ in Anime" example.
- Force-fit supplementary lessons into the content theme (e.g., make keigo "feel like anime") — uncanny, dishonest.
- No compatibility surfacing — bait-and-switch risk; learner surprised by curriculum mix.
- Defer N4 supplementary lesson authoring to v2 — leaves the Goal Overlay non-functional at MVP; can't ship the dimension.

### I.2.c Goal Overlay catalog scope at MVP

**Decision:** Goal Overlay catalog at MVP = {None, JLPT-N4}.

- **None** is the default; many learners genuinely have no exam goal (anime fans, casual learners, travelers).
- **JLPT-N4** is the only exam overlay at MVP because:
  - **N5** would be redundant with Foundation (Foundation ≈ N5 by construction — completing Foundation already means N5-ready). N5 mock exams can ship within Foundation's own Assessment system without needing a separate overlay.
  - **N3 and above** would require Content Tracks to reach content depth that doesn't exist at MVP. Adding N3 later = one new overlay option, no architectural change.
  - **JLPT-N1/N2** are far future, gated on content depth and a Japanese-teacher contractor relationship.

**Why N4 specifically:** It's the natural next milestone after Foundation, marketing-relevant ("apps that prep for N4" is an active search), and has a well-defined syllabus (Tanos N4 lists). Cost to add: ~30-90 supplementary lessons authored once, reused across any Content Track.

**Rejected:**
- N5 + N4 at MVP — N5 redundant; pollutes the dimension.
- N4 + N3 at MVP — N3 content depth not there yet.
- No goal overlay at MVP, add post-launch — surrenders the JLPT marketing posture that motivated this whole framing question.

### I.3 Intake survey design (PARTIAL — I.3.a + I.3.b locked; Foundation-Complete touchpoint design + placement-hand-off pending)

### I.3.a Intake timing — two touchpoints

**Decision:** Intake is split across **two touchpoints**, not collected entirely at signup.

1. **Signup intake** (~25-30 seconds, 3 questions). Captures lightweight signal usable immediately. Does NOT lock Track Module — that choice is deferred until learner has context.
2. **Foundation-Complete intake** (~2-3 questions, deeper). Real Track Module + Goal Overlay selection happens here, when learner has ~6 months of context. Compatibility warning lives here. Pre-populated from signup interests as soft defaults.

**Why two touchpoints, not all-at-signup:**
- **Anti-fake-personalization brand alignment.** Heavy Day-1 questionnaire would imply personalization starts Day 1, contradicting "Foundation is shared; real branching after." Lightweight signup is honest about when each kind of personalization kicks in.
- **Day-1 Track choice is uninformed.** A learner picking "Anime" at signup based on a label is guessing; the same learner picking after 6 months of context is choosing. Better signal = better retention through Track Module phase.
- **Signup friction kills conversion.** 3 questions is the sweet spot for freemium activation; 5+ measurably drops conversion. Holding deeper questions for Foundation-Complete means asking them when the learner is already invested.

**Trade-off accepted:**
- Two surfaces to design + engineer instead of one. Mitigated by their distinct natures (signup = generic; Foundation-Complete = informed). Not actually duplicative.
- Signup-intake personalization is shallow (~20-30% themable examples + light routing). Honest framing accepts this; the brand explicitly says "real personalization is earned."

**Rejected:**
- All-at-signup with full Track Module + Goal Overlay capture — contradicts brand; high friction; choice uninformed.
- No intake at signup, Track-only at Foundation-Complete — surrenders Foundation example theming + placement quiz routing + daily-target signal. Worse Day 1 experience.
- All-at-signup with "you can change later" — bandages over friction but doesn't fix that Day-1 choice is uninformed.

### I.3.b Signup intake — 3 questions, 25-30 seconds

**Decision:** Three questions captured at signup, all light-touch.

**Q1: "What pulled you to learn Japanese?"** (multi-select cards, required)
- Options: Travel · Anime/Manga · Live/work in Japan · Talk with friends/family · Pass a JLPT exam · Just curious
- Stored as: `interests: string[]` (+ `jlpt_intent: bool` derived from the JLPT option)
- Used for:
  - **Foundation example theming.** ~20-30% of example sentences in Foundation lessons are flexible enough to theme by interest tag. Vector DB queries for example retrieval prefer interest-tagged examples for that learner.
  - **Foundation-Complete intake defaults.** When real Track Module selection happens, signup interests pre-populate as soft defaults ("you told us at signup you were interested in Anime & JLPT — still feel right?").
  - **Marketing email tone.** Re-engagement copy leans toward learner's stated interests.

**Q2: "Have you studied any Japanese before?"** (single-select, required)
- Options: None (total beginner) · Some kana / basic phrases · Fair amount of vocab/grammar · Studied before, refreshing
- Stored as: `prior_experience: enum`
- Used for:
  - **Placement quiz routing (I.4).** Total beginners skip the quiz entirely; "some kana" gets a kana-focused mini-quiz; "fair amount" gets full placement quiz across vocab/grammar/kanji.
  - **Foundation entry point.** Placement quiz output → learner starts at lesson N rather than always at lesson 1.
  - **Prevents early-quit moment.** Intermediate-curious learners don't get force-taught hiragana.

**Q3: "How much time per day do you want to commit?"** (single-select, optional with default)
- Options: 5 min · 10 min (default) · 20 min · 30+ min
- Stored as: `daily_target_minutes: int`
- Used for:
  - **Review session cap.** 5-min cohort capped at 5-7 review items; 30+ cohort gets 15-20.
  - **Streak goal threshold.** Streaks count against committed target.
  - **Pacing projections.** Dashboard shows estimated time to Foundation Complete based on target.

**Why these three specifically:**
- Q1 gives the learner a *sense* of future personalization without locking them in. Honest framing on the survey screen reinforces: "we'll use this to theme some examples; real personalization starts after Foundation."
- Q2 alone justifies the survey — without it, intermediate learners hit a wall at lesson 1 and quit. Highest-value signal in the survey.
- Q3 is standard for habit-formation apps. Drives the streak/review/pacing surface area.

**Honest limitation acknowledged:** Signup-intake personalization is *table stakes*, not transformative. ~20-30% themable examples may not feel like much. Acceptable trade — deeper personalization Day 1 requires committing to Track Module, which is precisely what we're avoiding.

**Rejected:**
- 5+ question signup survey — conversion drop; doesn't justify itself when most extra questions would be Track-Module-shaped.
- Single-question signup (only Q2) — loses interest signal for Foundation theming + loses pacing signal.
- Asking Track Module at signup — see I.3.a rejection.
- Asking JLPT Goal Overlay at signup as a hard commitment — Q1's "Pass a JLPT exam" option captures the *intent* lightweight; the actual N5/N4/None choice is made at Foundation-Complete.

### I.3.c Foundation-Complete touchpoint — richer milestone moment

**Decision:** Foundation-Complete is a **celebration-framed milestone moment**, not a bare 2-Q picker. 2 required questions + 2 optional extras in a combined screen.

**Flow:**

1. **🎉 Celebration framing** (no question, just the moment). Stats summary: "375 lessons, ~100 kanji, ~800 vocab, ~50 grammar points. Time to pick where you're going next." Small badge/animation.

2. **Q1: Content Track** (single-select, required, with preview cards). Each card shows track name, 2-line description, 2-3 sample lesson titles, an example dialogue snippet. A soft default is highlighted based on signup interests ("You told us you liked Anime — Anime track is recommended") but learner can pick any track. Default is pre-selected, not pre-confirmed; explicit Continue required.

3. **Q2: Goal Overlay** (single-select, required). "Do you want to prep for an exam alongside your track?" → None / JLPT-N4. **Compatibility warning fires inline** when the chosen Content Track × Goal Overlay has low item overlap (e.g., Travel + N4): *"Travel + N4 means ~80 supplementary lessons that aren't travel-themed. Path will lean more toward N4 prep. Still good?"* with Adjust/Continue buttons.

4. **Optional "customize more" combined screen** — both extras live side-by-side as skippable mini-cards:
   - **Secondary interests** (multi-select). *"Want to spotlight some examples from other interests too? We'll occasionally weave them into your primary track. [Pick interests] [Skip — keep my signup interests]"*
   - **Daily target check-in** (single-select). *"You've been doing 10 min/day in Foundation. Adjust now or keep as is? [Adjust] [Keep 10 min/day]"*
   - Defaults persist if skipped. Both editable in settings anytime.

5. **Confirm → Track Module unlocked, first lesson cued up.**

**Time targets:** ~60-90 seconds for engaged learners; ~30 seconds for speed-skippers.

**Why richer (not symmetric with the lightweight signup):**
- **Asymmetric stakes.** Signup minimizes friction to protect conversion. Foundation-Complete is at-already-invested (~50-100 hours in). 60 seconds on a 6-12 month decision is cheap.
- **Preview cards are load-bearing.** The original I.2 grilling surfaced "learners can't reliably pick from labels alone." This is where preview cards belong — without them, Q1 is a guess.
- **Narrative beat / loyalty moment.** Six months of Foundation deserves a payoff moment. Bare 2-Q pickers squander the emotional beat that builds loyalty.
- **Compatibility warning has a natural home.** In a 2-Q picker it'd feel like a friction wall; in a guided milestone moment it feels like helpful guidance.

**Why optional Q3/Q4 (not required):**
- Both extras have working defaults (signup interests persist; daily target stays at current value). No data loss from skipping.
- Forcing them adds form-fatigue at a celebration moment.
- Both editable in settings — skip-now isn't forever-no.
- Combined "extras tray" screen signals "these are optional" better than two consecutive mandatory-looking screens.

**Why single combined extras screen (Option B over A):**
- One "skip everything" click vs two when not engaged.
- Visually signals "extras tray" framing — both presented as optional refinements, not separate full steps.
- Saves a screen of friction for the median user who'll skip both.

**Risks acknowledged:**
- Survey-fatigue at the wrong moment. Mitigation: celebration framing has to feel like reward, not chore — heavy text or visible-form-fields would break this.
- Soft-default pre-population on Q1 could lead to mindless click-through. Mitigation: default is pre-selected but not pre-confirmed; explicit Continue button forces a beat of consideration.

**Rejected:**
- Bare 2-Q picker (Content Track + Goal Overlay only) — symmetric with signup but mismatches the stakes; loses the milestone moment; squanders the preview-card opportunity.
- 4 required questions (Q3 + Q4 mandatory) — over-surveys at celebration; doesn't respect that defaults work.
- Two separate skippable screens for Q3 + Q4 (Option A) — two skip clicks for the speed path; treats each extra as full step rather than optional refinement.
- Deferring Q3/Q4 to a post-touchpoint settings prompt — loses the engaged learner's chance to set both at the natural milestone moment.

### I.3.d Intake → placement hand-off (implicit from I.3.b)

**Decision (closed without separate grilling):** Placement quiz is signup-session-bound and routed by signup Q2 (prior_experience).

Mechanically:
- Signup intake (3 Qs) completes → routing based on Q2:
  - `prior_experience: none` → skip placement quiz entirely; start at Foundation lesson 1.
  - `prior_experience: some_kana` → run kana-focused mini placement quiz.
  - `prior_experience: fair_amount` → run full placement quiz across vocab/grammar/kanji.
  - `prior_experience: refresher` → run full placement quiz (same as fair_amount).
- Placement quiz output → marks items as already-mastered + sets Foundation entry point (lesson N rather than always lesson 1).
- Then first Foundation lesson cued.

All within the same signup session. Foundation-Complete intake does NOT involve placement — by definition the learner has mastered all Foundation items at that point.

**Why same-session:** Splitting placement to a "come back later" prompt would let intermediate learners skip it and then quit on lesson-1-hiragana. Same-session ensures they actually run it.

**Open for I.4:** the actual quiz format, length, adaptivity, and what mastery signal it produces.

---

## Phase I.4 — Placement quiz design (complete)

### I.4.a Quiz scope + length — fixed per tier with early-exit + Foundation-only depth

**Decision:** Fixed length per signup tier (no within-tier adaptivity), with early-exit shortcut. Depth limited to Foundation items only.

**Per-tier specifics:**
- `some_kana` → ~20-25 kana items, frequency-sampled across hiragana + katakana. ~2-3 min.
- `fair_amount` / `refresher` → ~40 items split: 20 vocab (frequency-stratified 5/8/7 across top-100 / 100-300 / 300-800) + 10 grammar (spread across prerequisite graph: particles → conjugations → register markers → patterns) + 10 kanji (weighted toward top-50 N5 kanji). ~6-8 min.
- **Early-exit shortcut:** if first 10 items are perfect, offer "skip rest, mark mastered" button. Cheap approximation of adaptive testing's main benefit without the implementation cost.

**Scope depth:** Foundation items only (≤ N5). No N4 probing. A post-N5 learner tests out of all Foundation → unlocks Track Module at Foundation Complete regardless; "skip Foundation entirely" power-user path is deferred as niche.

**Why fixed-per-tier (not adaptive):**
- Adaptive testing (CAT + IRT) needs hundreds of pre-calibrated items + statistical infrastructure. Out of scope for MVP.
- Placement doesn't need surgical precision — FSRS calibrates mastery over the first ~20-30 review sessions anyway.
- Predictable duration ("~8 min") is honest signup UX; variable-length adaptive feels bait-and-switch.
- Early-exit shortcut captures most of adaptive's upside (don't over-test obvious cases) at near-zero implementation cost.

**Rejected:**
- Adaptive IRT-based testing (B) — overkill for MVP; defer to v2 if data shows fixed-length miscalibrates badly.
- Hybrid fixed + adaptive extension (C) — worst of both; "couldn't decide" trap.
- Deeper N4 probing — no N4 content authored at MVP; Track Module unlock doesn't depend on it.

### I.4.b Quiz format — multi-choice + cloze + multi-choice per item type

**Decision:** Format depends on item type, optimized for placement-speed while still producing reliable mastery signal.

**Vocab (20 items):**
- Format: multi-choice recognition ("What does 食べる mean? [to eat / to drink / to sleep / to walk]")
- ~5-8 sec per item
- Why recognition not production: recognition is mastery's floor (you must recognize before you can produce); production tested later in Foundation; placement-speed matters.

**Grammar (10 items):**
- Format: cloze fill-in-blank with short typed input. Example: "朝ごはんを___から、学校へ行きます (食べる)" → learner types 食べて.
- Routes through H.2 writing pipeline (wanakana + kuromoji + exact-match).
- ~15-20 sec per item
- Why cloze: tests both recognition AND form-selection in context, much harder to guess than multi-choice. Grammar is contextual; isolated multi-choice ("which grammar point is this?") is too easy to guess.

**Kanji (10 items):**
- Format: multi-choice reading + meaning combined per item ("食 — Reading: [しょく / じゅう / こう / きょう], Meaning: [eat / drink / sleep / walk]")
- ~10 sec per item

**Kana (20-25 items, `some_kana` tier only):**
- Format: multi-choice character-to-sound ("Which character makes the sound 'su'? [す / ず / し / さ]")
- ~3-5 sec per item

**Excluded from placement:** spoken responses (audio capture friction too high at signup before learner is committed); production-style vocab tests (slow); long-form writing.

**Rejected:**
- Pure multi-choice for grammar — too guessable; doesn't validate form-selection ability.
- Production vocab tests at placement — slow + frustrating before learner is invested.
- Spoken responses at placement — audio capture is non-trivial UX on Day 1; high abandonment risk.
- C-tests / cloze passages — academically sound but visually unfamiliar; consumer apps avoid.

### I.4.c Mastery integration — direct + prerequisite inference + FSRS rollover

**Decision:** Placement quiz output integrates with FSRS mastery state via three tiers.

1. **Directly tested + correct** → item marked mastered, enters FSRS with **high initial retention** (≥ 0.9). Will appear in early review sessions for low-frequency confirmation. Treated as if recently passed at high quality.

2. **Inferred mastered via prerequisite graph** → items NOT directly tested but whose prerequisite items were correctly tested → enter FSRS with **moderate retention** (~0.7-0.8). Will appear in early reviews more aggressively (system needs to confirm the inference). Effective coverage: ~3-4× the directly-tested item count.

3. **Not tested, not inferred** → item is unscheduled (not in FSRS); will be taught in normal lesson flow. If learner actually knows it, the lesson's Check answer will mark it mastered on first pass and FSRS picks it up from there.

**For directly-tested + incorrect:** item explicitly marked NOT mastered (not in FSRS) → scheduled in normal lesson flow. No negative penalty applied since this is initial assessment, not review failure.

**For early-exit shortcut taken (10 perfect → "skip rest"):** all remaining quiz items inferred mastered at moderate retention (~0.7); will surface in early reviews for confirmation.

**Coverage estimate at placement:**
- 40 directly tested + ~120-150 inferred → ~160-200 of ~1000 Foundation items receive a mastery signal (~16-20%).
- Remaining ~800 items go through normal lesson flow; FSRS corrects placement underestimates within ~20-30 sessions.

**What this misses (acknowledged):**
- Clustered knowledge (e.g., learner knows food vocab but not transportation) — frequency-stratified sampling smooths but doesn't eliminate.
- Production mastery (learner can recognize 食べる but can't produce from "to eat") — placement only tests recognition.
- Non-Foundation knowledge gaps (learner knows N4 grammar but skipped some N5) — looks weirdly spotty; treated as not-mastered, will rapid-skip during lessons.

**Cost of these misses:** extra lesson grinds learners zip through. Not ideal UX but not catastrophic; FSRS corrects within ~20-30 reviews. Acceptable MVP trade-off vs CAT/IRT implementation cost.

**Rejected:**
- Skip whole lessons on mastery inference — too aggressive; mastery inference is moderate-confidence and risks gaps.
- No prerequisite inference (only directly tested) — wastes the prerequisite graph data; placement coverage drops to 4%.
- Apply mastery to entire chapters from placement — too coarse; over-skips when learner only partially masters chapter items.

### I.4.d Per-chapter pre-evaluation (skip-test)

**Decision:** Chapters offer an optional skip-test on entry, using the same Assessment infrastructure as end-of-chapter gating. Bidirectional Assessment: same items, same bar, used either to skip a chapter or to exit it.

**Flow:**

On reaching a new chapter, the chapter-intro screen offers:

> **Chapter 5: Te-form Requests**
> 8 lessons · ~45 min total
>
> *Already know this?* [Take the 5-min skip test]
>
> Or: [Start chapter normally]

If learner takes the skip-test:
- **Pass (≥80% items at mastery)** → all chapter items marked mastered with FSRS state matching end-of-chapter completion. Chapter skipped. Proceed to next chapter.
- **Fail** → no penalty, no items marked from the test. Chapter begins normally.
- **Partial pass** → tested-correct items marked mastered; chapter still begins but lessons covering already-mastered items get auto-collapsed (lesson-level skipping driven by item mastery state).

**Retry policy:** Failed skip-test can be re-attempted later (e.g., after grinding through first few lessons of the chapter, learner can re-attempt to skip remaining lessons). No cooldown.

**Why use existing end-of-chapter Assessment (bidirectional), not a separate skip-quiz:**
- Symmetric bar — same items both directions, no "skip-test is harder than chapter exit" weirdness.
- One thing to author per chapter.
- Already designed into infrastructure (Assessment meta-lesson type, B.3).
- Item-mastery model handles both naturally (D.1).

**Module-level skip-test:** NOT in MVP. A learner who'd skip a whole module is mostly already caught by signup placement; remaining cases handled by chapter-by-chapter skip-testing (5 chapters × ~5 min skip-tests = ~25 min total). Module-level skip-test would add infrastructure for an edge case.

**Why this is a real addition to the design (not just refinement):**
- Changes Assessment design (now bidirectional).
- Adds a major escape valve complementing signup placement.
- Gets significantly more valuable as curriculum grows (~15 Foundation chapters now; ~50+ post-Tracks).

**Rejected:**
- Separate skip-quiz distinct from end-of-chapter Assessment — duplicates authoring; risks asymmetric bars.
- All-or-nothing skip (no partial-pass) — forces learners to grind through chapters when they know 80% of items.
- Module-level skip-test in MVP — adds infrastructure for edge case already mostly covered by chapter-level.
- Mandatory skip-test on chapter entry (learner can't opt out) — forces friction on every chapter even when learner clearly hasn't seen the content.

### I.4.e Curriculum Outline (structured navigation surface)

**Decision:** Ship a **minimal-but-complete Curriculum Outline view** at MVP. Hierarchical, navigable, decision-supporting — but functional UI, not gamified game-map.

**Structure:**
- **Foundation:** nested list (Module → Chapter → Lesson), expandable/collapsible.
- **Post-Foundation:** graph-shaped (Content Track + Goal Overlay branches), same underlying data structure as Foundation, different node + edge styling.
- Always-accessible: dedicated "Curriculum" / "Path" tab in main nav.
- Surfaced at key moments: post-placement (replaces standalone reassurance screen), post-Foundation-Complete, post-chapter.

**Per-chapter (collapsed):**
- Chapter title + brief description
- Lesson count + estimated total time
- State indicator: completed ✓ / current ⏵ / skipped via placement / locked (prereq not met) / available

**Per-chapter (expanded):**
- Lesson list with title + brief subtitle (e.g., "Lesson 3: Te-form Requests — basic pattern + ください")
- Small per-lesson badge: item count + key items taught
- State indicator per lesson: completed / current / not started / skipped via placement
- Read-only lesson visibility (click shows Teach-beat preview, does NOT navigate to mid-chapter lessons)

**Per-chapter actions:**
- **Skip-test ahead** (uses I.4.d) — only available for future chapters.
- **Relocate position here** — for past chapters where learner wants to go back and learn properly. Just moves the current position pointer; forward chapters retain mastery state (still skippable via skip-test or learnable normally).
- **Browse content** — view chapter overview, lesson previews.
- **Review** (uses existing Review meta-lessons) — for completed chapters.

**State semantics (5 states):**
- `completed`: all items at mastery; passed end-of-chapter Assessment.
- `current`: position pointer is here; learner is actively progressing.
- `skipped_via_placement`: bypassed during signup placement quiz inference; items marked mastered. Learner can relocate back to fully learn.
- `locked`: prerequisite chapters not yet completed; viewable in outline but no actions available.
- `available`: prerequisites met, position pointer hasn't reached yet; skip-test offered.

**Why this scope (not Duolingo-style gamified map):**
- The user's actual ask was logical visibility + agency, not game-map UX.
- Functional UI (think IDE file tree, project outline) ships faster + meets all stated needs.
- Anti-fake-personalization brand: transparency is the win, not gamification.
- Can be polished later without changing data structure.

**Why ship at MVP (not deferred):**
- The "post-placement reassurance" need (preventing overshoot disappointment) is satisfied by the outline itself.
- Chapter skip-test (I.4.d) needs a surface for learners to find skip-testable chapters; the outline is that surface.
- Modest implementation: hierarchy already in DB, mastery state already tracked, skip-test mechanism locked, relocate is one pointer change. ~1-2 weeks engineering once codebase exists.

**What's OUT of MVP scope:**
- Gamified visualization (badges per chapter, animations, world-map framing).
- Drag-and-drop reordering.
- Per-item granularity in outline (lessons show item counts but don't expand to individual items).
- Cross-track what-if comparison ("what if I'd picked Anime instead of Travel?").
- Mid-chapter lesson jumping (preserved for v2 if beta surfaces this as friction).

**Cross-reference:** logged here adjacent to placement decisions that motivated it; visual + interaction-pattern details revisited in **Phase J (Standalone surfaces)** alongside Progress Dashboard.

**Rejected:**
- Defer Curriculum Outline to v2 (only post-placement reassurance screen at MVP) — loses chapter-skip-test discoverability; loses transparency brand-alignment.
- Full game-map UI at MVP — over-engineered for actual user need; significant design risk.
- Outline at chapter granularity only (no lesson visibility) — weaker decision support for skip-test choice; learner can't recognize lesson titles to gauge familiarity.
- Allow mid-chapter lesson jumping — breaks within-chapter prerequisite assumptions; bypasses skip-test mechanism.

### I.4 Placement quiz design (pending)

Pending grilling. Open questions: scope (what items it tests), format (multi-modality vs writing-only), what it controls (skip lessons vs skip chapters vs gate-by-item-mastery), how it integrates with intake.

> **Superseded** — this stub was resolved under `## Phase I.4 — Placement quiz design (complete)` above (I.4.a–I.4.e). Left in place per append-only convention.

---

## Phase J — Standalone surfaces

### J.1 Practice Mode (complete)

Surfaces the "practice outside the curriculum" job (PRD v1 §9). Resolved as a real, user-directed drill surface — not a review-queue nicety.

#### J.1.a Earns its place as a real surface (option C, not A/B)

**Decision:** Ship a genuine **Practice Mode tab** — its own destination, available regardless of whether FSRS reviews are due — with user-directed scope and **no curriculum advancement** (drilling never advances Foundation/Track progress; it only reinforces).

**Why (not the cheaper options):**
- **A — cut it:** FSRS reviews + skip-tests + Outline browse cover *some* needs, but leave a real gap: targeted, on-demand drill. Not coverable by existing surfaces.
- **B — "More practice" button** (extend today's review queue with mid-retention items from full learning history): honest about being a UX nicety, but it's algorithm-picked only — the user can't say "drill my listening." Doesn't serve the strongest use case.
- **The decisive use case:** the **JLPT-N4 Goal Overlay** learner. Mock exams + readiness tracker (I.2.b) tell them *where* they're weak; nothing lets them *act* on it ("give me 20 listening items right now"). C is exactly that missing targeted-drill loop. With exam learners a meaningful MVP slice, C becomes the floor, not the ceiling.

**Coverage note (no double-build):** mock-test *assessment* for exam learners already exists three ways — per-chapter skip-tests (I.4.d), end-of-chapter Assessments (B.3), Goal Overlay mock exams (I.2.b). Practice Mode deliberately does **not** duplicate those; it owns *drill*, not *assessment*.

#### J.1.b Scope picker — reuse Curriculum Outline + filters + "weakest" shortcut (option A)

**Decision:** User picks **scope** (which items); ordering is **always** algorithm-decided. No user-facing strategy menu.
- **Scope source:** reuse the **Curriculum Outline** (I.4.e) as the "pick what to drill" surface — pick a Module / Chapter / Track. Plus a cross-cutting **item-type filter** (Kana / Vocab / Kanji / Grammar) and a **"weakest across everything"** shortcut.
- **Ordering:** always lowest-retention / weakest-modality first (reuse G.4 review-selection logic).

**Why:** the scope picker already exists (Outline) — reuse, don't rebuild. Strategy menus (weakest/random/recent) mostly produce decision paralysis; the right order is almost always "weakest first," which FSRS+G.4 already compute. Don't expose a knob whose best setting we already know.

**Rejected:** B (scope + strategy menu) — paralysis, exposes a knob we'd set ourselves. C-narrow (three fixed presets) — "Exam focus" preset duplicates Goal Overlay territory; presets get rigid.

#### J.1.c FSRS / mastery write-back — full, with double-count guardrail (option A)

**Decision:** Every Practice answer is scored exactly like a review (AI judges → Again/Hard/Good/Easy → FSRS updates retention + reschedules; mastery breadcrumbs move). Practice = "voluntary reviews."

**Guardrail — same-session double-count protection:** within one Practice session an item's FSRS state updates **once** (first attempt counts; repeats in the same session are exposure-only). Prevents the "massing" problem (rapid repeated successes cramming-style wrongly inflating the interval).

**Why:** an answer is an answer — if the user proves (or fails) knowledge in Practice, FSRS should learn it; pretending otherwise makes the schedule dumber. Also cheapest: reuses the exact review scoring path (G.3/G.4).

**Rejected:** B (read-only sandbox) — ignores real evidence, re-surfaces items the user just nailed. C (asymmetric: failures count, successes don't) — feels unfair and hard to explain; the guardrail on A already solves the failure mode C targeted.

#### J.1.d Feedback format — review-style immediate feedback (option A)

**Decision:** Each item → immediate feedback (correct/incorrect + Good/Hard/Easy beat) → next. Same rhythm as a normal review session. No end-of-session score report.

**Consequence:** the surface is **"Practice Mode"**; the PRD v1 **"Quiz"** framing retires. The quiz/test (test-style, batch, score-at-end) job lives in Assessments + mock exams — naming follows function.

**Why:** immediate feedback beats delayed for retention; test-style's value is *assessment*, which is already covered three ways (skip-tests, end-of-chapter Assessments, Goal Overlay mock exams). Building test-style here would duplicate that machinery; the genuinely-uncovered need (targeted drill) wants immediate feedback.

**Rejected:** B (test-style only) — worse for learning, duplicates assessment surfaces. C (both, user toggles) — splits the feature; Quiz half overlaps existing Assessments. Over-scope for MVP.

#### J.1.e Item availability — learned-items-only (option A)

**Decision:** Practice Mode only offers items the user has already been taught (have a mastery/FSRS record). Future items stay **visible** in the Outline (browse / skip-test) but are **not** drillable in Practice.

**Why:** Practice presents a Check with no Teach beat — drilling an unseen item is a cold quiz on material never shown (frustrating, pedagogically backwards, violates Teach-before-Check). Also protects FSRS data: with A every Practice item already has a record to update (consistent with J.1.c); drill-ahead would mint FSRS records via cold-quiz failures, polluting the schedule. The legitimate "I already know this future chapter" need is already served by the per-chapter skip-test (I.4.d).

**Rejected:** B (drill-ahead) — cold-quizzes unseen items; pollutes FSRS with artificial "Again" ratings.

**What's OUT / deferred for J.1:** interaction with daily target / streak (Phase K — soft signals); whether Practice contributes to any "goal met today" signal deferred there.

### J.2 Progress Dashboard (complete)

A lean "scoreboard" surface answering *how much do I know, and am I improving?* — distinct from the Curriculum Outline's *where am I in the path?*

#### J.2.a Earns a distinct surface — lean analytics job (option A, lean)

**Decision:** Ship a distinct Progress Dashboard that owns what existing surfaces don't: **aggregate mastery counts, modality profile, and momentum over time.** Positional detail stays in the Curriculum Outline (links there, doesn't duplicate). Guardrail: a metric ships only if it **motivates** (progress %) or is **actionable** (weak spot → Practice Mode); vanity metrics that are neither don't ship.

**Why (boundary with existing surfaces):**
- Curriculum Outline (I.4.e) answers *where am I in the path* (positional, not counted).
- Goal Overlay readiness tracker (I.2.b) answers *goal progress* — but exam-only, goal-relative.
- Mastery breadcrumbs (G.1) are per-item, not rolled up.
- Gap: for a **non-exam learner** there is no surface saying "you're 80% through Foundation, production is your weak spot." Aggregate mastery + modality profile have no home. That's the dashboard's job.

**Rejected:** B (fold a summary header into the Outline) — overloads a navigation surface with analytics, makes both worse; map and scoreboard are different questions. C (cut for MVP) — data already exists; "look how far you've come" is a known retention lever; cheap to surface if kept lean.

#### J.2.b Granularity — aggregate + item-type breakdown (option B)

**Decision:** Two levels deep. Top-line aggregate ("X of Y Foundation items mastered, Z%") + **one-level breakdown by the four item types** (Kana / Vocab / Kanji / Grammar, each with %). Modality profile (recognition / recall / production) shown at aggregate level (and per item-type where readable). **No individual-item list.** Each weak spot links to the matching **Practice Mode** scope (J.1.b item-type filter).

**Why:** aggregate-only (A) motivates but isn't actionable — user can't tell what to work on. Item-type breakdown is exactly the actionable layer ("Kanji is weak" → drill Kanji), and clicks together with Practice Mode. Two deep is enough to act and stays lean.

**Rejected:** A (aggregate-only) — fails the actionable half of the guardrail. C (full per-item drill-down list) — analytics product nobody acts on ("猫 is at 0.72 recall"); duplicates Outline lesson/key-item drill + FSRS resurfacing. Per-item "show my weak kanji" want is already served indirectly (Practice "weakest" shortcut, Outline per-chapter state); a separate inspect-list is a clean v2 add if beta demands it.

#### J.2.c Momentum element — cumulative curve + recent-rate callout (option B)

**Decision:** Show learning **output over time**: a cumulative mastery curve (total items mastered by week) **plus** a recent-rate callout ("this week +28, last week +19"). Data modeled from timestamped mastery-events.

**Boundary with Phase K:** Phase K owns **behavioral consistency** (streaks, daily targets, did-you-show-up). Dashboard momentum owns **learning output** (results over time). Effort-consistency metrics — minutes studied, review-session adherence, streaks — are **deferred to Phase K**, not built here.

**Boundary with readiness tracker:** the exam-learner readiness tracker (I.2.b) **stays separate** — the dashboard may surface a link/snippet for Goal Overlay users but does not absorb it (readiness is goal-relative + exam-only; the dashboard is universal).

**Why:** the cumulative curve delivers the core "I am measurably getting better" payload with one honest chart; the rate-delta adds near-term momentum and is a trivial add once mastery-events are timestamped (which they are). Activity-rich panels (C) pre-empt Phase K and risk two surfaces fighting over the "did you show up" story.

**Rejected:** A (cumulative curve only) — fine but leaves the cheap, motivating rate-delta on the table. C (rate + time-spent + review-adherence panel) — consistency/effort metrics belong to Phase K.

**Honest caveat noted:** a cumulative curve only goes up (mastery rarely drops), so it's low-information as analytics — but its job is purely motivational ("you're moving"); the actionable load is carried by the J.2.b modality + item-type breakdown.

### J.3 Media Learning — Feature 8 (complete)

The bring-your-own-content tool (PRD v1 Feature 8): learner supplies real Japanese content they care about (song lyrics, a clip's dialogue) and gets it decoded into a vocab/grammar breakdown. **Deferred from MVP first cut** (PRD §9.1) — this locks the *posture/architecture* the eventual build must honor, not an immediate implementation.

#### J.3.a Legal posture — transient processing, zero retention (option A)

**Decision:** Fetch/receive media text → extract vocab/grammar → generate the breakdown → **discard the source text immediately.** Nothing copyrighted is persisted. The only stored artifact is the generated breakdown, composed of references to **our own licensed item DB**. Discard must be **architecturally enforced** (no sneaky caching, no transcripts retained in logs).

**Why (consistency with E.2):** E.2's intent is "don't build a system whose corpus is other people's copyrighted work." Transient, user-initiated, discard-after-processing doesn't build a corpus — it's ephemeral analysis (like a browser rendering a page). The persisted lesson is *our* items, not the source's text.

**Rejected:** B (cache/store transcripts for speed + improvement) — storing third-party transcripts builds exactly the derivative copyrighted-content database E.2 forbids, just user-sourced; caching convenience isn't worth converting an ephemeral-analysis story into a "we host copyrighted media" story. C (drop bring-your-own, curated CC/public-domain library only) — legally cleanest but guts the value prop (personal relevance — *the* song/clip they love); a weaker, different feature.

#### J.3.b Ingestion path — user-supplied text only (option C; D noted as future)

**Decision:** The user **supplies the text themselves** (paste lyrics/transcript, or upload their own file/recording). We do **not** fetch from any platform. Zero platform-ToS exposure — the user sourced the text under their own personal-use rights; we process-and-discard it.

**Why:** C is the only path fully consistent with J.3.a and the strict licensing posture for a solo founder with no legal team. Programmatic fetch (A — `youtube-transcript-api` and friends) sits in YouTube-ToS grey zone, breaks constantly, and risks C&D — bad foundation. Official-APIs-only (B) is ToS-clean but mostly doesn't work: YouTube's caption API can't reach most auto-captioned videos, and licensed lyric APIs cost money + carry redistribution limits — promises a feature it can't deliver for the common case.

**Future escalation (D, noted not locked):** paste-as-floor + *opportunistic* programmatic fetch as a convenience layer with graceful fallback to paste. The fetch half inherits A's ToS risk, so it's a deliberate later choice taken with eyes open — only if usage data shows paste-friction kills adoption.

**Consequence:** because we never fetch/store the media, Media Learning is a **text-comprehension** tool — the user watches/listens on their own player; there is **no in-app audio playback of the source**. Clean side-effect of the posture, not a separate decision.

#### J.3.c Output + item-system integration — breakdown + opt-in scheduling of known items (option B)

**Decision:** Output = a **read-only annotated breakdown** of the supplied text (vocab glossed, grammar points flagged, notes/translation). Where a token maps to an **existing item** in our DB, link to it with the learner's current mastery; **plus** an opt-in to add those already-existing items to the review queue ("add these 8 words to your reviews"). Tokens that aren't items (proper nouns, rare slang, misparsed) are glossed inline only — **no item minted, nothing scheduled.**

**Why:** the reference breakdown (option A behavior) is most of the value — full decode of content the learner cares about. Adding **opt-in scheduling of items that already exist in our curated DB** makes the strongest learning moment ("I just met 食べる in a song I love") durable, cheaply and safely — FSRS only ever ingests vetted items, never arbitrary media vocab. Early Foundation learners still benefit: unknown words often exist as (unlearned) items, so media can pull-forward vocab.

**Rejected:** A (breakdown only, nothing scheduled) — inert; wastes the reinforce-what-you-just-met moment. C (full 3-beat lesson + mint novel vocab as new items + schedule) — collides with two locked decisions: (1) unvetted auto-minted items rot a DB whose entire quality story (E.1, F-series) rests on canonical sources + editorial review by a user who is **not** a linguist (hard constraint); (2) violates items-first quality posture. Turns a personal comprehension tool into an uncontrolled content pipeline.

**Honest caveat:** value depends on how much of typical media maps to existing items. Non-item tokens stay gloss-only and unscheduled — that's the correct outcome, not a bug.

---

## Phase K — Confidence + soft signals

### K.1 Confidence self-rating — lightweight, SRS-feeding "guessed?" flag (option C)

**Decision:** No confidence prompt on every item. Instead, an **optional one-tap "I guessed" flag** on guess-prone (recognition / multi-choice) items. Unchecked → normal scoring. Checked **and correct** → **downgrade the FSRS rating** (treat as Hard, not Good). No flag on production items (speaking/writing — answer quality already reveals confidence).

**Why:** the real problem confidence solves is **multiple-choice guessing** — our recognition formats (I.4.b vocab/kanji/kana multi-choice, J.1) let a learner guess right; FSRS sees "correct" and schedules it far out, but the AI grader (G.3) literally cannot observe "I guessed." The flag converts the scheduler's strongest false-positive into correct signal at near-zero friction (skip it and nothing changes). Because it **only ever downgrades** (never inflates), the failure mode is conservative — worst case schedules a known item slightly too soon, the safe direction to err.

**Rejected:** A (cut entirely, lean on FSRS self-correction — a lucky guess eventually re-tests and fails, pulling it back) — defensible and leaner, but knowingly lets the scheduler trust lucky guesses in guess-heavy formats. B (collect qualitative, don't feed SRS) — the half-measure trap (same logic as J.1): if it doesn't change behavior, "self-awareness" is a thin payoff nobody acts on. Either it influences the system (C) or you cut it (A); don't collect-and-ignore.

**Caveat:** self-reported "I guessed" is noisy (some under-claim, some never tap), but the downgrade-only design keeps the noise conservative.

### K.2 Daily-commitment mechanic — "learning streak" (forgiving), not a login streak (option B, hardened)

**Decision:** Use a streak, but redesigned to defeat streak-gaming. The daily target captured at signup (I.3.b Q3) defines "a day done." Four defining properties:

1. **Meaningful daily requirement (no token shortcut).** "Day done" = **clear your due FSRS reviews** + hit your self-set daily target (a lesson / committed minutes). The due-reviews requirement is the crux — spaced review of decaying items is the highest-retention action in the app, so the *cheapest* streak-preserving action **is** the highest-value learning act. Fallback when zero reviews are due (new / caught-up learner): "day done" = one **completed** lesson or practice unit (a meaningful unit, never a single card — or the token-tap hole reopens).
2. **Demoted prominence.** The streak is a small, calm supporting indicator; the **hero metric is learning progress** (J.2 mastery curve / "you can now understand X"). Pride/attention attach to learning, not the counter. Streak's only job is the door; the experience inside is about learning.
3. **Decay-anchored, honest re-engagement nudge.** Notifications tie to FSRS having due items — *"3 words are starting to fade — a quick review keeps them (and your run going)"* — not streak-loss guilt. The nudge fires exactly when returning produces real learning value, so the hook wraps the authentic spaced-repetition reason to return rather than manufacturing one.
4. **Bounded grace.** Streak-freezes / grace days so a real-life miss is survivable, but **capped** (e.g., a small earned/monthly allowance) so the number still means something. (Exact cap = sub-decision, not locked here.)

**Design principle behind it (the reframe):** you don't *defeat* streak-gaming (Goodhart's Law — any streak becomes an optimization target); you **redirect** it. Duolingo's gamed minimum (a 1-XP token lesson) is worthless, so gaming destroys learning. Here the gamed minimum is "your due reviews," so optimizing for the streak and optimizing for learning point the same direction. Achieves the user's stated goal: **"come for the streak, stay for the learning."**

**User intent (verbatim framing):** wants to avoid Duolingo's failure where "people login and do a quick lesson just to keep the streak rather than logging in to learn" — wants the streak to hook without becoming the goal.

**Rejected:** A (classic consecutive-day streak, zero-reset) — maximal loss-aversion but punishes the committed adult who travels and loses a 60-day chain; clashes with the honest brand. C (rolling "N of last 7 days," no streak) — gentle but never triggers the loss-aversion that makes streaks effective; largely inert as a motivator. D (no commitment mechanic) — leaves real habit-formation value on the table; feature-thin. B-naive (forgiving streak without the anti-gaming properties) — still collapses into a login streak; the four properties are what make B work.

**Honest caveats:** (1) gaming can't be fully eliminated — someone sets a tiny target and does exactly it — but because their floor is "due reviews," even the gamed floor is the precious action. (2) Demoting the streak weakens its raw hook somewhat; deliberate trade — calmer streak is gamed less, hook carried by the honest due-review nudge. Right trade for a motivated-adult audience. (3) Unlimited grace makes the streak meaningless → hence bounded.

### K.3 Streaks / daily-targets / nudges — remaining details (complete)

#### K.3.a Streak-freeze grace — earned, capped (option A)

**Decision:** Bounded grace via **earned freezes** — bank a freeze by over-delivering past your daily target (e.g., ~2× one day); **capped** at a small number stored (~2–3). A used freeze represents real prior work already done.

**Why:** makes grace *funded by genuine learning*, not gifted — using a freeze isn't cheating, you banked it by doing the equivalent work earlier, so the streak still represents continuous real learning. Same reframe as K.2: even "freeze farming" = doing extra learning (benign). The cap keeps it bounded (can't bank a month of coasting).

**Rejected:** B (fixed monthly allowance, freezes gifted regardless of effort) — cheapens the streak. C (auto-protect single miss, no accumulation) — simplest/gentlest and a legitimate MVP cut, but costless auto-protection slightly erodes meaning and gives nothing to earn. A wins on brand fit; C is the pragmatic simplification if needed.

#### K.3.b Does Practice Mode count toward "day done"? — anchor on due reviews (option A)

**Decision:** The **due-review session** (G.4-capped batch, ~10–15 items) anchors "day done." Practice Mode (J.1) counts toward the *target/effort* layer and the no-reviews-due fallback, and helps clear due items if scoped to include them, but **does not substitute** for the review session when reviews are due.

**Why:** K.2's integrity rests on *cheapest streak-preserving action = highest-value learning act = clearing due reviews* (items at optimal spaced-repetition timing). Letting Practice substitute reopens a milder Duolingo hole: streak alive while a backlog of genuinely-due items decays. The bar isn't punishing — the due session is the G.4-capped batch (~few min), so "reviews + your practice" is a small add.

**Rejected:** B (any genuine learning counts; Practice fully substitutes) — defensible lenient/values alternative (don't invalidate real learning), but quietly surrenders the steer-toward-highest-value-action property the streak was designed around. Locked A; noted B can feel paternalistic (20 min of Practice but skipped reviews → "day not done").

#### K.3.c Daily-target adjustment — user-editable + system-suggested (option B)

**Decision:** Target stays **user-editable** in settings; **plus** the system *suggests* recalibration on a sustained mismatch (consistently over- or under-delivering vs target), and the **user confirms**. Never silent. Decrease suggestions (struggling → lower bar) are purely supportive; increase suggestions (ready for more) are positive, user-confirmed growth nudges.

**Why:** protects streak-bar integrity (K.3.a/b) — a stale signup target drifts out of calibration: too-low reopens gaming, too-high punishes honest effort. Detection is modest (actual vs target over a rolling window; mastery-events already stored for J.2). Keeps learner in control.

**Rejected:** A (static, user-editable only) — legitimate MVP cut, but most users never revisit the number so miscalibration persists. C (fully auto-adjusted, no consent) — silently moving (esp. raising) the target is goalpost-moving; off-brand trust violation.

#### K.3.d Notification cadence + quiet hours — decay-driven, capped 2, role-differentiated + smart-suppressed (option B, hardened)

**Decision:** Decay-driven nudges, **hard cap 2/day**, with:
- **Role-differentiation** (the two pings never repeat): **primary** decay nudge at preferred time ("here's your day / 3 words fading") + optional **evening last-call backstop** ("still time before your day resets"), framed helpful, not guilt.
- **Smart suppression** — nothing fires once "day done" is complete. A consistent learner therefore experiences **≤1/day** (the evening one self-suppresses); the 2nd only ever reaches someone who hasn't done their day yet, **once**, as a genuine backstop. Evening backstop is **default-on** (so forgetful learners get it) but suppressed-when-done.
- **User-set preferred time + quiet hours**, **one-tap global off** (no dark-pattern friction), **decay-honest tone** — never streak-loss guilt.

**Why:** the bitterness driver isn't the integer 2 — it's (a) a 2nd ping that *repeats* the first (nag) and (b) guilt tone. Role-differentiation + smart-suppression remove both: the 2nd has a distinct helpful job and never lands on someone already done. Extends K.2's decay-anchored honest-nudge principle.

**Rejected:** A (one fixed daily, no decay logic) — respectful but rote; pings identically whether or not return has value, training people to ignore it. C (configurable multi-touch, several default touchpoints) — the Duolingo road; defaulting to multiple pings courts resentment. **Evolution note:** initial proposal was a flat ≤1/day cap; user pushed back ("is twice so bad?"), resolved to cap-2-but-effectively-≤1-via-suppression.

#### K.3.e Milestone celebrations — curated, capability-anchored (option B)

**Decision:** A **small curated set** of celebration moments, each marking a **real capability gain**, celebrated proportionally (bigger moments, bigger marks). E.g.: all kana mastered, first real conversation completed, first media clip decoded, first chapter done, Foundation-Complete (I.3.c), Track-Complete.

**Design rule (keeps it honest):** anchor celebrations to **capability gains** ("you can now do X"), **not arbitrary counters** ("100 items!" / "7-day streak!") — those are the hollow ones. Consistent with comprehension/capability-first brand. The honest test: *would the learner feel proud of this independent of the app's framing?*

**Rejected:** A (only Foundation/Track-Complete) — too sparse; lets genuine motivating moments (all-kana, first conversation) pass unremarked. C (frequent micro-celebrations: per-lesson confetti, streak-number milestones) — Duolingo trap; cheapens every celebration, trains dopamine-seeking over learning (same pathology as streak-gaming). **Caveat:** "capability gain" needs a definition so the set stays small — an authoring-time curation call, not a system feature.

---

## Phase L — Tech stack

**Founder profile driving these choices:** solo, full-stack capable (web JS/TS + React, Python, some mobile), **mobile-first** for MVP. Governing principle throughout: *minimize ops + build in the founder's strongest language* over chasing marginal capability. Constrained by CC.1 (multi-language future-proofing) + CC.2 (backend platform-agnostic, one client for MVP).

### L.1 Mobile client framework — React Native + Expo (option A)

**Decision:** **React Native + Expo (managed workflow).** One codebase iOS+Android; reuses the founder's React/TS fluency; Expo covers our actual native needs — mic capture (`expo-audio`), push notifications (`expo-notifications`, for K.3.d), OTA updates; web-extensible later via `react-native-web` (CC.2).

**Why:** building in the founder's strongest language (React) beats Flutter's marginal performance/polish edge, which would cost a new language (Dart) for no offsetting benefit at MVP scale. Our hardware needs are light (record→upload audio, standard UI + notifications) — clear of React Native's weak spot (heavy on-device real-time audio/DSP).

**Rejected:** B (Flutter) — Dart, reuses no React knowledge. C (native Swift+Kotlin) — two codebases, untenable solo. **Sub-note:** Expo *managed* (with config plugins / dev clients) over bare RN — removes the solo-hostile native build toolchain.

### L.2 Runtime backend — TypeScript everywhere, NestJS (option B)

**Decision:** **TypeScript backend (NestJS).** Same language as the RN client → shared API types, one mental model, half the dependency surface to maintain solo.

**Why (cuts against the "AI app = Python" reflex):** we *orchestrate AI APIs, we don't train models* — Python's ML/data-science moat doesn't apply. Anthropic + Azure have first-class TS SDKs. Our JP-specific runtime libs are already JS-native: **kuromoji** (tokenizer) + **wanakana** (kana util) from H.2, and **ts-fsrs** (G.2 scheduler). Python's one apparent edge — JMdict/KANJIDIC2 ingestion — is erased by **jmdict-simplified** (dictionaries pre-parsed to clean JSON for JS/TS). Frontend↔backend language parity is a real solo-founder multiplier.

**Rejected:** A (Python/FastAPI) — buys an unused ecosystem, loses frontend parity, re-bridges JS-native JP tooling. C (TS runtime + Python offline scripts) — reasonable escape hatch if a specific Python lib proves indispensable for the offline authoring pipeline; don't start polyglot, collapse to C only on concrete need. **Sub-note:** NestJS (opinionated structure/DI) over bare Express/Fastify for a maintainable solo codebase.

### L.3 Data stores — Postgres + pgvector, one database (option A)

**Decision:** **Postgres** for relational (items/lessons/users/mastery/FSRS state) **+ pgvector** for the E.3 reference-corpus embeddings — **one database** for both.

**Why:** E.3 deliberately scoped vectors to *reference material only* (Tatoeba + grammar reference + graded news) → tens-to-low-hundreds of thousands of vectors, well within pgvector's comfortable range; dedicated vector DBs earn their cost only at millions-to-billions + high QPS. One datastore = one backup/security/monitoring surface (major solo simplification). No lock-in: embeddings migrate to Qdrant/Pinecone via a script if ever outgrown — so "pgvector now" costs nothing later.

**Rejected:** B (dedicated vector DB at MVP) — pays money + ops complexity for unneeded scale. C ≡ A with an explicit exit clause (revisit only if the Tier-1 corpus balloons). **Caveat:** pgvector HNSW-index tuning + RAM for high-dim embeddings need mild attention as the corpus grows; non-issue at our size.

### L.4 AI provider — Anthropic primary, thin abstraction, tiered (option A)

**Decision:** **Anthropic (Claude) as default provider**, called through **one thin internal `LLMClient`** (swappable, per-task model selection). **Model tiering:** **Claude Opus** for offline drafting/authoring (quality-critical, low volume); **Claude Haiku** (or Sonnet where nuance matters, e.g. writing-eval feedback) for runtime grading + interactivity (high volume, latency/cost-sensitive — grading fires every lesson).

**Why:** the capability-sensitive work is *editorial-quality generation* (lesson drafting, natural example sentences — F.4 reviews for tone/naturalness since the founder isn't a linguist), where Claude has a real edge in nuanced instruction-following + long-form writing; founder is already in the Claude ecosystem (Claude Code). Not a moat — OpenAI is fully capable — but a reasonable lean made low-stakes by the abstraction.

**Rejected:** C (full multi-provider routing at MVP) — over-engineering; doubles prompt-tuning surface + adds a second billing/rate-limit/failure surface for a problem (provider risk, cost arbitrage) not yet present. *Build the seam, not the framework.* **Caveat:** single-provider lean means a Claude outage degrades the live app; the abstraction *enables* OpenAI failover but wiring it is post-MVP — at MVP the provider is an accepted dependency (like Azure for speech).

### L.5 Speech stack — Azure Neural TTS, consolidated, cached (option A)

**Decision:** Consolidate **all speech on Azure** — STT + Pronunciation Assessment already locked (H.1), add **Azure Neural TTS** for spoken Japanese. **Authored-audio cache:** generate TTS once at publish time, store in object storage, reuse; runtime TTS only for genuinely dynamic generated content (cost + latency control). Client capture/playback via `expo-audio` (from L.1).

**Why:** one speech vendor = one SDK/bill/credential surface (same logic as L.3's single DB). Azure's Japanese neural voices are clear + natural with SSML pitch/speed control (slow-for-learners); for a *learning* app, clarity > the emotional expressiveness where ElevenLabs leads.

**Rejected:** B (best-of-breed TTS — ElevenLabs/OpenAI/Google split from Azure STT) — marginal naturalness gain not worth a second speech provider. **Caveat:** Azure voices are recognizably TTS on some phrasings — fine for examples/listening; if beta flags it for *immersion* content, spot-swap a premium voice for that subset; human-recorded kana/pronunciation audio is a possible authoring-time add, not an MVP blocker.

### L.6 Hosting + infra — low-ops managed stack (option A)

**Decision:** **Low-ops managed stack.** Sensible-default services locked: **Railway** (NestJS container) · **Neon** (managed Postgres + pgvector, serverless, branching) · **Cloudflare R2** (object storage — cheap, no egress fees) · **Clerk** (managed auth, strong RN support) · **Expo EAS** (mobile build + app-store submit).

**Why:** a real backend (L.2) wants a real-but-managed home — a container PaaS runs NestJS with near-zero infra work, the sweet spot between underpowered BaaS and babysitting Kubernetes. Containerized NestJS stays portable, so starting on a PaaS has no lock-in — migrate to a hyperscaler only when scale demands. **Auth outsourced** (Clerk): high-risk, low-differentiation, easy to get subtly wrong — exactly what to not hand-roll solo.

**Rejected:** B (AWS/GCP hyperscaler at MVP) — premature IAM/VPC/ops complexity for scale not yet needed. C (Supabase/Firebase *as* backend) — would underuse the deliberate NestJS choice (L.2); use managed pieces *under* the backend, not instead of it. **Caveat:** PaaS costs more than raw cloud at high scale + Neon scale-to-zero adds first-request cold-start latency; both non-issues at MVP, both have clean upgrade paths before a hyperscaler is warranted.

### L.4.a Provider split — Anthropic for authoring, Gemini Flash for grading (amends L.4, locked 2026-06-15)

**Decision (amendment to L.4):** Split providers by task. **Anthropic** stays the default for **offline authoring** (#21d drafter = Opus 4.8, critic = Haiku 4.5 — quality-sensitive, one-time spend). **Google Gemini 2.5 Flash** becomes the default for **runtime grading** (#8 open-response rating — recurring per-user spend, rubric-based). Both providers sit behind the same thin `LLMClient` interface from L.4 — the existing `AnthropicLlmClient` keeps its role; a new `GeminiLlmClient` lands alongside it; the grading code path selects per task.

**Why:** trigger was the founder discovering Claude.ai subscription does *not* include API credits, so ongoing API spend is a real solo-bootstrap concern. Cost/quality breakdown for our actual workloads:
- **Authoring is one-time + quality-sensitive** — ~$50-100 total for ~100 lessons; Opus has a real edge on Japanese naturalness; the F.3 critic gate doesn't fully substitute for drafter quality. Wrong place to squeeze pennies.
- **Grading is recurring + quality-equivalent** — rubric-based scoring of short open answers (G.3 → 4-level FSRS rating). Both Haiku 4.5 and Gemini 2.5 Flash are well above the capability bar for this. Pricing: Flash ~$0.30/$2.50 per MTok vs Haiku ~$1/$5 (~3x cheaper at paid tier) — plus a real free tier (~15 RPM, ~1500 req/day) covering dev + early-beta.
- **Build the seam, keep it thin (L.4 principle preserved).** Adding one second provider for a specific recurring task is not "full multi-provider routing" (which L.4 rejected as over-engineering) — it's the seam being used as designed.

**Concrete env contract:** `GEMINI_API_KEY` joins `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` in `apps/api/.env.example`. `LLM_GRADING_MODEL` retains its meaning but now defaults to `gemini-2.5-flash`; `LLM_AUTHORING_MODEL` continues to default to `claude-opus-4-8` (drafter) with critic at `claude-haiku-4-5` per L.4. Provider selection is keyed by task, not by global default.

**Rejected at this decision point:**
- **All-Gemini (Pro for authoring + Flash for grading)** — biggest absolute $ savings but a real-not-imagined quality risk on lesson naturalness; F.3 critic catches structural errors, not flat prose. Authoring quality echoes for the lifetime of the curriculum.
- **All-Anthropic, no split** — ~$100-200 lifetime to MVP, totally fine financially, but free-tier Gemini for grading is genuinely free at solo + early-beta scale and the seam is already there.
- **Anthropic primary + OpenAI fallback (post-MVP L.4 caveat)** — OpenAI no longer has a meaningful free tier (~$5 trial credit only); Gemini fills the cost-arbitrage role better for our specific recurring workload.

**Caveats:**
- Free tier dies in real beta — ~15 RPM / ~1500/day is fine for solo dev + handful of testers but won't survive a serious user load. Plan: once paid Flash kicks in, it's still ~3x cheaper than Haiku, so the per-token economics keep working.
- Provider behavioral drift on borderline grading cases — different models judge "almost right" answers slightly differently, so the grading prompt is tuned against Flash from day one (avoids the re-tune cost of swapping later).
- Single-provider availability risk per task — if Gemini has an outage, grading degrades; the `LLMClient` interface *enables* Anthropic failover for grading but wiring it is post-MVP. Authoring is offline, so an Anthropic outage delays drafting, not learners.

**Implementation hand-off:** new GitHub issue tracks the `GeminiLlmClient` + switching #8's grading path (kept narrow — provider swap, not a re-architect). #21d authoring stays on Anthropic per L.4 model tiers.

---

## Phase M — MVP scope cut + Beta launch slice

The final phase: turns the locked design into a buildable first slice. Beta exists to answer two questions — *does the AI-generated content actually teach, and does the retention loop bring learners back?*

### M.1 Beta Foundation slice — ~100-lesson end-to-end vertical (option B)

**Decision:** Beta content = a **~100-lesson end-to-end vertical slice** of *early* Foundation: onboarding/placement → full kana → ~150–200 highest-frequency vocab → first ~15–20 N5 grammar points → light kanji → basic multimodal lessons → a capability milestone ("you can introduce yourself / read simple sentences"). 3–6 weeks of daily material.

**Why:** smallest *true* vertical slice — exercises every differentiated mechanic (all four item types, mastery breadcrumbs, FSRS reviews, multimodal Integration lessons, teach→practice→check, soft-signals) on real content, reaching a real milestone, so it can measure *do they learn + do they return*. Authorable solo in weeks, not months.

**Rejected:** A (kana-only, ~30–50 lessons) — too thin; validates kana pedagogy but never touches the comprehension/communication thesis (the differentiated bet). C (half-Foundation, ~200–250 lessons) — front-loads months of authoring before any external signal; risks discovering lesson-format problems *after* sinking weeks into content. B lets the format be validated on ~100 lessons, fixed, then scaled.

### M.2 Beta modalities — Foundational + L/R/W + guided speaking; defer dialogue/scenario (option B)

**Decision:** Beta includes **F-Kana / F-Vocab / F-Grammar / light F-Kanji + I-Listening / I-Reading / I-Writing / I-Speaking (guided pronunciation only) + Review + Assessment.** Deferred: **open speaking-dialogue, I-Scenario, Media Learning** (J.3 already out of MVP).

**Why (risk cut and pedagogy agree):** "speak early" is the headline differentiator, so cutting speaking entirely (A) would leave the most distinctive claim unvalidated. But full open dialogue + scenario (C) is the heaviest eval to build *and* has nothing to evaluate at lesson ~100 — early learners pronounce words/phrases, they don't hold free conversations. Guided speaking via Azure Pronunciation Assessment (H.1) tests speak-early where it actually lives; dialogue/scenario defer to post-beta when learners have enough language for it to matter.

**Rejected:** A (defer all speaking) — guts the thesis. C (include dialogue + scenario) — overkill for early-Foundation learners; effort spent on content beta users can't reach.

### M.3 Beta feature surface — full reachable surface (option A) *(user override of recommended B)*

**Decision:** Ship the **full reachable surface** in the beta: core lesson loop + FSRS reviews + full placement quiz (I.4) + per-chapter skip-tests (I.4.d) + Curriculum Outline (I.4.e) + Practice Mode (J.1) + Progress Dashboard (J.2) + full streak/soft-signals (K). **Out by construction** (early Foundation never completes): all post-Foundation surfaces — Track Modules, Goal Overlay/JLPT-N4, Foundation-Complete intake (I.3.c).

**Why (user's call; legitimate case):** several deferred-candidate surfaces — Dashboard, Practice Mode, Curriculum Outline, streak — are *retention* mechanics, and "do they come back?" is half the beta thesis. A stripped core under-tests retention; the full surface tests the *real* product experience including whether the surfaces themselves drive return.

**Recommended (B, not taken):** lean core loop + FSRS + minimal progress + streak + notifications + lightweight signup routing; defer Practice/skip-tests/Outline/Dashboard/full-placement as additive surfaces validatable after the core loop proves out. **Accepted tradeoff of A:** materially more to build before first learner signal; risk of polishing surfaces atop a core loop beta might change. Mitigated by M.4 sequencing (core loop validated first via tracer bullet even within a full-surface build).

**Rejected:** C (middle) — same direction as B, less far.

### M.4 Launch sequence — tracer-bullet vertical slice first (option B)

**Decision:** **Tracer-bullet first** — build **one complete lesson flowing end-to-end through every system** (item DB → lesson player → check → AI grading → FSRS → review → progress) before scaling. Once it proves the architecture + lesson format: scale content authoring **in parallel** with building remaining surfaces. **Rollout:** dogfood (founder + a couple trusted learners) → closed beta (handful of handpicked near-beginners, qualitative depth) → iterate on core loop → wider beta.

**Why:** de-risks the architecture on lesson *one* not lesson 100 (this is the direct mitigation of M.3-A's accepted risk — the core loop gets validated first even in a full-surface build); produces a testable artifact in days; lets the long pole (content authoring, F.7 review-intensity calibration) start as soon as the format is proven, parallelizing the two work streams.

**Rejected:** A (platform-complete → content → beta) — integration risk surfaces late; nothing testable until near the end. C (content-first) — backwards; authoring 100 lessons with no player to test them in means format problems can't be caught.

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

**Design grilling COMPLETE — all phases A–M locked.** No phases remain open. Final phase M (MVP scope cut + beta launch) resolved: ~100-lesson early-Foundation vertical slice / Foundational + L/R/W + guided speaking / full reachable surface / tracer-bullet-first build sequence. Next step is **implementation**, beginning with the M.4 tracer bullet (one lesson end-to-end through every system). See `progress.md` for the build-phase hand-off.
