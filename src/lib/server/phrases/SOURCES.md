# Letterlane Phrases sources

## Initial phrase collection

- Collection: `proverbs.json`, 51 curated entries.
- Reference: [Wikipedia — List of proverbial phrases](https://en.wikipedia.org/wiki/List_of_proverbial_phrases).
- Pinned page: [revision 1370105338](https://en.wikipedia.org/w/index.php?oldid=1370105338&title=List_of_proverbial_phrases), retrieved 2026-09-22.
- Attribution: Wikipedia contributors; Wikipedia text is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This collection contains traditional short sayings, not the article's explanations. Preserve this attribution for the adapted selection.
- Changes: citations and explanatory/attribution text omitted; optional proverb wording expanded (`Birds of a feather (flock together)`); one consistent variant chosen for slash-separated entries (`A watched pot/kettle never boils`); `cannot` contracted to `can't` for the requested leopard example. Whitespace and case are normalized at load time. Apostrophes, commas, hyphens, and periods remain display-only punctuation.
- Entries have two to seven space-delimited words, with at most 15 letters per word and 105 total letters. Eight-word `Beauty is in the eye of the beholder` and eleven-word `A journey of a thousand miles begins with a single step` are deliberately excluded. The runtime collection loader also rejects malformed/oversized entries and removes duplicates.
- More collections can be added as JSON with `id`, `title`, `source`, and `phrases`, then registered in `PHRASE_COLLECTIONS` in `../phrases.ts`. Each loaded entry has a stable collection-prefixed ID, normalized text, `wordCount`, and `letterCount` for future filtering.

## Variable-length validation dictionary

The original Words dictionary accepts five-letter words only, so Phrases uses that same set plus a frozen variable-length supplement:

- Source: [dwyl/english-words](https://github.com/dwyl/english-words), `words_alpha.txt`.
- Download URL: https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt
- Retrieved 2026-09-22; upstream SHA-256: `3ed0c94610d8bcf7c11bbb49c56aa49c7234d32b66824df91f554169e572da48`.
- Frozen supplement: `allowed-words.json`, 359,041 entries. Built by retaining ASCII alphabetic words of 1–15 letters, limiting one-letter words to A and I, uppercasing, deduplicating, and sorting. The compact JSON format is intentional.
- Upstream repository license copied to `DICTIONARY-LICENSE.txt`. Upstream also documents its source provenance in its README.
- `../phrases.ts` adds the existing Words dictionary, explicit contractions, and every collection word, ensuring every answer can be submitted. Punctuation is ignored when looking up letters; hyphenated words may alternatively use independently valid dictionary components.
- This is a fixed word-list game, not a general spelling service: the supplement includes uncommon words, and some valid inflections/proper nouns may be absent. No network lookup occurs during play.

The full answer collections and dictionaries are server-only; browser bundles receive only the current punctuation/word-length template and evaluated guesses.
