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
