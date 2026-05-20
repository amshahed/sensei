# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

This repository is **pre-implementation** but has an active, structured design in progress. No source code yet. Current artifacts:

- `docs/PRD_v1.md` — original product vision (Apr 2026 vintage; preserved as historical, do not edit)
- `docs/PRD_v2.md` — current PRD draft, reflecting design decisions resolved so far. Work-in-progress; sections corresponding to unresolved phases are flagged TBD.
- `decisions.md` — append-only log of every design decision resolved, with reasoning. Source of truth for *what was decided and why*.
- `progress.md` — phase-by-phase progress tracker. Source of truth for *what's done, what's open, what's next*.

When the user asks to "build" or "run" something, first confirm whether they want you to scaffold a new project (and which stack), since none currently exists.

## Active Design Work

The user is partway through a structured grilling session (`/grill-me` skill flow) to take Sensei from high-level idea to implementation-ready design. The session has resolved Phases A–G plus H.1 (Speaking evaluation) plus cross-cutting principles CC.1 (multi-language future-proofing) and CC.2 (multi-platform readiness). Currently mid Phase H (per-modality evaluation), specifically at **H.2 — Writing evaluation**. Full state lives in `progress.md` and `decisions.md` — read those first when picking up.

If continuing the grilling session:
1. Read `decisions.md` end-to-end. Resolved decisions cascade — later branches depend on earlier choices.
2. Read `progress.md` to see open phases and the specific sub-decision in flight.
3. Grilling cadence: assistant recommends one option per branch with reasoning, user picks/pushes back/clarifies, then move to the next branch. Don't skip ahead or batch.

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
