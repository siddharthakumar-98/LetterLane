# Letterlane Phrases sources

## Initial phrase collection

- Collection: `proverbs.json`, 51 curated entries.
- Reference: [Wikipedia — List of proverbial phrases](https://en.wikipedia.org/wiki/List_of_proverbial_phrases).
- Pinned page: [revision 1370105338](https://en.wikipedia.org/w/index.php?oldid=1370105338&title=List_of_proverbial_phrases), retrieved 2026-09-22.
- Attribution: Wikipedia contributors; Wikipedia text is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). This collection contains traditional short sayings, not the article's explanations. Preserve this attribution for the adapted selection.
- Changes: citations and explanatory/attribution text omitted; optional proverb wording expanded (`Birds of a feather (flock together)`); one consistent variant chosen for slash-separated entries (`A watched pot/kettle never boils`); `cannot` contracted to `can't` for the requested leopard example. Whitespace and case are normalized at load time. Apostrophes, commas, hyphens, and periods remain display-only punctuation.
- Entries have two to seven space-delimited words, with at most 15 letters per word and 105 total letters. Eight-word `Beauty is in the eye of the beholder` and eleven-word `A journey of a thousand miles begins with a single step` are deliberately excluded. The runtime collection loader also rejects malformed/oversized entries and removes duplicates.
- More collections can be added as JSON with `id`, `title`, `source`, and `phrases`, then registered in `PHRASE_COLLECTIONS` in `../phrases.ts`. Each loaded entry has a stable collection-prefixed ID, normalized text, `wordCount`, and `letterCount` for future filtering.

## Phrase validation vocabulary

- Source: [SCOWL / English Speller Database](https://github.com/en-wl/wordlist), release **rel-2026.02.25**, commit `7e99edab8e32f9f9ea2b15f249ca8d4d67237410`.
- License: Kevin Atkinson's permissive SCOWL license (use, copy, modify, distribute and sell with attribution). The complete upstream `Copyright` is preserved in `DICTIONARY-LICENSE.txt`, including its source notices. No package dependency is added.
- Frozen asset: `allowed-words.json`, **39,632 entries**, **433,066 bytes**, SHA-256 `5402d89d3261dc4fe6505d80c0e344b6ce0e7fd94111f3703ece662bc7a99c36`.
- Policy: use SCOWL's small size **35**, standard American and British (-ise and -ize) spellings, maximum variant level 1, and ordinary categories only. Exclude abbreviation/initialism classes, proper-name classes, prefixes/suffixes/multi-word fragments, nonwords, nonstandard usage, and entries marked uncommon, archaic, infrequent or inapplicable. Keep lowercase ASCII alphabetic forms of 2–15 letters plus `a` and `I`, then uppercase, deduplicate and sort. Filtering case before uppercasing also excludes capitalized names and initialisms where upstream POS classification is incomplete.
- This is deliberately more conservative than a general spellchecker or Scrabble lexicon. SCOWL supplies spelling, usage and commonness metadata; the small list avoids its larger specialist/game-word tiers. A listed ordinary sense is sufficient; the game does not judge whether the assembled phrase is grammatical or meaningful as a sentence.
- `../phrases.ts` adds the existing explicit contraction forms and **every word in every answer collection**. These exceptions apply globally, independently of the current hidden answer. Words mode keeps its own unchanged dictionary. No Words dictionary is merged into Phrases.
- Apostrophes and terminal punctuation retain the existing display-only behavior: `CAN'T`, `DON'T`, `IT'S` validate via their playable letters. Hyphenated words may use independently allowed components (e.g. `WELL-KNOWN`). Malformed tokens are rejected before lookup.
- Limitations: a conservative fixed vocabulary may reject legitimate uncommon words or proper nouns outside the answer collections. Commonness is not a perfect semantic classifier. Expand the policy or curated answer collections deliberately; do not add one-off rejection lists.

The previous supplement was `dwyl/english-words`'s `words_alpha.txt` (359,041 retained entries, retrieved 2026-09-22, upstream SHA-256 `3ed0c94610d8bcf7c11bbb49c56aa49c7234d32b66824df91f554169e572da48`). It filtered only shape/length and also merged the Words-mode game lexicon. Neither source imposed ordinary-usage criteria, which admitted obscure and abbreviation-like entries. Both paths have been removed from phrase validation; the old supplement and its Unlicense notice have been replaced.

### Rebuilding

From a separate checkout of the pinned upstream release:

```sh
git clone --branch rel-2026.02.25 --depth 1 https://github.com/en-wl/wordlist.git /tmp/letterlane-scowl
make -C /tmp/letterlane-scowl
# From the LetterLane repository:
python3 scripts/build-phrase-dictionary.py /tmp/letterlane-scowl
```

Python/SQLite are only needed to rebuild the checked-in asset. The script verifies the upstream commit, reads SCOWL's built SQLite database using explicit metadata filters, writes deterministic compact JSON and copies the license. All gameplay validation is local set membership on the server; there are no dictionary-service calls or LLM decisions.

### Live feedback and authoritative submission

The browser sends only completed guessed words to `POST /api/phrases/validate`, using the public punctuation/length template for boundaries. The authenticated endpoint shares `isAllowedPhraseWord()` and `PHRASE_WORDS` with final submission. It accepts at most seven bounded strings, verifies origin, uses the existing 2 KiB body limit and database-backed rate limiter (60 checks/minute/player), and returns only corresponding validity booleans. It never loads a room or a hidden answer.

The client batches unknown words after 200 ms, caches up to 256 results for the mounted game, and ignores responses after the completed words change. Partial words are never marked invalid. Errors use the existing positional grammar and polite live region above the keyboard. In Phrases, that region sticks together with the keyboard so the keys cannot cover live feedback on mobile. A failed live request leaves neutral feedback and is not retried in a loop; editing can trigger another check. Every Enter submission still performs full server-side validation before scoring or persisting an attempt.

Answer collections and dictionaries remain server-only; browser bundles receive only templates, evaluated guesses and the validity of submitted words.
