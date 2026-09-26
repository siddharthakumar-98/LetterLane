"""Rebuild the frozen phrase vocabulary from a local, built SCOWL checkout.

Usage: python3 scripts/build-phrase-dictionary.py /path/to/wordlist
Run `make` in that checkout first. No downloads or runtime dependencies.
See src/lib/server/phrases/SOURCES.md for provenance and policy.
"""
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import subprocess
import sys

REVISION = "7e99edab8e32f9f9ea2b15f249ca8d4d67237410"
source = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
).strip()
if revision != REVISION:
    raise SystemExit(f"Expected SCOWL rel-2026.02.25 ({REVISION}), got {revision}")
db = sqlite3.connect(f"file:{source / 'scowl.db'}?mode=ro", uri=True)
# These are the SCOWL word-list size/dialect/category filters, plus explicit
# entry/group rank filters. Keep a word if any eligible ordinary sense exists.
rows = db.execute("""
    select distinct word from scowl_
    where size <= 35 and variant_level <= 1
      and spelling in ('_', 'A', 'B', 'Z') and region in ('', 'US', 'GB')
      and category = '' and usage_note != 'nonstandard'
      and base_pos not in ('abbr', 'pre', 'suf', 'wp', 'we', 'x')
      and pos not in ('wep', 'wes', 'weps')
      and pos_class not in
        ('abbr', 'abbr?', 'person', 'surname', 'place', 'name', 'name?',
         'trademark', 'upper', 'upper?')
      and group_rank in ('', '*') and entry_rank in ('', '*')
""")
# Case filtering happens BEFORE uppercasing: capitalized names and initialisms
# must not become ordinary words. A and I are the only one-letter entries.
words = sorted({word.upper() for (word,) in rows if re.fullmatch(r"[a-z]{2,15}|a|I", word)})
db.close()
destination = Path(__file__).resolve().parents[1] / "src/lib/server/phrases"
asset = (json.dumps(words, separators=(",", ":")) + "\n").encode()
(destination / "allowed-words.json").write_bytes(asset)
(destination / "DICTIONARY-LICENSE.txt").write_bytes((source / "Copyright").read_bytes())
print(f"{len(words)} words; {len(asset)} bytes; SHA-256 {hashlib.sha256(asset).hexdigest()}")
