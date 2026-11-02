# JLPT level lists — sources and licences

These files decide **which** words and grammar points belong to a JLPT level
(decisions.md §E: "Tanos JLPT grammar / vocab / kanji lists — use as
authoritative taxonomy of what to teach per level"; rules in §E.1.a). Readings,
meanings and IDs come from JMdict / KANJIDIC2 at ingest time. The vocab
`meaning` column is used **only** to pick between JMdict homophones (そば
"beside" vs 蕎麦 "noodles") — it is never stored on an item or shown.

| File | Content | Source | Licence |
|---|---|---|---|
| `n5-vocab.csv`, `n4-vocab.csv` | `expression,reading,meaning` per JLPT word | [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) `src/n5.csv`, `src/n4.csv` (derived from tanos.co.uk vocab lists). Trimmed to the three columns we use; tags (incl. textbook-lesson tags) and Anki guids dropped. | Repo: MIT. Underlying lists: Tanos, CC BY |
| `n5-grammar.json` | 40 N5 grammar pattern names, in Tanos page order (`order`) | Jonathan Waller, tanos.co.uk N5 grammar list, via the Internet Archive snapshot <https://web.archive.org/web/20200726195103/http://www.tanos.co.uk/jlpt/jlpt5/grammar/> (tanos.co.uk stopped resolving in late 2026) | CC BY |

**Attribution (CC BY):** JLPT level lists by Jonathan Waller, tanos.co.uk —
"Everything on this site … is licenced under Creative Commons 'BY' … use
anything here however you like (commercial or non-commercial), but credit my
site." (tanos.co.uk/jlpt/sharing, archived
<https://web.archive.org/web/20251114165345/https://www.tanos.co.uk/jlpt/sharing/>).

Kanji levels need no list here: KANJIDIC2 carries a JLPT level per character
(on the pre-2010 four-level scale — see `src/ingest/kanji.ts`).
