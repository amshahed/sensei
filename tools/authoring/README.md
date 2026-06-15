# Authoring Tools

CLI tooling for the Sensei content authoring pipeline (F-series, decisions.md).

## Prerequisites

1. Set `ANTHROPIC_API_KEY` in your environment (or `.env` file in `apps/api/`)
2. Run `pnpm --filter api ingest:items` to populate the item DB (issue #34)
3. Ensure Postgres is running and `DATABASE_URL` is set

## skeleton — Curriculum skeleton author (F.1)

Generates the Module → Chapter → Lesson skeleton for Foundation Japanese using Claude Opus.
The AI organises ingested items (kana, vocab, kanji, grammar) into a sequenced curriculum
targeting the "introduce yourself in Japanese" milestone (~100 lessons).

```bash
pnpm --filter api authoring:skeleton [--module foundation-ja] [--output <path>]
```

| Flag | Default | Description |
|---|---|---|
| `--module` | `foundation-ja` | Module ID to generate |
| `--output` | `tools/authoring/output/skeleton.json` | Output path (relative to workspace root) |

Output is written to `tools/authoring/output/skeleton.json` (gitignored).
The file is Zod-validated against the schema in `apps/api/src/authoring/skeleton-schema.ts`
before being written.

### Model

Uses `LLM_AUTHORING_MODEL` env var if set, otherwise `claude-opus-4-8` (Claude Opus).
Temperature is fixed at 0 for deterministic output — re-running with the same DB state
and same model produces the same skeleton.

### Output format

```json
{
  "module": {
    "id": "foundation-ja",
    "title": "Foundation Japanese",
    "language": "ja",
    "chapters": [
      {
        "id": "foundation-ja-ch01",
        "title": "Hiragana Vowels",
        "lessons": [
          {
            "id": "foundation-ja-ch01-l01",
            "type": "F-Kana",
            "title": "The Five Vowels",
            "itemIds": ["ja:kana:a", "ja:kana:i", "ja:kana:u", "ja:kana:e", "ja:kana:o"],
            "estimatedMinutes": 7
          }
        ]
      }
    ]
  },
  "generatedAt": "2026-06-15T12:00:00.000Z",
  "model": "claude-opus-4-8",
  "tokenUsage": { "inputTokens": 4200, "outputTokens": 6800 }
}
```

### Lesson types

| Type | Description |
|---|---|
| `F-Kana` | Foundational kana recognition/recall |
| `F-Vocab` | Foundational vocabulary |
| `F-Kanji` | Foundational kanji introduction |
| `F-Grammar` | Foundational grammar pattern |
| `I-Listening` | Integration: listening comprehension |
| `I-Reading` | Integration: reading comprehension |
| `I-Writing` | Integration: writing practice |
| `I-Speaking` | Integration: guided speaking |

## draft — Lesson drafter (F.2 / F.3 / F.5)

Generates a full lesson draft (Teach + Practice + Check) for one lesson or all lessons in a chapter.
Reads the skeleton, loads item data from DB, optionally retrieves relevant corpus passages via Voyage AI,
and calls Claude Opus. Runs the structural validator after each draft.

```bash
pnpm --filter api authoring:draft <lesson-id|chapter-id> [--skeleton <path>] [--corrections <path>]
```

| Flag | Default | Description |
|---|---|---|
| `<slug>` | required | Lesson ID (`foundation-ja-ch01-l01`) or chapter ID (`foundation-ja-ch01`) |
| `--skeleton` | `tools/authoring/output/skeleton.json` | Skeleton file to read |
| `--corrections` | `tools/authoring/corrections.jsonl` | Corrections log (few-shot) |

Output: `tools/authoring/output/<lesson-id>.json` (gitignored).

If `VOYAGE_API_KEY` is set, the drafter retrieves top-5 reference passages from the vector DB for context.
If not set, vector search is skipped silently — the drafter still works.

Model: `LLM_AUTHORING_MODEL` env var ?? `claude-opus-4-8`. Temperature=0. Max tokens: 4096.

## critique — AI critic (F.3 / F.4)

Runs the structural validator + Claude Haiku 9-point checklist on an existing lesson draft.

```bash
pnpm --filter api authoring:critique <draft-path>
```

Output: `<draft-path>.critique.json`.

Model: `LLM_CRITIC_MODEL` env var ?? `claude-haiku-4-5-20251001`. Temperature=0. Max tokens: 2048.
Cost: ~$0.05/lesson.

### 9-point checklist

| # | Name | What it checks |
|---|---|---|
| 1 | tone | Friendly and encouraging, not academic |
| 2 | length | Appropriate for lesson type (5–10 min) |
| 3 | flow | Teach → Practice → Check progression is coherent |
| 4 | example-feel | Examples feel natural, not textbook |
| 5 | audio | Audio src values are relative placeholder paths |
| 6 | lesson-type-adherence | Content matches lesson type and item types |
| 7 | item-ref-match | All referenced items declared in targetItemIds |
| 8 | theme-tag-accuracy | Lesson title matches content |
| 9 | learner-confusion | No unexplained jargon; concepts build on each other |

## corrections.jsonl — Corrections log (F.5)

Flat JSONL file; each line is a correction entry:
```json
{ "lesson_type": "F-Kana", "original_draft": {...}, "notes": "...", "regenerated_version": null, "timestamp": "..." }
```

The drafter reads the 5 most recent entries of the same lesson type as few-shot examples.
When you send a draft back for revision, append a correction entry manually (editorial review UI is issue #38).

## review — Editorial review CLI (F.4)

Opens `$EDITOR` with a structured review template: lesson preview (Teach + first 3 Check questions) + 9-point checklist + Notes section.

```bash
pnpm --filter api authoring:review <lesson-id> [--skeleton <path>] [--regenerate]
```

| Flag | Default | Description |
|---|---|---|
| `<lesson-id>` | required | Lesson ID to review (must exist in `output/`) |
| `--skeleton` | `tools/authoring/output/skeleton.json` | Skeleton file for context |
| `--regenerate` | off | Re-run drafter after send-back (uses updated corrections) |

On save:
- **DECISION: APPROVE** → copies draft to `tools/authoring/published/<lesson-id>.json`; prints publish command
- **DECISION: SEND_BACK** → appends correction to `corrections.jsonl`; tip to re-run draft

### Checklist format

```markdown
DECISION: APPROVE

## Checklist

- [ ] tone
- [x] length — too short, add one more teach block
- [ ] flow
...

## Notes

General notes here.
```

## publish — Publish to database (F.6)

Writes the approved lesson JSON to `Module → Chapter → Lesson → LessonItem → Check` rows transactionally. Re-publishing is idempotent (upserts by slug).

```bash
pnpm --filter api authoring:publish <lesson-id> [--skeleton <path>]
```

| Flag | Default | Description |
|---|---|---|
| `<lesson-id>` | required | Lesson ID (must exist in `published/`) |
| `--skeleton` | `tools/authoring/output/skeleton.json` | Skeleton file for module/chapter hierarchy |

Prerequisites: `DATABASE_URL` set, `authoring:review` approved.

## output/

Generated draft files land here. The directory is gitignored — only `.gitkeep` is committed.

## published/

Approved (editor-reviewed) lesson drafts land here after `authoring:review` approves them. The directory is gitignored — only `.gitkeep` is committed. Files here are ready for `authoring:publish`.
