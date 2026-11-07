# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Lossless packet transport; models supply judgments, the runner binds identities."""

from copy import deepcopy

from .cards import STATES, has_land_face
from .storage import require


def packet_card(card, *, compact):
    if not compact:
        return card
    result = deepcopy(card)
    # Complete Oracle paragraphs occur once, under their face/paragraph keys.
    result.pop("oracle_text", None)
    for face in result.get("card_faces", []):
        face.pop("oracle_text", None)
    return result


def response_template(card, *, compact=False, position=0, candidate=False):
    row = dict.fromkeys(
        (
            "job",
            "characteristics",
            "commander_dependency",
            "setup_complexity",
            "role_compression",
            "dead_draw_risk",
            "plan_fit",
            "mana_efficiency",
            "alternative_costs",
            "resilience",
            "preference_fit",
        ),
        "",
    )
    if compact:
        row["card"] = str(position + 1)
    else:
        row.update(name=card["name"], oracle_hash=card["oracle_hash"])
    row.update(
        roles=[],
        clause_review=dict.fromkeys(card["clauses"], ""),
        states={state: {"rating": "", "reason": ""} for state in STATES},
        interactions=[],
        rules_questions=[],
    )
    if has_land_face(card):
        row["land"] = {
            **dict.fromkeys(
                ("entry_condition", "fetchability", "utility", "source_reliability"),
                "",
            ),
            "unconditional_colors": [],
            "conditional_colors": [],
        }
    if candidate:
        row.update(fit="", comparison="", function_coverage={})
    return row


def expand_response(row, card):
    result = deepcopy(row)
    result.pop("card", None)
    require(
        result.get("name", card["name"]) == card["name"]
        and result.get("oracle_hash", card["oracle_hash"]) == card["oracle_hash"],
        "Response identity differs from verified packet",
    )
    result.update(name=card["name"], oracle_hash=card["oracle_hash"])
    states = result.get("states", {})
    require(isinstance(states, dict), "states must be an object")

    def resolve(state, visited):
        require(
            state in STATES and state not in visited,
            "Invalid or cyclic state reference",
        )
        value = states.get(state, {})
        require(isinstance(value, dict), f"Invalid state: {state}")
        if "same_as" in value:
            require(
                set(value) == {"same_as"},
                "State reference cannot override a rating/reason",
            )
            return resolve(value["same_as"], visited | {state})
        return deepcopy(value)

    result["states"] = {state: resolve(state, set()) for state in STATES}
    return result
