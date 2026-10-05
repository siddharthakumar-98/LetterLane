"""Rebuild the five-letter Words guess list from a local, built SCOWL checkout.

Usage: python3 scripts/build-words-dictionary.py /path/to/wordlist
Run `make` in that checkout first. No downloads or runtime dependencies.
See src/lib/server/dictionary/SOURCES.md for provenance and policy.
"""
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

REVISION = "7e99edab8e32f9f9ea2b15f249ca8d4d67237410"
# SCOWL "large" tier. Guesses may be less common than answers; sizes above 80
# carry additional license terms, so stay at or below it.
SIZE = 70
source = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
).strip()
if revision != REVISION:
    raise SystemExit(f"Expected SCOWL rel-2026.02.25 ({REVISION}), got {revision}")
db = sqlite3.connect(f"file:{source / 'scowl.db'}?mode=ro", uri=True)
# The same ordinary-word filters as the phrase vocabulary, at a larger size.
rows = db.execute(f"""
    select distinct word from scowl_
    where size <= {SIZE} and variant_level <= 1
      and spelling in ('_', 'A', 'B', 'Z') and region in ('', 'US', 'GB')
      and category = '' and usage_note != 'nonstandard'
      and base_pos not in ('abbr', 'pre', 'suf', 'wp', 'we', 'x')
      and pos not in ('wep', 'wes', 'weps')
      and pos_class not in
        ('abbr', 'abbr?', 'person', 'surname', 'place', 'name', 'name?',
         'trademark', 'upper', 'upper?')
      and group_rank in ('', '*') and entry_rank in ('', '*')
""")
# Case filtering happens BEFORE uppercasing so names and initialisms stay out.
words = sorted({word.upper() for (word,) in rows if re.fullmatch(r"[a-z]{5}", word)})
db.close()
destination = Path(__file__).resolve().parents[1] / "src/lib/server/dictionary"
answers = json.loads((destination / "answers.json").read_text())
missing = sorted(set(answers) - set(words))
if missing:
    raise SystemExit(f"Answers missing from SCOWL size {SIZE}: {missing}")
asset = (json.dumps(words, indent=2) + "\n").encode()
(destination / "allowed-guesses.json").write_bytes(asset)
(destination / "DICTIONARY-LICENSE.txt").write_bytes((source / "Copyright").read_bytes())
print(f"{len(words)} words; {len(asset)} bytes; SHA-256 {hashlib.sha256(asset).hexdigest()}")
