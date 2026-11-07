# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Small analysis packets, exhaustive coverage and deterministic role summaries."""

from __future__ import annotations

import json
import shlex
from collections import Counter, defaultdict

from .cards import (
    ROLES,
    has_land_face,
    is_front_land,
    protected_names,
    validate_evaluation,
)
from .storage import ResearchError, digest, nonempty, read, require, write
from .transport import expand_response, packet_card, response_template


def all_cards(run, kind):
    if kind == "existing":
        return run.load("card_data.json")
    return [item["card"] for item in run.load("candidates_filtered.json")]


def analysis_name(kind):
    return (
        "deck_card_analysis.json" if kind == "existing" else "candidate_analysis.json"
    )


def prior_rows(run, kind):
    path = run.root / analysis_name(kind)
    if not path.exists():
        return []
    rows = read(path)
    require(isinstance(rows, list), f"{path.name} must be a list")
    return rows


def interpretation_context(run, kind):
    excluded = ("candidates_filtered.json",) if kind == "candidates" else ()
    return run.input_digest(kind, exclude=excluded)


def evaluation_digest(context, card):
    return digest({"context": context, "oracle_hash": card["oracle_hash"]})


def reusable_rows(run, kind, cards):
    by_name = {card["name"]: card for card in cards}
    context = interpretation_context(run, kind)
    return {
        row["name"]: row
        for row in prior_rows(run, kind)
        if row.get("name") in by_name
        and row.get("context_digest")
        == evaluation_digest(context, by_name[row["name"]])
    }


def packet(run, kind, size, *, compact=False, max_chars=None):
    require(1 <= size <= 12, "Batch size must be 1-12; default 8")
    require(
        max_chars is None or max_chars > 0, "Packet character budget must be positive"
    )
    run.ready(kind)
    context = run.input_digest(kind)
    cards = all_cards(run, kind)
    previous = reusable_rows(run, kind, cards)
    todo = [card for card in cards if card["name"] not in previous][:size]
    payload = {
        "kind": kind,
        "response_format": "compact_v1" if compact else "full_v1",
        "context_digest": context,
        "cards": [],
        "commander_model": run.load("commander_model.json"),
        "remaining": len(cards) - len(previous),
        "instructions": f"Read references/{'existing-card-evaluation' if kind == 'existing' else 'candidate-evaluation'}.md; return one complete record per card.",  # noqa: E501 - complete diagnostic or template literal
    }
    if compact:
        payload["request"] = run.request
        payload["inventory"] = run.load("active_cards.json")
        payload["card_lookup"] = (
            f"deck-research cards {shlex.quote(str(run.root))} --names 'Exact Card'"
        )
        payload["oracle_location"] = (
            "Complete Oracle paragraphs are in clauses; keys are face:paragraph. "
            "No paragraph is omitted."
        )
        payload["response_identity"] = (
            "Use card: '1', '2', ... in packet order. The runner binds name/hash. "
            "State same_as requires identical ratings AND explanations."
        )
    if kind == "candidates":
        payload["diagnosis"] = run.load("diagnosis.json")
        payload["role_summary"] = run.load("deck_role_summary.json")
        roles = set().union(
            *(set(row.get("roles", [])) for row in run.load("deck_card_analysis.json"))
        )
        payload["competitor_lookup"] = {
            "file": "deck_card_analysis.json",
            "available_roles": sorted(roles),
            "providers": run.load("role_groups.json"),
            "command": (
                f"deck-research competitors {shlex.quote(str(run.root))} "
                "--roles <role> [<role> ...]"
            ),
        }
    context_chars = len(json.dumps(payload, ensure_ascii=False))
    effective_limit = max_chars
    if max_chars and context_chars >= max_chars:
        effective_limit += context_chars
        payload["budget_note"] = (
            "Fixed context exceeds the budget; retain it intact "
            "and budget card content separately."
        )
    selected = []
    for card in todo:
        payload["cards"].append(packet_card(card, compact=compact))
        if (
            effective_limit
            and selected
            and len(json.dumps(payload, ensure_ascii=False)) > effective_limit
        ):
            payload["cards"].pop()
            break
        selected.append(card)
    todo = selected
    payload["packet_id"] = digest(payload)
    path = run.root / "packets" / f"{kind}-{payload['packet_id'][:16]}.json"
    write(path, payload)
    template = path.with_suffix(".response.json")
    if not template.exists():
        rows = [
            response_template(
                card, compact=compact, position=index, candidate=kind == "candidates"
            )
            for index, card in enumerate(todo)
        ]
        write(template, rows)
    return {
        "packet": str(path),
        "response_template": str(template),
        "count": len(todo),
        "remaining": payload["remaining"],
        "reused": len(previous),
        "task_chars": len(json.dumps(payload, ensure_ascii=False)),
    }


def accept_batch(run, packet_path, response_path, *, partial=False):
    payload = read(packet_path)
    packet_id = payload.pop("packet_id", None)
    require(
        digest(payload) == packet_id, "Packet content changed; generate a fresh packet"
    )
    kind = payload.get("kind")
    compact = payload.get("response_format") == "compact_v1"
    require(kind in ("existing", "candidates"), "Unknown packet kind")
    run.ready(kind)
    context = run.input_digest(kind)
    require(
        payload["context_digest"] == context, "Packet is stale; generate a fresh packet"
    )
    cards = {card["name"]: card for card in payload["cards"]}
    current = {card["name"]: card for card in all_cards(run, kind)}
    require(
        all(
            name in current and packet_card(current[name], compact=compact) == card
            for name, card in cards.items()
        ),
        "Packet cards changed",
    )
    rows = read(response_path)
    require(
        isinstance(rows, list)
        and (0 < len(rows) <= len(cards) if partial else len(rows) == len(cards)),
        "Return exactly one evaluation per packet card",
    )
    require(
        all(isinstance(row, dict) for row in rows), "Each evaluation must be an object"
    )
    identity_key = "card" if compact else "name"
    identifiers = (
        {str(index + 1): name for index, name in enumerate(cards)}
        if compact
        else {name: name for name in cards}
    )
    require(
        all(isinstance(row.get(identity_key), str) for row in rows)
        and len({row.get(identity_key) for row in rows}) == len(rows),
        "Duplicate evaluation in batch",
    )
    require(
        {row[identity_key] for row in rows} <= set(identifiers)
        and (partial or {row[identity_key] for row in rows} == set(identifiers)),
        "Batch names differ from the packet",
    )
    interpretation = interpretation_context(run, kind)
    valid, errors, repairs = [], [], []
    for row in rows:
        name = identifiers[row[identity_key]]
        try:
            evaluated = expand_response(row, cards[name]) if compact else dict(row)
            validate_evaluation(evaluated, cards[name], candidate=kind == "candidates")
        except (
            ResearchError,
            KeyError,
            TypeError,
            ValueError,
            AttributeError,
        ) as error:
            if not partial:
                raise ResearchError(str(error)) from error
            errors.append(
                {"card": row[identity_key], "name": name, "reason": str(error)}
            )
            repairs.append(row)
            continue
        evaluated["context_digest"] = evaluation_digest(interpretation, cards[name])
        valid.append(evaluated)
    existing = reusable_rows(run, kind, current.values())
    existing.update({row["name"]: row for row in valid})
    run.save(
        analysis_name(kind), sorted(existing.values(), key=lambda row: row["name"])
    )
    if valid:
        write(run.root / "analysis" / f"{packet_id}-{digest(valid)[:12]}.json", valid)
    result = {
        "accepted": len(valid),
        "complete": len(existing),
        "expected": len(current),
    }
    if errors:
        repair_path = run.root / "packets" / f"{packet_id[:16]}.repair.json"
        write(repair_path, repairs)
        result.update(
            errors=errors, repair_response=str(repair_path), packet=str(packet_path)
        )
    return result


def validate_coverage(run, kind):
    cards = {card["name"]: card for card in all_cards(run, kind)}
    saved = prior_rows(run, kind)
    require(
        len({row.get("name") for row in saved}) == len(saved),
        f"{kind}: duplicate evaluations",
    )
    rows = list(reusable_rows(run, kind, cards.values()).values())
    require(
        len(rows) == len(cards) and {row.get("name") for row in rows} == set(cards),
        f"{kind}: every distinct active card/candidate needs exactly one evaluation",
    )
    for row in rows:
        validate_evaluation(row, cards[row["name"]], candidate=kind == "candidates")
    run.save(analysis_name(kind), sorted(rows, key=lambda row: row["name"]))


def summarize(active, cards, analysis):
    by_name = {card["name"]: card for card in cards}
    evaluations = {row["name"]: row for row in analysis}
    roles, groups, curve, dependencies = (
        Counter(),
        defaultdict(list),
        Counter(),
        Counter(),
    )
    sources, conditional = Counter(), Counter()
    lands = options = spells = 0
    mana_value = 0.0
    for entry in active:
        name, quantity = entry["name"], entry["quantity"]
        require(
            name in by_name and name in evaluations, f"No complete analysis for {name}"
        )
        card, evaluation = by_name[name], evaluations[name]
        # Role sums overlap intentionally; physical size always comes from entries.
        for role in set(evaluation["roles"]):
            roles[role] += quantity
            groups[role].append({"name": name, "quantity": quantity})
        dependencies[evaluation["commander_dependency"]] += quantity
        if is_front_land(card):
            lands += quantity
        else:
            spells += quantity
            mana_value += card["cmc"] * quantity
            curve[str(card["cmc"])] += quantity
        if has_land_face(card):
            options += quantity
            for color in set(evaluation["land"]["unconditional_colors"]):
                sources[color] += quantity
            for color in set(evaluation["land"]["conditional_colors"]):
                conditional[color] += quantity
    return {
        "physical_cards": sum(row["quantity"] for row in active),
        "roles": dict(sorted(roles.items())),
        "front_face_lands": lands,
        "land_options": options,
        "spell_curve": dict(sorted(curve.items())),
        "nonland_average_mana_value": mana_value / spells if spells else 0,
        "commander_dependency": dict(dependencies),
        "unconditional_land_sources": dict(sources),
        "conditional_land_sources": dict(conditional),
        "counting_note": "Roles overlap. Land options include modal faces. Conditional sources are not guaranteed early mana; casting/activation costs remain in per-card assessments.",  # noqa: E501 - complete diagnostic or template literal
    }, dict(groups)


def aggregate(run):
    run.ready("structure")
    summary, groups = summarize(
        run.load("active_cards.json"),
        run.load("card_data.json"),
        run.load("deck_card_analysis.json"),
    )
    run.save("deck_role_summary.json", summary)
    run.save("role_groups.json", groups)
    run.seal("structure")
    return summary


def validate_model(run):
    protected_names(run)
    model = run.load("commander_model.json")
    for key in (
        "primary_plan",
        "secondary_plan",
        "win_conditions",
        "setup_sequence",
        "recovery_plan",
        "bottlenecks",
        "realistic_resources",
        "user_alignment",
    ):
        nonempty(model.get(key), f"commander_model.{key}")
    commanders = {
        row["name"]
        for row in run.load("active_cards.json")
        if row["zone"] == "commanders"
    }
    cards = {card["name"]: card for card in run.load("card_data.json")}
    require(
        set(model.get("commander_clauses", {})) == commanders,
        "Analyze every designated commander",
    )
    for name in commanders:
        review = model["commander_clauses"][name]
        require(
            set(review) == set(cards[name]["clauses"]),
            f"Read all commander clauses: {name}",
        )
        for text in review.values():
            nonempty(text, "commander clause explanation")
    require(
        isinstance(model.get("rules_questions"), list), "Provide model.rules_questions"
    )
    require(
        1 <= len(commanders) <= 2,
        "Verify the supported one/two-commander configuration",
    )
    if len(commanders) == 2:
        require(
            any(q.get("id") == "commander-pairing" for q in model["rules_questions"]),
            "Two commanders require an explicit commander-pairing rules question and evidence",  # noqa: E501 - complete diagnostic or template literal
        )
    require(isinstance(model.get("interactions"), list), "Provide model.interactions")
    predictions = model.get("predictions", {})
    for state in ("without_commander", "after_removal", "behind"):
        nonempty(predictions.get(state), f"Explain the deck's behavior {state}")
    nonempty(
        model.get("commander_legality_evidence"),
        "Commander eligibility/pairing evidence",
    )


def validate_diagnosis(run):
    diagnosis = run.load("diagnosis.json")
    summary = run.load("deck_role_summary.json")
    names = {row["name"] for row in run.load("active_cards.json")}
    gaps = diagnosis.get("gaps")
    require(isinstance(gaps, list), "Provide gaps, even when empty")
    ids = set()
    for gap in gaps:
        nonempty(gap.get("id"), "gap id")
        require(gap["id"] not in ids, "Gap IDs must be unique")
        ids.add(gap["id"])
        require(gap.get("role") in ROLES, "Gap needs a valid role")
        require(
            gap.get("observed") == summary["roles"].get(gap["role"], 0),
            "Gap count differs from measured role count",
        )
        for key in ("evidence", "consequence", "target_reason"):
            nonempty(gap.get(key), f"gap.{key}")
    for role, minimum in diagnosis.get("critical_role_floors", {}).items():
        require(
            role in ROLES and type(minimum) is int and minimum >= 0,
            "Invalid critical role floor",
        )
    require(
        isinstance(diagnosis.get("critical_role_floors"), dict)
        and bool(diagnosis["critical_role_floors"]),
        "Declare critical roles and minimum counts",
    )
    pool = run.load("cut_pool.json")
    require(isinstance(pool, list), "Cut pool must be a list")
    require(
        len({row.get("name") for row in pool}) == len(pool), "Duplicate cut candidate"
    )
    protected = protected_names(run)
    functions = diagnosis.get("unique_functions")
    require(
        isinstance(functions, list), "List unique critical functions, even when empty"
    )
    require(
        len({item.get("id") for item in functions}) == len(functions),
        "Duplicate critical function ID",
    )
    for function in functions:
        nonempty(function.get("id"), "critical function id")
        nonempty(function.get("job"), "critical function job")
        require(function.get("role") in ROLES, "Critical function needs its role")
        require(
            isinstance(function.get("providers"), list)
            and function["providers"]
            and set(function["providers"]) <= names,
            "Critical function needs actual active providers",
        )
    for row in pool:
        require(
            row.get("name") in names and row["name"] not in protected,
            "Unknown or protected cut candidate",
        )
        require(
            isinstance(row.get("competitors"), list)
            and set(row["competitors"]) <= names,
            "Cut competitors must exist in the active deck",
        )
        for key in (
            "job",
            "replaceability",
            "opportunity_cost",
            "reason",
            "lost_if_removed",
        ):
            nonempty(row.get(key), f"cut_pool.{key}")
        require(
            isinstance(row.get("flags"), list),
            "Provide qualitative cut flags with supporting reason",
        )


def rules_questions(run):
    result = []
    rows = [{"name": "commander_model", **run.load("commander_model.json")}]
    rows += run.load("deck_card_analysis.json") + run.load("candidate_analysis.json")
    for row in rows:
        for question in row["rules_questions"]:
            result.append(  # noqa: PERF401 - one record per question
                {
                    "id": f"{row['name']}::{question['id']}",
                    "card": row["name"],
                    "question": question["question"],
                }
            )
    require(
        len({q["id"] for q in result}) == len(result), "Duplicate rules question IDs"
    )
    return result


def validate_rules(run):
    expected = rules_questions(run)
    run.save("rules_review_queue.json", expected)
    reviews = run.load("rules_review.json")
    require(
        isinstance(reviews, list) and len(reviews) == len(expected),
        "Resolve every rules question separately",
    )
    require(
        {r.get("id") for r in reviews} == {q["id"] for q in expected},
        "Rules answers differ from queue",
    )
    for review in reviews:
        require(
            review.get("status") in ("verified", "rejected", "unresolved"),
            "Invalid rules status",
        )
        nonempty(review.get("answer"), "rules answer")
        if review["status"] != "verified":
            continue
        sources = review.get("sources")
        require(
            isinstance(sources, list) and sources,
            "A verified ruling requires saved primary evidence",
        )
        for source in sources:
            relative = source.get("path", "")
            path = (run.root / relative).resolve()
            require(
                path.is_relative_to(run.root / "evidence"),
                "Rules evidence must be saved under run/evidence",
            )
            nonempty(source.get("locator"), "CR number or ruling locator")
            quote = source.get("quote")
            nonempty(quote, "supporting source excerpt")
            require(
                path.is_file() and quote in path.read_text(encoding="utf-8"),
                "Rule excerpt is absent from saved evidence",
            )
