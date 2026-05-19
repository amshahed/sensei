# Product Requirements Document (PRD)

# Product: Japanese Fluency Learning App  
**Working Name:** Sensei
**Version:** MVP — Phase 1  
**Document Type:** Product Requirements Document  

---

# 1. Product Vision

## Mission

Enable users to **understand and use real Japanese in daily life**, including:

- Conversations  
- YouTube content  
- Songs  
- Social media  
- Articles  
- Anime  
- Real-world interactions  

This product prioritizes:

- Real comprehension  
- Real speaking ability  
- Real content exposure  

Not memorization alone.  
Not textbook-only learning.

---

# 2. Problem Statement

Existing language apps:

- Teach vocabulary well  
- Teach kana adequately  
- Provide exercises  

But fail at:

- Producing conversational confidence  
- Helping users understand real native content  
- Building long-term usable fluency  

Typical learner outcome:

"I recognize words, but I still cannot understand real Japanese."

---

# 3. Product Goals

## Primary Goal

Enable users to:

- Speak natural Japanese  
- Understand spoken Japanese  
- Read everyday Japanese  
- Consume real Japanese media  

---

## Secondary Goals

Enable users to:

- Travel comfortably in Japan  
- Understand social media content  
- Understand YouTube videos  
- Watch anime  
- Add Japanese proficiency to professional credentials  

---

# 4. Target Users

## Primary Persona — Curious Learner

Profile:

- Interested in Japanese language or culture  
- Watches anime or Japanese content  
- Wants conversational ability  
- Wants real understanding  

Motivations:

- Cultural interest  
- Media consumption  
- Travel  
- Career development  

---

## Secondary Persona — Returning Learner

Profile:

- Previously used apps (Duolingo etc.)  
- Knows some vocabulary  
- Still lacks fluency  

Pain Points:

- Cannot speak comfortably  
- Cannot understand natural speech  

---

# 5. Product Philosophy

The product follows five principles:

1. Learn through usage  
2. Speak early  
3. Learn from real content  
4. Grammar supports communication  
5. Confidence drives progress  

---

# 6. Core Learning Journey

The system is structured into phases.

---

# Phase 0 — Foundations

## Goal

Build literacy.

## Includes

- Hiragana  
- Katakana  
- Core sounds  
- Basic vocabulary  

## Outcome

User can:

- Read kana  
- Recognize simple words  

---

# Phase 1 — Survival Communication

## Goal

Speak basic Japanese.

## Includes

- Greetings  
- Introductions  
- Simple requests  

## Outcome

User can:

- Speak short sentences  
- Handle basic interactions  

---

# Phase 2 — Daily Language Understanding

## Goal

Understand everyday spoken Japanese.

## Includes

- Beginner YouTube content  
- Short casual speech  
- Social media clips  

## Outcome

User can:

- Understand simple spoken Japanese  

---

# Phase 3 — Media Fluency

## Goal

Understand entertainment content.

## Includes

- Anime  
- Songs  
- Podcasts  

## Outcome

User can:

- Follow media dialogue  

---

# Phase 4 — Reading Fluency

## Goal

Read real Japanese.

## Includes

- Articles  
- Blogs  
- Manga  

## Outcome

User can:

- Read natural Japanese text  

---

# Phase 5 — Language Ownership

## Goal

Use Japanese naturally.

## Includes

- Writing messages  
- Holding conversations  

## Outcome

User achieves:

- Functional Japanese proficiency  
- CV-level usable skill  

---

# 7. Core Feature Set (MVP)

---

# Feature 1 — Kana Learning System

Includes:

- Hiragana  
- Katakana  

## Functional Requirements

User can:

- Hear sound  
- Select correct character  
- Type character  
- Read words  

## Teaching Flow

Characters introduced in groups.

Example:

あ い う え お

Exercises include:

- Recognition  
- Listening  
- Typing  
- Reading  

---

# Feature 2 — Kanji Learning System

## Data Sources

Kanji selected from:

- Jōyō Kanji list  
- High-frequency Kanji datasets  
- Real-world usage frequency  

## Learning Method

Kanji introduced:

- In sentences  
- With vocabulary  
- In reading context  

Example:

食 → eat  
寿司を食べます  
(I eat sushi)

---

# Feature 3 — Grammar System

## Reference Models

Inspired by:

- Genki sequence  
- Japanese teaching curriculum  
- Conversational learning structures  

(Not copied directly.)

## Grammar Progression

Typical order:

1. Basic sentences  
2. Particles  
3. Verb conjugations  
4. Adjectives  
5. Requests  

## Teaching Method

Grammar introduced:

- Through usage  
- Not lecture-first  

---

# Feature 4 — Listening System

## Input Types

- Dialogues  
- Audio clips  
- Videos  
- Songs  

## Exercise Types

### Recognition

Listen → choose correct meaning  

### Dictation

Listen → type sentence  

### Translation

Listen → choose translation  

---

# Feature 5 — Speaking System

Critical feature.

## Methods

### Repeat After Model

User repeats:

こんにちは

Speech analyzed.

### Roleplay Conversations

Examples:

- Ordering food  
- Asking directions  
- Greeting someone  

AI responds dynamically.

### Read-Aloud Mode

User reads:

- Text  
- Articles  
- Dialogue  

Speech analyzed.

## Technology Requirement

Speech Recognition API required.

Examples:

- Google Speech-to-Text  
- Azure Speech  
- OpenAI Speech  

---

# Feature 6 — Reading System

## Content Types

- Signs  
- Menus  
- Articles  
- Manga panels  

## Reading Levels

Level 1: Words  
Level 2: Short sentences  
Level 3: Dialogues  
Level 4: Articles  

---

# Feature 7 — Writing System

Primary method:

Typing-based writing.

## Writing Tasks

Includes:

- Sentence translation  
- Response writing  
- Message typing  

Example:

English:

I drink coffee.

User writes:

コーヒーを飲みます

---

# Feature 8 — Media Learning System (Core Differentiator)

## Content Types

- YouTube clips  
- Anime scenes  
- Song lyrics  
- Social media clips  

## Media Learning Flow

User watches media.

System provides:

- Subtitles  
- Vocabulary breakdown  
- Grammar explanation  
- Replay capability  

---

# 8. Scenario-Based Learning System

Real-world situations.

## Initial Scenario Set

Includes:

- Greetings  
- Ordering food  
- Shopping  
- Asking directions  
- Booking hotel  

Each scenario includes:

- Listening  
- Speaking  
- Reading  
- Writing  

---

# 9. Feedback System

Immediate feedback provided.

Includes:

- Pronunciation corrections  
- Grammar suggestions  
- Writing corrections  

## Confidence Feedback

User rates:

"How confident do you feel performing this in real life?"

Scale:

1–5

---

# 10. Progress Tracking

User dashboard displays:

- Vocabulary learned  
- Kanji learned  
- Grammar completed  
- Speaking score  
- Listening score  
- Reading completion  

---

# 11. Content Strategy

## Free Sources

- Japanese Wikipedia  
- Government publications  
- Creative Commons datasets  

## Licensed Sources (Future)

- Publishers  
- Media providers  

---

# 12. Technical Requirements

Required systems:

- Speech recognition  
- Text processing  
- Media playback  
- Content database  
- User progress tracking  

---

# 13. MVP Feature Summary

Included:

- Kana learning  
- Kanji system  
- Grammar engine  
- Listening exercises  
- Speaking engine  
- Reading system  
- Writing system  
- Scenario learning  
- Starter media module  

Excluded:

- Full JLPT mode  
- Handwriting recognition  
- Tutor marketplace  

---

# 14. Future Roadmap

## Phase 2

Includes:

- JLPT preparation  
- Advanced Kanji  
- Essay writing  

## Phase 3

Includes:

- Live tutors  
- Community features  
- Conversation partners  

---

# 15. Success Metrics

Measured by:

- Listening accuracy  
- Speaking confidence  
- Content comprehension  
- Session duration  

Example target:

User understands 70% of beginner-level video content.

---

# 16. Risks & Challenges

## Risk 1 — Speech Recognition Accuracy

Mitigation:

Multiple feedback methods.

## Risk 2 — Content Licensing

Mitigation:

Start with open-source content.

## Risk 3 — User Overload

Mitigation:

Progressive complexity.

---

# 17. Next Steps

You are now entering:

Product Design Phase

Required deliverables:

1. Wireframes  
2. Lesson 1 design  
3. Content structure  
4. Technical architecture  

---

# Immediate Recommended Action

Design:

**Lesson 1 — Day 1 User Experience**

That lesson defines:

- Teaching method  
- UX style  
- Learning philosophy  
- Product identity  