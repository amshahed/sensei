# Item Ingestion

ETL pipeline for canonical Japanese-language data into the `Item` table. Pure data load — no AI calls. Implemented in `apps/api/src/ingest/`.

Run any command against your local database:

```sh
pnpm --filter api ingest:items <kind> [--source <path>]
```

All commands are **idempotent**: re-running upserts by `Item.id` and never duplicates.

---

## Kana — hiragana + katakana

```sh
pnpm --filter api ingest:items kana
```

No `--source` needed. Data is hard-coded in `src/ingest/kana-data.ts`.

- **Scope:** 46 hiragana + 46 katakana = 92 basic kana (no combo characters).
- **IDs:** `ja:kana:<romaji>` for hiragana, `ja:kana:kata-<romaji>` for katakana.  
  Examples: `ja:kana:a` (あ), `ja:kana:kata-a` (ア), `ja:kana:shi` (し).
- **`data` shape:** `{ romaji: string, script: "hiragana" | "katakana" }`

---

## Vocab — jmdict-simplified (JLPT N5–N4)

```sh
pnpm --filter api ingest:items vocab --source ./data/jmdict-eng-3.5.0.json
```

**Source file:** Download the latest `jmdict-eng-*.json` from  
<https://github.com/scriptin/jmdict-simplified/releases>  
(look for `jmdict-eng-*.json`, ~30 MB compressed).

- **Filter:** keeps words where any `kanji[].tags` or `kana[].tags` contains `jlpt-n5` or `jlpt-n4`.
- **Scope for beta slice:** ~150–200 entries (N5 freq band).
- **IDs:** `ja:vocab:<primary_kanji_form>` or `ja:vocab:<kana_form>` if no kanji.
- **`data` shape:**
  ```json
  {
    "writing_forms": ["猫"],
    "readings":      ["ねこ"],
    "senses":        ["cat"],
    "jmdict_id":     "1234567",
    "jlpt":          "N5"
  }
  ```

---

## Kanji — kanjidic2-simplified (JLPT N5)

```sh
pnpm --filter api ingest:items kanji --source ./data/kanjidic2-*.json
```

**Source file:** Download the kanjidic2 JSON from  
<https://github.com/scriptin/jmdict-simplified/releases>  
(file named `kanjidic2-*.json`).

- **Filter:** keeps characters where `misc.jlptLevel === 5` (N5 = ~80 characters; beta slice needs ~30).
- **IDs:** `ja:kanji:<literal>` — e.g. `ja:kanji:日`, `ja:kanji:本`.
- **`data` shape:**
  ```json
  {
    "meanings":     ["day", "sun"],
    "on_readings":  ["ニチ", "ジツ"],
    "kun_readings": ["ひ", "か"],
    "stroke_count": 4,
    "jlpt":         "N5"
  }
  ```

---

## Grammar — Tanos N5 shells

```sh
pnpm --filter api ingest:items grammar --source ./data/tanos-n5-grammar.json
```

**Source file:** Create a JSON file from the Tanos N5 grammar list at  
<http://www.tanos.co.uk/jlpt/jlpt5/grammar/>

The ingestor accepts **JSON** (`.json`) or **TSV** (`.tsv` / `.txt`).

### JSON format

```json
[
  { "pattern": "〜は〜です",   "description": "Topic + copula (A is B)", "jlpt": "N5" },
  { "pattern": "〜が",         "description": "Subject marker particle",  "jlpt": "N5" },
  { "pattern": "〜て-form",    "description": "Connective / request form","jlpt": "N5", "prereqs": ["ja:grammar:verb-stem"] }
]
```

Fields: `pattern` (required), `description` (optional — filled by drafter in #21d), `jlpt` (optional, defaults to `"N5"`), `prereqs` (optional, array of item IDs).

### TSV format

```
pattern	description	jlpt	prereqs
〜は〜です	Topic + copula	N5
〜が	Subject marker	N5
```

Columns: `pattern`, `description`, `jlpt`, `prereqs` (comma-separated IDs). Header row skipped automatically when first cell is `pattern`.

- **IDs:** `ja:grammar:<slug>` where slug is a URL-safe version of the pattern.  
  Examples: `ja:grammar:は`, `ja:grammar:-verb`.
- **`data` shape:**
  ```json
  {
    "pattern_name": "〜は〜です",
    "jlpt_level":   "N5",
    "prereqs":      []
  }
  ```

Grammar item `meaning` fields are empty shells — filled by the AI drafter in issue #21d.
