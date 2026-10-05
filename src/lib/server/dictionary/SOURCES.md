# Allowed-guess dictionary provenance

## Five-letter guesses — SCOWL, October 5, 2026

`allowed-guesses.json` holds **6,829** five-letter guesses built by
`scripts/build-words-dictionary.py` from SCOWL / English Speller Database
**rel-2026.02.25**, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410` (the same
pinned release as the phrase vocabulary).

- Policy: the phrase vocabulary's ordinary-word filters (standard American and
  British spellings, variant level 1, no names, abbreviations, fragments,
  nonstandard or ranked-uncommon entries), at SCOWL size **70** instead of 35,
  so less common but legitimate words such as ADIEU are accepted as guesses.
  Exactly `[a-z]{5}` before uppercasing. Sizes above 80 carry extra license
  terms and are not used.
- License: Kevin Atkinson's permissive SCOWL license; the upstream `Copyright`
  is preserved in `DICTIONARY-LICENSE.txt` beside this file.
- Asset: 6,829 entries, 75,122 bytes, SHA-256
  `af66819bb013986d9e74215550bd3e51ee1b351586602cf9e6474b9344d3a686`.
- Answers: `answers.json` (825 words, LetterLane's own curated selection,
  SHA-256 `a9ae0cde53d73d2e4e2bb2082132195cf6dc16dabd2cc6d21c078fbca075756f`) is
  unchanged. The build fails unless every answer is in the SCOWL list, so no
  answer is an exception to validation.

Rebuild from a built checkout of the pinned release (see
[the phrase source notes](../phrases/SOURCES.md#rebuilding)):

```sh
python3 scripts/build-words-dictionary.py /tmp/letterlane-scowl
```

### Removed: NYT-derived list

Until October 5, 2026 (v1.1.1 onward) this file held 14,856 guesses: 14,855
words extracted from the public JavaScript of The New York Times' Wordle game,
merged with LetterLane's earlier 1,049-word list. No license or permission for
that compilation was ever recorded, so it was replaced before monetization (see
[the ads readiness review](../../../../docs/ads-readiness-review.md)). None of
its entries were merged back; the current list is generated solely from SCOWL.
FOOEY, the one earlier LetterLane-only guess, is not in SCOWL and is no longer
accepted. Do not reintroduce extracted or unlicensed lists; document the source,
license, filter and checksum of any future change and run the dictionary and
multiplayer tests. Serving the application never downloads words.

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
Five-letter guesses use the larger size-70 build described above.

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
