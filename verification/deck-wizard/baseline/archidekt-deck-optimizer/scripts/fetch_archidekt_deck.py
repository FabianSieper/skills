#!/usr/bin/env python3
"""Read an Archidekt deck through the public deck API and write a deck-wizard deck.json.

Read-only: this never writes to archidekt.com.

    python3 scripts/fetch_archidekt_deck.py https://archidekt.com/decks/27970654 --out deck.json

Emits <out> (commanders/cards, deck-wizard shape) and <out>.meta.json (raw inventory plus
derived numbers: size, mana curve, pip demand, colour identity, category layout, salt, price).
"""

import argparse
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict

API = "https://archidekt.com/api/decks/{deck_id}/"
USER_AGENT = "archidekt-deck-optimizer/1.0 (read-only deck audit)"

# Size and copy limits the gates check. deck-wizard owns the full format table;
# these are the two families that Archidekt decks realistically arrive in.
FORMATS = {
    "commander": {"size": 100, "copies": 1},
    "brawl": {"size": 60, "copies": 1},
    "oathbreaker": {"size": 100, "copies": 1},
    "modern": {"size": 60, "copies": 4},
    "legacy": {"size": 60, "copies": 4},
    "standard": {"size": 60, "copies": 4},
}

# Archidekt spells colour identity out in full words; the deck JSON and every
# downstream audit tool use the single-letter mana symbols.
COLOR_SYMBOL = {"White": "W", "Blue": "U", "Black": "B", "Red": "R", "Green": "G"}
BASIC_LANDS = {"Island", "Swamp", "Mountain", "Plains", "Forest", "Wastes"}


def resolve_deck_id(value):
    """Accept a full deck URL, '/decks/1234', or a bare id."""
    match = re.search(r"decks/(\d+)", value)
    if match:
        return match.group(1)
    if re.fullmatch(r"\d+", value):
        return value
    raise ValueError(f"could not find a deck id in {value!r}")


def fetch(deck_id):
    request = urllib.request.Request(API.format(deck_id=deck_id), headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def card_text(oracle):
    faces = oracle.get("faces") or []
    if faces:
        return " // ".join((f.get("text") or "").strip() for f in faces)
    return oracle.get("text") or ""


def mana_cost(oracle):
    cost = oracle.get("manaCost") or ""
    if not cost:
        faces = oracle.get("faces") or []
        cost = " ".join(f.get("manaCost") or "" for f in faces)
    return cost


def classify_cards(payload):
    """Split the API payload into in-deck, parked, and deleted entries."""
    categories = {c["name"]: c for c in payload.get("categories", [])}
    in_deck, parked, unknown = [], [], []

    for entry in payload.get("cards", []):
        if entry.get("deletedAt"):
            continue
        names = entry.get("categories") or []
        if not names:
            unknown.append(entry)
            continue
        # A category the API does not describe is not a reason to guess: keep the card
        # and report the gap so the human can resolve it.
        described = [categories[n] for n in names if n in categories]
        if not described:
            unknown.append(entry)
            continue
        target = in_deck if all(c["includedInDeck"] for c in described) else parked
        target.append((entry, names))

    return in_deck, parked, unknown


def build_deck(in_deck, fmt):
    commanders, cards = [], []
    for entry, categories in in_deck:
        oracle = entry["card"]["oracleCard"]
        row = {"name": oracle["name"], "quantity": entry["quantity"]}
        if "Commander" in categories:
            commanders.append(row)
        else:
            cards.append(row)
    return {"commanders": commanders, "cards": cards, "format": fmt, "sideboard": []}


def aggregate(in_deck):
    """Merge duplicate printings of the same oracle card into one row."""
    merged = {}
    for entry, categories in in_deck:
        oracle = entry["card"]["oracleCard"]
        name = oracle["name"]
        faces = oracle.get("faces") or []
        types = list(oracle.get("types") or [])
        for face in faces:
            types += [t for t in (face.get("types") or []) if t not in types]
        row = merged.setdefault(
            name,
            {
                "name": name,
                "quantity": 0,
                "manaCost": mana_cost(oracle),
                "cmc": oracle.get("cmc") or 0,
                "types": types,
                "isLand": "Land" in types,
                "isCreature": "Creature" in types,
                "colors": sorted({COLOR_SYMBOL.get(c, "?") for c in oracle.get("colorIdentity") or []}),
                "power": oracle.get("power"),
                "toughness": oracle.get("toughness"),
                "salt": oracle.get("salt") or 0,
                "oracleText": card_text(oracle),
                "categories": set(),
                "priceCm": entry["card"].get("prices", {}).get("cm"),
                "scryfallId": oracle.get("uid"),
            },
        )
        row["quantity"] += entry["quantity"]
        row["categories"].update(categories)
        if entry["quantity"] > 1:
            row["duplicatePrintings"] = True
    for row in merged.values():
        row["categories"] = sorted(row["categories"])
    return merged


def derived_numbers(rows, fmt):
    limit = FORMATS.get(fmt, FORMATS["commander"])
    lands = [r for r in rows if r["isLand"]]
    # A split card that is half land still has a cast cost, so it belongs in the curve.
    castable = [r for r in rows if r["manaCost"] and not r["isLand"]]

    curve = Counter()
    pips = Counter()
    for r in castable:
        curve[int(r["cmc"])] += r["quantity"]
        for symbol in re.findall(r"\{([URBGW])\}", r["manaCost"]):
            pips[symbol] += r["quantity"]

    identity = sorted({c for r in rows for c in r["colors"]})
    return {
        "format": fmt,
        "sizeLimit": limit["size"],
        "totalInDeck": sum(r["quantity"] for r in rows),
        "commanders": sum(r["quantity"] for r in rows if "Commander" in r["categories"]),
        "nonCommander": sum(r["quantity"] for r in rows if "Commander" not in r["categories"]),
        "landCount": sum(r["quantity"] for r in lands),
        "creatureCount": sum(r["quantity"] for r in rows if r["isCreature"]),
        "manaCurve": {str(k): v for k, v in sorted(curve.items())},
        "coloredPips": dict(sorted(pips.items())),
        "colorIdentity": identity,
        "saltSum": round(sum(r["salt"] * r["quantity"] for r in rows), 2),
        "estPriceCm": round(sum((r["priceCm"] or 0) * r["quantity"] for r in rows), 2),
    }


def violations(meta, rows, fmt):
    limit = FORMATS.get(fmt, FORMATS["commander"])
    found = []
    if meta["totalInDeck"] != meta["sizeLimit"]:
        found.append(
            f"deck size: {meta['totalInDeck']} cards in deck (commander included) vs {meta['sizeLimit']} allowed"
        )
    if meta["commanders"] == 0:
        found.append("no card carries the 'Commander' category")
    if meta["commanders"] > 1:
        found.append(f"{meta['commanders']} cards in the 'Commander' category")
    over = [
        r["name"]
        for r in rows
        if r["quantity"] > limit["copies"] and r["name"] not in BASIC_LANDS
    ]
    if over:
        found.append(f"copy limit {limit['copies']} exceeded for: {', '.join(over)}")
    return found


def main():
    parser = argparse.ArgumentParser(description="Fetch an Archidekt deck (read-only) and emit a deck JSON + audit summary.")
    parser.add_argument("deck", help="Archidekt deck URL or numeric deck id")
    parser.add_argument("--out", default="deck.json", help="deck JSON to write (deck-wizard shape)")
    parser.add_argument("--format", default="commander", choices=sorted(FORMATS), help="format used for the size/copy gates")
    parser.add_argument("--dump-oracle", help="also write a plain-text oracle dump (name | cost | types | P/T | text) of every in-deck card")
    args = parser.parse_args()

    try:
        deck_id = resolve_deck_id(args.deck)
    except ValueError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    try:
        payload = fetch(deck_id)
    except Exception as error:  # noqa: BLE001 - the failure modes are network/auth, not card logic
        print(
            f"ERROR: could not read deck {deck_id} through the API ({error}). "
            "Private or unlisted decks may need a login: fall back to the rendered page "
            "(webfetch of the deck URL) or ask the owner for an exported deck list.",
            file=sys.stderr,
        )
        return 1

    if payload.get("private") or payload.get("unlisted"):
        print(f"WARNING: deck {deck_id} is flagged private/unlisted; the inventory may be incomplete.", file=sys.stderr)

    in_deck, parked, unknown = classify_cards(payload)
    card_rows = list(aggregate(in_deck).values())
    by_cmc = sorted(card_rows, key=lambda r: (r["cmc"], r["name"]))
    deck = build_deck(in_deck, args.format)
    meta = derived_numbers(card_rows, args.format)
    meta["deckId"] = payload.get("id")
    meta["deckName"] = payload.get("name")
    meta["updatedAt"] = payload.get("updatedAt")
    meta["categories"] = [
        {"name": c["name"], "inDeck": c["includedInDeck"], "inPrice": c["includedInPrice"]}
        for c in payload.get("categories", [])
    ]
    meta["cards"] = by_cmc
    meta["parked"] = [{"name": e["card"]["oracleCard"]["name"], "quantity": e["quantity"], "categories": e["categories"]} for e, _ in parked]
    meta["unclassified"] = [{"name": e["card"]["oracleCard"]["name"], "quantity": e["quantity"]} for e in unknown]
    meta["violations"] = violations(meta, card_rows, args.format)

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(deck, handle, indent=2)

    meta_path = args.out + ".meta.json"
    with open(meta_path, "w", encoding="utf-8") as handle:
        json.dump(meta, handle, indent=2)

    if args.dump_oracle:
        with open(args.dump_oracle, "w", encoding="utf-8") as handle:
            for r in by_cmc:
                handle.write(f"== {r['name']} [{r['manaCost']}] {' '.join(r['types'])} P/T {r['power']}/{r['toughness']}\n{r['oracleText']}\n")

    print(f"deck {meta['deckId']} — {meta['deckName']}")
    print(f"  in deck: {meta['totalInDeck']} ({meta['commanders']} commander, {meta['nonCommander']} cards)")
    print(f"  parked (not in deck): {sum(p['quantity'] for p in meta['parked'])}")
    if meta["unclassified"]:
        print(f"  unclassified entries: {len(meta['unclassified'])} — resolve before trusting the size")
    print(f"  lands {meta['landCount']} | creatures {meta['creatureCount']} | curve {meta['manaCurve']}")
    print(f"  coloured pips {meta['coloredPips']} | identity {''.join(meta['colorIdentity'])}")
    print(f"  salt {meta['saltSum']} | est price (Cardmarket) {meta['estPriceCm']} EUR")
    if meta["violations"]:
        print("  GATES:")
        for v in meta["violations"]:
            print(f"    - {v}")
    else:
        print("  GATES: size, commander, and copy limits all pass")
    print(f"  wrote {args.out} and {meta_path}")
    if args.dump_oracle:
        print(f"  wrote oracle dump {args.dump_oracle}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
