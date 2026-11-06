# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Import an Archidekt deck without browser access or website writes."""

import argparse
import json
from pathlib import Path

from mtg_utils.formats import get_format
from mtg_utils.research.acquisition import classify_archidekt, deck_id, fetch_archidekt
from mtg_utils.research.storage import read, write


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("deck")
    parser.add_argument("--format", required=True)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--payload", type=Path)
    args = parser.parse_args()
    identifier = deck_id(args.deck)
    raw = read(args.payload) if args.payload else fetch_archidekt(identifier)
    artifacts = classify_archidekt(raw, identifier, get_format(args.format))
    write(args.out, artifacts.pop("deck.json"))
    evidence = args.out.parent / (args.out.stem + "-import")
    write(evidence / "deck_raw.json", raw)
    for name, value in artifacts.items():
        write(evidence / name, value)
    print(json.dumps(artifacts["deck_validation.json"], indent=2))
    if not artifacts["deck_validation.json"]["complete"]:
        raise SystemExit("Incomplete deck; inspect import evidence before analysis")


if __name__ == "__main__":
    main()
