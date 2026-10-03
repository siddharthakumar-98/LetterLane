# Allowed-guess dictionary provenance

## v1.1.1 snapshot — September 13, 2026

The additional vocabulary was extracted directly from the public JavaScript
client served by [The New York Times' official Wordle game](https://www.nytimes.com/games/wordle/index.html).

- Source asset: [2178.8cbade74768ce64f5381.js](https://www.nytimes.com/games-assets/v2/2178.8cbade74768ce64f5381.js)
- Asset SHA-256: `65ea2a794321c782035d1ec5286d1c6429d95b00e0edc3b79d0de5f722c4f5ab`
- Source array: module `96329`, export `l`; 14,855 unique lowercase five-letter words.
- The game passes this array to its guess validator before displaying its invalid-word message.
- Only the vocabulary entries were imported, not the surrounding application code, answer schedule, artwork, or branding.

## Merge and preservation

The array was parsed as JSON without executing the downloaded JavaScript. Each
entry was checked against `[a-z]{5}`, converted to uppercase, combined with the
existing dictionary as a set, sorted alphabetically, and written to
`allowed-guesses.json`.

- Previous allowed guesses: 1,049.
- Imported source entries: 14,855.
- Newly accepted guesses: 13,807.
- Final allowed guesses: 14,856.
- Existing entries removed: **zero**.
- `FOOEY` is the sole existing LetterLane word absent from the source array and is retained.
- Previous allowed-guesses file SHA-256: `deb976fd5580118c3c008e274bd904795f33028a01e5bfa1e8c4fc8bf6364597`.
- `answers.json` is unchanged: 825 words, SHA-256 `a9ae0cde53d73d2e4e2bb2082132195cf6dc16dabd2cc6d21c078fbca075756f`.

This is a source snapshot, not an endorsement, affiliation, or promise of ongoing
parity with Wordle. LetterLane keeps its own answer selection and game rules.
Do not replace the answer list with all accepted guesses: the expanded list
contains uncommon words and inflected forms suitable as guesses.

For future updates, use the same union operation with the existing list, retain
local additions, record the new source and checksum, and run the dictionary and
multiplayer tests. Serving the application never contacts NYT or downloads words.

## Six- and seven-letter Words — September 29, 2026

Longer Words games reuse `../phrases/allowed-words.json`, the frozen SCOWL / English
Speller Database **rel-2026.02.25**, commit
`7e99edab8e32f9f9ea2b15f249ca8d4d67237410`. This is the raw ordinary-word asset,
not `PHRASE_WORDS`: phrase-specific contractions and answer exceptions are not
merged. Select exactly `[A-Z]{6}` or `[A-Z]{7}` into separate server-only sets:
**5,298** and **6,737** accepted guesses respectively. No new dictionary download,
dependency, runtime request, or client-side vocabulary is needed.

See [the existing SCOWL provenance and rebuild policy](../phrases/SOURCES.md)
and [the complete upstream license](../phrases/DICTIONARY-LICENSE.txt). It uses
SCOWL size 35, ordinary American/British usage, and excludes proper names,
abbreviations, uncommon/archaic/nonstandard categories and malformed forms.
The original five-letter vocabulary remains unchanged for compatibility.

`long-answers.json` is LetterLane's curated selection of familiar words from
those sets: **257** six-letter and **295** seven-letter answers. Candidates were
checked against the frozen vocabulary, filtered to the exact letter count,
deduplicated and alphabetically sorted. No rejected candidate is an exception
to validation. SHA-256:
`9936913f7191c142942298883c4394c742e5fea93f7e2b8aacc75d7993bc92e2`.
Tests enforce the answer/vocabulary subset invariant and valid A–Z lengths.
Answer selection remains random per room, excluding the previous answer;
rematches retain the room's length. Bots use only the matching answer pool.

This is spelling-list validation, not a semantic judgement of every possible
word. The conservative list may omit legitimate uncommon words; additions
should follow the documented SCOWL policy rather than accept arbitrary input.
