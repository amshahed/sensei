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

## output/

Generated files land here. The directory is gitignored — only `.gitkeep` is committed.
