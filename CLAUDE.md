# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

This repository is **pre-implementation**, but the structured design is **complete**. No source code yet. Current artifacts:

- `docs/PRD_v1.md` — original product vision (Apr 2026 vintage; preserved as historical, do not edit)
- `docs/PRD_v2.md` — current PRD, reflecting the full resolved design (all phases A–M). Serves as the implementation reference; versions up to PRD_v3 if material design shifts emerge during build.
- `decisions.md` — append-only log of every design decision resolved, with reasoning. Source of truth for *what was decided and why*.
- `progress.md` — phase-by-phase progress tracker. Source of truth for *what's done, what's open, what's next*.

When the user asks to "build" or "run" something, first confirm whether they want you to scaffold a new project, since none currently exists. The stack is decided (see Phase L below) — confirm intent, not the stack.

## Design State — COMPLETE (A–M locked)

The `/grill-me` design session that took Sensei from idea to implementation-ready design is **finished**. All phases A–M plus cross-cutting principles CC.1/CC.2 are resolved and recorded in `decisions.md` (full rationale) and `progress.md` (status board). Highlights:

- **A–H:** philosophy (fixed scaffold + AI content), lesson structure (3-beat micro-lessons; Module→Chapter→Lesson), data model (items first-class, mastery on items), item/lesson authoring pipeline, mastery + FSRS spaced repetition, per-modality evaluation.
- **I:** branching — Content Track × Goal Overlay intake, two-touchpoint intake, placement quiz + per-chapter skip-test + Curriculum Outline.
- **J:** standalone surfaces — Practice Mode, Progress Dashboard, Media Learning (deferred from MVP).
- **K:** confidence "I guessed" flag + anti-gaming "learning streak" + soft-signal details.
- **L (tech stack):** React Native + Expo client · TypeScript + NestJS backend · Postgres + pgvector · Anthropic (Claude) primary behind a thin `LLMClient` · Azure Speech (STT/pronunciation/TTS) · low-ops managed hosting (Railway · Neon · Cloudflare R2 · Clerk · Expo EAS).
- **M (MVP cut):** ~100-lesson early-Foundation vertical-slice beta · Foundational + L/R/W + guided speaking · full reachable surface · **tracer-bullet-first** build sequence.

**Next step is implementation, not more grilling.** Per M.4, begin with the **tracer bullet**: one complete lesson flowing end-to-end through every system (item DB → lesson player → Check → AI grading → FSRS → review → progress), then scale content authoring in parallel with surface build. Read `decisions.md` + `progress.md` before starting — decisions cascade, and the build must honor every locked choice. If the user reopens a design question, a new decision is appended to `decisions.md` (never rewrite past entries).

## Hard Constraints to Internalize

- **The user is NOT a Japanese teacher or linguistic expert.** Design decisions must accommodate this. Authoring workflows lean on AI-drafted content with the user reviewing for editorial quality (tone, flow, naturalness), not linguistic correctness. Linguistic correctness comes from canonical data sources (JMdict, KANJIDIC2, Tanos lists) or from a contracted Japanese teacher in v2.
- **The user wants honest pushback, not flattery.** Direct quote: "be honest and straight. don't want you to please me, or agree with me for the sake of it." When you have a recommendation, defend it. When you see a problem with an idea, name it.
- **Licensing posture is strict.** Copyrighted reference books (Genki, *Dictionary of Basic Japanese Grammar*, etc.) are read by the user personally to inform prompt design — they are NEVER ingested into the system. Only freely-licensed materials (Tae Kim CC-BY-NC-SA, Tatoeba CC-BY 2.0, Tanos, Wikipedia, etc.) go into the vector DB. See `decisions.md` §E.2 for full posture.

## Product Context

**Sensei** is the working name for a Japanese fluency learning app. Key product principles:

- **Philosophy:** real comprehension and speaking ability over memorization. Speak early; learn from real content; grammar serves communication.
- **Architecture:** fixed scaffold + AI-generated content within it. Foundation phase shared by every learner (~JLPT N5, ~300-500 micro-lessons); goal-based Track Modules branch after.
- **Anti-fake-personalization positioning:** the app does NOT promise personalization from minute one. Foundation is shared; personalization is real after Foundation. This is intentional product differentiation: "if other apps personalize from minute one, they are either lying or providing useless variation."
- **Out of MVP scope:** full JLPT prep beyond N5, handwriting recognition, tutor marketplace, multi-user / classroom features.

## Working Conventions

- PRDs use heavy markdown sectioning with `#`-level headers and short bulleted phrases. Match this voice; don't rewrite into paragraphs.
- PRDs version up: never edit `PRD_v1.md`. Edit `PRD_v2.md` while it's a draft; spin up `PRD_v3.md` when v2 is finalized and material design shifts.
- `decisions.md` is append-only. Don't rewrite past entries. If a decision is overturned, add a new entry referencing the old one.
- `progress.md` is the live status board; update it when sub-decisions resolve or phases move.
- Tasks in the TaskList mirror `progress.md` phases. When updating one, consider updating the other.
- There is no README; the PRD plays that role for now. If you create a README, link to the PRD instead of duplicating content.
