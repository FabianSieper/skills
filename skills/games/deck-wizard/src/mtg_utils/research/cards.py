# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Canonical card identity, complete Oracle clauses and dated market evidence."""

from __future__ import annotations

from urllib.parse import urlparse

from mtg_utils.names import normalize_card_name

from .storage import age_hours, digest, nonempty, require

ROLES = frozenset(
    [
        "land",
        "ramp",
        "mana_fixing",
        "cost_reduction",
        "card_draw",
        "card_advantage",
        "card_selection",
        "discard_outlet",
        "graveyard_setup",
        "graveyard_recursion",
        "graveyard_protection",
        "commander_protection",
        "board_protection",
        "spot_removal",
        "board_wipe",
        "countermagic",
        "tutor",
        "commander_enabler",
        "value_engine",
        "payoff",
        "combat_enabler",
        "finisher",
        "utility",
    ]
)
RATINGS = frozenset({"very_low", "low", "medium", "high", "very_high"})
STATES = ("before_commander", "with_commander", "without_commander", "behind")


def name_key(name):
    return " ".join(normalize_card_name(name.replace("\u2019", "'")).split())


def aliases(card):
    values = [card["name"], card.get("printed_name"), card.get("flavor_name")]
    values += [face.get("name") for face in card.get("card_faces", [])]
    if " // " in card["name"]:
        values += card["name"].split(" // ")
    return {name_key(value) for value in values if value}


def identity(card):
    return card.get("oracle_id") or name_key(card["name"])


def clauses(card):
    faces = card.get("card_faces") or [card]
    result = {}
    for face_index, face in enumerate(faces):
        for clause_index, paragraph in enumerate(
            (face.get("oracle_text") or "").splitlines()
        ):
            if paragraph.strip():
                result[f"{face_index}:{clause_index}"] = paragraph.strip()
    return result


def oracle_record(card):
    for key in ("name", "type_line"):
        nonempty(card.get(key), f"card.{key}")
    require(
        isinstance(card.get("cmc"), (int, float)) and card["cmc"] >= 0,
        f"Missing mana value: {card['name']}",
    )
    require(
        isinstance(card.get("color_identity"), list),
        f"Missing color identity: {card['name']}",
    )
    require(
        set(card["color_identity"]) <= set("WUBRG"),
        f"Invalid color identity: {card['name']}",
    )
    require(
        "oracle_text" in card or bool(card.get("card_faces")),
        f"Missing Oracle data: {card['name']}",
    )
    keys = (
        "name",
        "oracle_id",
        "id",
        "printed_name",
        "flavor_name",
        "layout",
        "oracle_text",
        "mana_cost",
        "cmc",
        "type_line",
        "color_identity",
        "keywords",
        "power",
        "toughness",
        "produced_mana",
        "loyalty",
        "defense",
    )
    result = {key: card[key] for key in keys if key in card}
    if card.get("card_faces"):
        result["card_faces"] = [
            {key: face[key] for key in keys if key in face}
            for face in card["card_faces"]
        ]
        require(
            all(
                "oracle_text" in face and face.get("type_line")
                for face in result["card_faces"]
            ),
            f"Incomplete face data: {card['name']}",
        )
    result["clauses"] = clauses(result)
    result["oracle_hash"] = digest(result)
    return result


def market_record(card, as_of, source):
    age_hours(as_of)
    nonempty(source, "card-data source")
    images = card.get("image_uris") or {}
    if not images and card.get("card_faces"):
        images = card["card_faces"][0].get("image_uris") or {}
    url = card.get("scryfall_uri")
    if not url and card.get("id"):
        url = f"https://scryfall.com/card/{card['id']}"
    return {
        "name": card["name"],
        "oracle_id": card.get("oracle_id"),
        "legalities": card.get("legalities", {}),
        "arena_available": card.get("arena_available"),
        "prices": card.get("prices", {}),
        "scryfall_url": url,
        "image_url": images.get("normal") or images.get("large"),
        "source": source,
        "oracle_at": as_of,
        "legality_at": as_of,
        "price_at": as_of,
    }


def index_records(records):
    index = {}
    for card in records:
        for key in aliases(card):
            index.setdefault(key, {})[identity(card)] = card
    return index


def resolve(index, name):
    matches = index.get(name_key(name), {})
    require(len(matches) == 1, f"Unresolved or ambiguous card name: {name}")
    return next(iter(matches.values()))


def is_front_land(card):
    faces = card.get("card_faces") or [card]
    return "Land" in faces[0].get("type_line", "").split("—")[0].split()


def protected_names(run):
    index = index_records(run.load("card_data.json"))
    return {
        resolve(index, name)["name"] for name in run.request.get("protected_cards", [])
    }


def has_land_face(card):
    return any(
        "Land" in face.get("type_line", "").split("—")[0].split()
        for face in card.get("card_faces") or [card]
    )


def valid_url(url):
    if not isinstance(url, str):
        return False
    parsed = urlparse(url)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username


def validate_evaluation(row, card, *, candidate=False):
    require(
        row.get("name") == card["name"], "Evaluation must use the canonical card name"
    )
    require(
        row.get("oracle_hash") == card["oracle_hash"],
        f"Stale Oracle analysis: {card['name']}",
    )
    nonempty(row.get("job"), f"{card['name']}: job in this deck")
    roles = row.get("roles")
    require(
        isinstance(roles, list)
        and len(roles) == len(set(roles))
        and set(roles) <= ROLES,
        f"{card['name']}: use distinct roles from the role vocabulary",
    )
    require(bool(roles), f"{card['name']}: at least one role required")
    reviews = row.get("clause_review", {})
    require(
        set(reviews) == set(card["clauses"]),
        f"{card['name']}: account for every Oracle paragraph",
    )
    for key, text in reviews.items():
        nonempty(text, f"{card['name']}: clause {key} interpretation")
    nonempty(
        row.get("characteristics"), f"{card['name']}: cost, types and body assessment"
    )
    for state in STATES:
        value = row.get("states", {}).get(state, {})
        require(
            value.get("rating") in RATINGS, f"{card['name']}: missing {state} rating"
        )
        nonempty(value.get("reason"), f"{card['name']}: {state} reason")
    for field in (
        "commander_dependency",
        "setup_complexity",
        "role_compression",
        "dead_draw_risk",
    ):
        require(row.get(field) in RATINGS, f"{card['name']}: invalid {field}")
    for field in (
        "plan_fit",
        "mana_efficiency",
        "alternative_costs",
        "resilience",
        "preference_fit",
    ):
        nonempty(row.get(field), f"{card['name']}: {field}")
    require(
        isinstance(row.get("rules_questions"), list),
        "Provide rules_questions, even when empty",
    )
    for question in row["rules_questions"]:
        nonempty(question.get("id"), "rules question id")
        nonempty(question.get("question"), "rules question")
    require(
        isinstance(row.get("interactions"), list),
        "Provide interactions, even when empty",
    )
    for interaction in row["interactions"]:
        require(
            interaction.get("kind") in ("synergy", "anti", "neutral"),
            "Invalid interaction kind",
        )
        require(
            isinstance(interaction.get("cards"), list) and interaction["cards"],
            "Name interaction partners",
        )
        nonempty(interaction.get("reason"), "Interaction explanation")
    if has_land_face(card):
        land = row.get("land", {})
        for field in (
            "entry_condition",
            "fetchability",
            "utility",
            "source_reliability",
        ):
            nonempty(land.get(field), f"{card['name']}: land.{field}")
        for field in ("unconditional_colors", "conditional_colors"):
            require(
                isinstance(land.get(field), list) and set(land[field]) <= set("WUBRGC"),
                f"{card['name']}: land.{field}",
            )
    if candidate:
        require(
            row.get("fit") in ("very_high", "high", "medium", "niche", "reject"),
            "Invalid candidate fit",
        )
        nonempty(
            row.get("comparison"), "Compare candidate to existing role competitors"
        )
    return row
