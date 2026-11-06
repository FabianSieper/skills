# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Reliable Archidekt ingestion; excluded and unresolved entries remain visible."""

from __future__ import annotations

import json
import re
import urllib.request
from urllib.parse import urlparse

from .cards import name_key
from .storage import nonempty, require


def deck_id(value):
    if re.fullmatch(r"[0-9]+", str(value)):
        return str(value)
    url = urlparse(value)
    require(
        url.hostname in ("archidekt.com", "www.archidekt.com"),
        "Expected an Archidekt deck URL",
    )
    match = re.fullmatch(r"/(?:api/)?decks/([0-9]+)(?:/.*)?", url.path)
    require(bool(match), "Archidekt URL has no deck ID")
    return match.group(1)


def fetch_archidekt(value):
    identifier = deck_id(value)
    request = urllib.request.Request(
        f"https://archidekt.com/api/decks/{identifier}/",
        headers={
            "User-Agent": "deck-wizard/1.0 (read-only research)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def classify_archidekt(
    payload, requested_id, fmt, excluded_categories=(), excluded_cards=()
):
    require(
        str(payload.get("id")) == str(requested_id),
        "Received the wrong Archidekt deck ID",
    )
    require(
        isinstance(payload.get("cards"), list),
        "Archidekt response has no complete cards list",
    )
    require(
        isinstance(payload.get("categories"), list),
        "Archidekt response has no categories",
    )
    require(
        not payload.get("customCards"),
        "Custom cards require explicit resolution before analysis",
    )
    categories = {}
    for category in payload["categories"]:
        name = category.get("name")
        nonempty(name, "category name")
        require(name not in categories, f"Duplicate category definition: {name}")
        categories[name] = category
    parked_names = {
        name_key(n) for n in ("Maybeboard", "To Be Removed", *excluded_categories)
    }
    # A constructed sideboard is a separate legal zone, never part of the active
    # Commander deck. Explicit parking/deletion always takes precedence.
    banned_names = {name_key(n) for n in excluded_cards}
    active, excluded, unresolved, sideboard = [], [], [], []
    seen_entries = set()
    for entry in payload["cards"]:
        oracle = (entry.get("card") or {}).get("oracleCard") or {}
        name, quantity = oracle.get("name"), entry.get("quantity")
        row = {
            "name": name,
            "quantity": quantity,
            "categories": entry.get("categories") or [],
            "entry_id": entry.get("id"),
            "oracle_id": oracle.get("uid"),
        }
        if row["entry_id"] is not None:
            require(
                row["entry_id"] not in seen_entries,
                "Repeated Archidekt entry ID; response is inconsistent",
            )
            seen_entries.add(row["entry_id"])
        if not name or type(quantity) is not int or quantity < 1:
            unresolved.append({**row, "reason": "missing_name_or_invalid_quantity"})
            continue
        names = row["categories"]
        known = [categories[n] for n in names if n in categories]
        is_sideboard = any(name_key(n) == "sideboard" for n in names)
        reasons = []
        if entry.get("deletedAt") or entry.get("archivedAt"):
            reasons.append("deleted_or_archived")
        if name_key(name) in banned_names:
            reasons.append("explicit_card_exclusion")
        if any(name_key(n) in parked_names for n in names):
            reasons.append("excluded_category")
        if any(
            c.get("includedInDeck") is False
            and not (not fmt.has_commander and name_key(c["name"]) == "sideboard")
            for c in known
        ):
            reasons.append("inactive_category")
        if fmt.has_commander and is_sideboard:
            reasons.append("commander_sideboard")
        if reasons:
            excluded.append({**row, "reasons": reasons})
            continue
        if (
            not names
            or any(n not in categories for n in names)
            or any(type(c.get("includedInDeck")) is not bool for c in known)
        ):
            unresolved.append({**row, "reason": "unknown_or_incomplete_category"})
            continue
        row["zone"] = (
            "commanders" if any(name_key(n) == "commander" for n in names) else "cards"
        )
        (sideboard if is_sideboard else active).append(row)
    return assemble(active, excluded, unresolved, sideboard, fmt)


def assemble(active, excluded, unresolved, sideboard, fmt):
    merged = {}
    for row in active:
        key = (row["zone"], name_key(row["name"]))
        if key not in merged:
            merged[key] = {"name": row["name"], "quantity": 0, "zone": row["zone"]}
        merged[key]["quantity"] += row["quantity"]
    rows = list(merged.values())
    deck = {
        "format": fmt.name,
        "commanders": [],
        "cards": [],
        "sideboard": [],
        "owned_cards": [],
    }
    for row in rows:
        deck[row["zone"]].append({"name": row["name"], "quantity": row["quantity"]})
    for row in sideboard:
        deck["sideboard"].append({"name": row["name"], "quantity": row["quantity"]})
    total = sum(row["quantity"] for row in rows)
    commanders = sum(row["quantity"] for row in deck["commanders"])
    complete = not unresolved and (not fmt.has_commander or commanders > 0)
    size = fmt.deck_size
    valid_size = total >= size if fmt.size_is_minimum else total == size
    report = {
        "complete": complete,
        "total": total,
        "commanders": commanders,
        "mainboard": total - commanders,
        "sideboard": sum(r["quantity"] for r in sideboard),
        "excluded": sum(r["quantity"] for r in excluded),
        "unresolved": len(unresolved),
        "expected_size": size,
        "size_valid": valid_size,
        "size_correction": size - total if not valid_size else 0,
        "note": "Completeness and legality are separate; final deck must satisfy both.",
    }
    return {
        "deck.json": deck,
        "active_cards.json": rows,
        "excluded_cards.json": excluded,
        "unresolved_cards.json": unresolved,
        "deck_validation.json": report,
    }


def from_parsed(deck, fmt):
    require(deck.get("format") == fmt.name, "Parsed deck format differs from request")
    active, unresolved = [], []
    for zone in ("commanders", "cards"):
        require(isinstance(deck.get(zone), list), f"Missing parsed-deck zone {zone}")
        for entry in deck[zone]:
            if (
                not entry.get("name")
                or type(entry.get("quantity")) is not int
                or entry["quantity"] < 1
            ):
                unresolved.append({**entry, "reason": "invalid_entry"})
            else:
                active.append({**entry, "zone": zone})
    sideboard = deck.get("sideboard") or []
    excluded = (
        [{**entry, "reasons": ["commander_sideboard"]} for entry in sideboard]
        if fmt.has_commander
        else []
    )
    result = assemble(
        active, excluded, unresolved, [] if fmt.has_commander else sideboard, fmt
    )
    for key in ("owned_cards", "companion", "pool", "medium"):
        if key in deck:
            result["deck.json"][key] = deck[key]
    return result
