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

## Vocab — jmdict-simplified × Tanos JLPT lists (N5–N4)

```sh
pnpm --filter api ingest:items vocab --source ./data/jmdict-eng-3.6.2.json
```

**Source file:** the latest `jmdict-eng-*.json.tgz` from
<https://github.com/scriptin/jmdict-simplified/releases> (~11 MB compressed, ~113 MB JSON). Put it under `apps/api/data/` (gitignored).

**JMdict has no JLPT data** — no `jlpt-*` tags exist in it. Level membership comes from the Tanos-derived lists committed at `apps/api/data/jlpt/n5-vocab.csv` / `n4-vocab.csv` (see `data/jlpt/SOURCES.md` for provenance + CC BY attribution). Each `expression,reading` row is joined to a JMdict entry on (spelling, reading):

- alternatives split (`足; 脚`, `回る、回す`), affix markers stripped (`～円`), optional parts tried both ways (`パート (タイム)`), suru-verbs matched to the noun (`運動 / うんどうする`), swapped columns retried
- ambiguous rows prefer a `common` entry; a word on both lists keeps N5
- unmatched rows are **printed, not silently dropped** (4 of 1,386 on jmdict-eng-3.6.2 — all malformed upstream rows)

Result on jmdict-eng-3.6.2: **1,352 items (N5 701, N4 651)**.

- **IDs:** `ja:vocab:<display>`, where display is the list's spelling (これ, not the rare kanji 此れ). When two JMdict words share a spelling, the later gets its reading appended: `ja:vocab:人` (にん) + `ja:vocab:人:ひと`.
- **`data` shape:**
  ```json
  {
    "writing_forms": ["猫"],
    "readings":      ["ねこ", "ネコ"],
    "senses":        ["cat (esp. the domestic cat, Felis catus)", "feline"],
    "jmdict_id":     "1467640",
    "jlpt":          "N5"
  }
  ```

---

## Kanji — kanjidic2 (JLPT N5)

```sh
pnpm --filter api ingest:items kanji --source ./data/kanjidic2-en-3.6.2.json
```

**Source file:** `kanjidic2-en-*.json.tgz` from the same jmdict-simplified releases page.

- **Filter:** KANJIDIC2 stores the **pre-2010 JLPT level (1–4, 4 = easiest; there is no 5)**. Old 4 ≈ N5, old 3 ≈ N4 (`toModernJlpt()` in `src/ingest/kanji.ts`). We ingest old-4 = **103 kanji**; the beta slice needs ~30.
- **IDs:** `ja:kanji:<literal>` — e.g. `ja:kanji:日`, `ja:kanji:本`.
- **`data` shape:**
  ```json
  {
    "meanings":     ["day", "sun", "Japan", "counter for days"],
    "on_readings":  ["ニチ", "ジツ"],
    "kun_readings": ["ひ", "-び", "-か"],
    "stroke_count": 4,
    "jlpt":         "N5"
  }
  ```

---

## Grammar — Tanos N5 shells

```sh
pnpm --filter api ingest:items grammar --source ./data/jlpt/n5-grammar.json
```

**Source file:** committed — `apps/api/data/jlpt/n5-grammar.json`, the 40 Tanos N5 grammar points in Tanos page order (`order` → `data.source_order`, which the skeleton author uses as the teaching-order signal). tanos.co.uk stopped resolving in late 2026; the list comes from its Internet Archive snapshot (see `data/jlpt/SOURCES.md`). Any other JSON/TSV in the format below also works.

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

---

## Reference corpus — Tatoeba example sentences (pgvector)

```sh
pnpm --filter api ingest:refs tatoeba --source ./data/jpn_sentences.tsv [--per-item 8]
```

**Source file:** <https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2> (`bunzip2` it; format `id\tjpn\ttext`). Needs `VOYAGE_API_KEY`.

**Run `ingest:items vocab` and `kanji` first.** The full Japanese corpus (~200k sentences) would be ~1.7 GB once embedded (1024-dim) and HNSW-indexed — over Neon free tier's 1 GiB. So the ingester keeps, for each VOCAB/KANJI item, its `--per-item` (default 8) **shortest** sentences containing it (shortest = most beginner-friendly). Verbs/adjectives also match on their kanji stem (食べ → 食べました). Expect ≤ ~10k sentences, ~90 MB, well under Voyage's free credit.

---

## Full run order (fresh database)

```sh
cd apps/api
pnpm ingest:items kana
pnpm ingest:items vocab   --source ./data/jmdict-eng-3.6.2.json
pnpm ingest:items kanji   --source ./data/kanjidic2-en-3.6.2.json
pnpm ingest:items grammar --source ./data/jlpt/n5-grammar.json
pnpm ingest:refs tatoeba  --source ./data/jpn_sentences.tsv
pnpm authoring:skeleton                        # → tools/authoring/output/skeleton.json
```
