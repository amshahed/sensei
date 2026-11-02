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

**JMdict has no JLPT data**: it carries no `jlpt-*` tags. Level membership comes from the Tanos-derived lists committed at `apps/api/data/jlpt/n5-vocab.csv` / `n4-vocab.csv` (see `data/jlpt/SOURCES.md` for provenance and CC BY attribution, and decisions.md §E.1.a for the rules). Each `expression,reading,meaning` row is joined to a JMdict entry on (spelling, reading):

- **Normalisation:** alternatives are split (`足; 脚`), positional pairs become separate rows (`回る、回す / まわる、まわす`), affix markers are stripped (`～円`), optional parts are tried both ways (`パート (タイム)`), suru-verbs are matched to the noun (`運動 / うんどうする`), and swapped columns are retried.
- **Homophones:** candidates are ranked by gloss overlap with the row's *primary* meaning (text before the first `;`), then by how concentrated that overlap is (specific `点ける` beats catch-all `付ける`), then usually-kana, then `common`, then JMdict order. The meaning column is used only for this.
- **Duplicates:** a row whose best match was already taken by an earlier row names the same word (`掛ける` then `かける`), so it's skipped. The exception is when an untaken candidate also shares its meaning (`キロ` taken → `キロメートル`). A word on both lists keeps N5.
- **Everything skipped is printed:** unmatched rows, duplicate rows, and *low-confidence* picks (candidates tied on every signal) that are worth a look.
- **Taught spelling:** the list's spelling (`これ`, not the rare `此れ`). The exception is a word whose primary sense is *usually kana*: it's taught in kana, with the kanji as a writing form (`居る` → `いる`, `珈琲` → `コーヒー`).
- **Senses / writing forms:** only senses that apply to the matched reading are kept, and kanji spellings JMdict tags rare / search-only / irregular / outdated are dropped.

Result on jmdict-eng-3.6.2: **1,358 items (N5 702, N4 656)**, 0 null meanings. 4 malformed upstream rows are unmatched, 25 duplicates are skipped, and 3 picks are flagged low-confidence.

- **IDs:** `ja:vocab:<spelling>`, qualified **only when spellings collide**: by reading (`ja:vocab:方:かた`, `ja:vocab:方:ほう`), or by JMdict id for kana homophones (`ja:vocab:いる:1577980` "to be", `ja:vocab:いる:1546640` "to need").
- **IDs are sticky:** once a JMdict word has an id, re-ingesting keeps it, and a new word never takes an id already in use. So list edits and new JMdict releases can't rename or re-point ids. A stored word that drops off the lists keeps its row but has its `jlpt` level cleared (logged).
- **`data` shape:**
  ```json
  {
    "writing_forms": ["猫"],
    "readings":      ["ねこ", "ネコ"],
    "senses":        ["cat (esp. the domestic cat, Felis catus)", "feline", "shamisen"],
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

**Source file:** <https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2> (`bunzip2` it; format `id\tjpn\ttext`). Needs `VOYAGE_API_KEY`. Tokenising the whole file takes ~10–20 s.

**Run `ingest:items vocab` and `kanji` first.** The full Japanese corpus (~250k sentences) would be about 2 GB once embedded (1024-dim) and HNSW-indexed, which is over Neon free tier's 1 GiB. So for each VOCAB/KANJI item the ingester keeps its `--per-item` (default 8) **shortest** sentences (decisions.md §E.3.a). On jpn_sentences 2026-11: **~9.7k sentences, ~80 MB**, and every item gets at least one example.

- **Matching is morphological** (kuromoji): a vocab item matches a run of 1–4 tokens that spells it, with the last token also tried in dictionary form. So `食べました` → `食べる` and `おいしかった` → `おいしい`, but `ある` never matches inside `あるいは` or `その` inside `そのまま`. Grammatical uses don't count either: the auxiliary `ない` of `食べない`, the `いる` of `読んでいる`, the `ある` of `書いてある`. Kanji items match the character anywhere.
- **Reruns are incremental:** only sentences that are new, or whose text Tatoeba changed, are embedded, written in batched INSERTs of 100. Stored `tatoeba-*` rows the selection no longer keeps are reported and deleted only with **`--prune`**, so a trial run on a sample file can't wipe the corpus.
- Sentences of 5–120 characters are considered, so short beginner sentences like `猫が好きです。` are kept.

---

## Full run order (fresh database)

```sh
cd apps/api
pnpm ingest:items kana
pnpm ingest:items vocab   --source ./data/jmdict-eng-3.6.2.json
pnpm ingest:items kanji   --source ./data/kanjidic2-en-3.6.2.json
pnpm ingest:items grammar --source ./data/jlpt/n5-grammar.json
pnpm ingest:refs tatoeba  --source ./data/jpn_sentences.tsv   # add --prune to drop stale rows
pnpm authoring:skeleton                        # → tools/authoring/output/skeleton.json
```
