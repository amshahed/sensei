# Authoring Tools

CLI tooling for the Sensei content authoring pipeline (F-series, decisions.md).

## Prerequisites

1. Set `ANTHROPIC_API_KEY` in your environment (or `.env` file in `apps/api/`)
2. Run `pnpm --filter api ingest:items` to populate the item DB (issue #34)
3. Ensure Postgres is running and `DATABASE_URL` is set

## outline — Compile the beta outline (F.1.b)

The beta's order is fixed (F.1.a), so its outline is compiled from a committed spec, with no model
call and no cost. Run this, not `skeleton`, for the beta.

```bash
pnpm --filter api authoring:outline [--output <path>] [--force]
```

| Flag | Default | Description |
|---|---|---|
| `--output` | `tools/authoring/output/skeleton.json` | Output path |
| `--force` | off | Replace an existing outline. Drafts are filed under its lesson ids |

Reads `apps/api/data/curriculum/foundation-ja-beta.json`, validates it (sound order, grammar
prerequisites, coverage floors, homophones), checks every item against the item table, and writes
the skeleton format below with `model: "compiled-outline"`. Needs `ingest:items supplement` first.

## grader-check — Live check of the AI grader (P6, P8)

Grades `apps/api/data/curriculum/grader-cases.json` through the runtime Gemini path, 3 runs per case,
against the meanings the supplement ingest will write. No database and no Anthropic spend. A case
passes only if every run agrees, and a fallback result fails the run.

```bash
pnpm --filter api authoring:grader-check --source <jmdict.json>
```

Run it before the default-branch supplement ingest, because the ingest only fills empty meanings.

## skeleton — Curriculum skeleton author (F.1)

Generates the Module → Chapter → Lesson skeleton for Foundation Japanese using Claude Opus.
The AI organises ingested items (kana, vocab, kanji, grammar) into a sequenced curriculum
targeting the "introduce yourself in Japanese" milestone (~100 lessons).

```bash
pnpm --filter api authoring:skeleton [--module foundation-ja] [--output <path>] [--force]
```

| Flag | Default | Description |
|---|---|---|
| `--module` | `foundation-ja` | Module ID to generate |
| `--output` | `tools/authoring/output/skeleton.json` | Output path (relative to workspace root) |
| `--force` | off | Replace an existing skeleton (see below) |

Output is written to `tools/authoring/output/skeleton.json` (gitignored).
The file is Zod-validated against the schema in `apps/api/src/authoring/skeleton-schema.ts`
before being written.

### Model

Uses `LLM_AUTHORING_MODEL` if set (a blank value counts as unset), otherwise `claude-opus-4-8`.
Max tokens: 20000 (the first live run used ~14.7k; a cut-off reply fails with a clear error).

**Generate once, then keep it.** Opus 4.8 accepts no `temperature`, so a re-run produces a
*different* skeleton — different chapter/lesson ids and groupings — and drafts are filed under
the old lesson ids. The CLI therefore refuses to overwrite an existing skeleton unless you pass
`--force`. The file records the model and real token usage it was generated with. It never replaces
a compiled outline, even with `--force`.

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
pnpm --filter api authoring:draft <lesson-id|chapter-id> [--skeleton <path>] [--corrections <path>] [--force | --recheck] [--max-cost <usd>]
```

| Flag | Default | Description |
|---|---|---|
| `<slug>` | required | Lesson ID (`foundation-ja-ch01-l01`) or chapter ID (`foundation-ja-ch01`) |
| `--skeleton` | `tools/authoring/output/skeleton.json` | Skeleton file to read |
| `--corrections` | `tools/authoring/corrections.jsonl` | Corrections log (few-shot) |
| `--force` | off | Redraft. Keeps the old draft as `<id>.prev.json`, deletes `<id>.critique.json` and clears `<id>.rejected.json`. A lesson with a `<id>.rejected.json` is told why that draft was rejected |
| `--recheck` | off | No model call, $0. Reruns the gate on each `<id>.rejected.json` (see below). Can't be combined with `--force` |
| `--max-cost` | none | Stop before the next paid lesson once the running estimate reaches this many US dollars |

Output: `tools/authoring/output/<lesson-id>.json` (gitignored).

A run never pays twice unless told to: a lesson with `<id>.json` or `<id>.rejected.json` is skipped
with no API call, so a batch can be resumed. The last line reports drafted, skipped, rejected and
estimated cost.

With a compiled outline, the drafter sees what the learner has been taught, and a free deterministic
gate checks the result for untaught kana, kanji, verb endings and particles. A draft that fails is
written to `<id>.rejected.json`, never `<id>.json`, the batch carries on and the command exits 1.
Publishing runs the same gate.

- **Particles (F.2.c, F.2.d).** Each learner field is read in stretches of kana and spaces.
  Punctuation, symbols, English, digits and kanji end a stretch, because a sentence doesn't run
  through them. Inside one stretch, a word that is exactly an untaught particle is rejected when the
  word before it is a word (two kana or more, or a known phrase) and the word after it, if any, is
  not a single kana. The error quotes the stretch:
  `uses the particle と before it is taught, in "ともだち と がっこう"`. Known words and taught
  grammar count as words, also across spaces (`おげんき です か`), and a known word of one kana
  (に, two) is never a particle.
  - **Pass:** a kana row, also after a word (`は ひ ふ へ ほ`, `こえ か き く け こ`); a row then
    words (`た ち つ て と そと くつ`); a kana set apart by punctuation or English (`と: そと`,
    `で: でんわ (phone)`, `In はな, は says ha.`, `かさ (か + さ)`, `Words with ね: ね, ねこ`);
    a mention in English (`The little words と (and), の ('s)`); a kana after a kanji (`名 な`).
  - **Rejected:** a real use (`ともだち と がっこう`, `はな と ひと`, `あなた は いしゃ です か 。`),
    and one mention: a kana written right after a word with nothing between them (`はな は says ha`).
    Write `In はな, は says ha.` instead.
  - **Choices:** outside kana and sound lessons, a choice or answer that is only an untaught
    particle is rejected.
  - **Still left to the critic and PM review:** a particle joined to a word (`ともだちと`), one
    before a one-kana word (`ねこ の え`) or after a kanji (`日本 から`), て-forms such as `みて`,
    and に in lessons 65 to 80, where it is also the number two.
  - **The draft prompt** lists the particles not taught yet, from the gate's own list, and says a
    kana shown on its own is fine when punctuation or English sets it apart.
- **Typed reading (F.2.b).** In a lesson with `typedReading`, the pipeline makes sure each target word
  the draft declares has a typed check showing it in kana with no rōmaji. It keeps a fair check,
  rewrites the prompt of a typed check whose answer is the word (punctuation aside, as the grader
  reads it) to `Read this word and type how it sounds: <word>`, or appends one. A target the draft
  left out of `targetItemIds` gets no check, so the gate's rule, which stays as the safety net,
  rejects the draft.

**Recovering a rejected draft at $0.** Run `--recheck` first whenever a code change could cure a
rejection. For each lesson with a `<id>.rejected.json`, it drops the old errors, applies the
typed-reading transform, and reruns the validator and the gate, exactly as for a fresh draft. A pass
is saved as `<id>.json` the way a fresh pass is. A fail rewrites `<id>.rejected.json` with the new
errors. It needs no `ANTHROPIC_API_KEY`. Only if it still fails, redraft with `--force`: the redraft
prompt lists the last rejection's errors and asks for every one to be fixed.

If `VOYAGE_API_KEY` is set, the drafter retrieves top-5 reference passages from the vector DB for context.
If not set, vector search is skipped silently — the drafter still works.

Model: `LLM_AUTHORING_MODEL` (blank = unset) or `claude-opus-4-8`. No `temperature` (Opus 4.8
rejects it), so redrafting the same lesson gives a different draft. Max tokens: 8000.

## critique — AI critic (F.3 / F.4)

Runs the structural validator + Claude Haiku 9-point checklist on an existing lesson draft.

```bash
pnpm --filter api authoring:critique <draft-path> [--skeleton <path>]
```

Output: `<draft-path>.critique.json`.

Model: `LLM_CRITIC_MODEL` (blank = unset) or `claude-haiku-4-5`. Temperature 0, so the same draft
gets the same verdict. Max tokens: 2048. Cost: about a cent per lesson ($1/$5 per million tokens).

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
| `--regenerate` | off | Re-run drafter with `--force` after send-back (uses updated corrections) |

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
