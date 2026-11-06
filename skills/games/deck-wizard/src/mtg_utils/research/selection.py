# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Hard candidate filters and individual/cumulative replacement validation."""

from __future__ import annotations

from collections import Counter
from decimal import Decimal, InvalidOperation

from mtg_utils.formats import get_format
from mtg_utils.hydrated_deck import HydratedDeck
from mtg_utils.legality_audit import card_copy_limit, legality_audit

from .cards import ROLES, aliases, identity, name_key, protected_names, valid_url
from .evaluation import summarize
from .storage import ResearchError, age_hours, nonempty, require


def money(value):
    try:
        amount = Decimal(str(value))
    except InvalidOperation as error:
        raise ResearchError(f"Invalid price: {value}") from error
    require(amount.is_finite() and amount >= 0, "Invalid price")
    return amount


def price(market, request):
    currency = request["budget"]["currency"].lower()
    value = market.get("prices", {}).get(currency)
    require(value is not None, f"Missing {currency.upper()} price for {market['name']}")
    require(
        age_hours(market.get("price_at")) <= request["freshness"]["price_hours"],
        f"Stale price for {market['name']}",
    )
    return money(value)


def fresh_legality(market, request):
    require(
        age_hours(market.get("legality_at")) <= request["freshness"]["legality_hours"],
        f"Stale legality for {market['name']}",
    )


def validate_exclusions(run):
    blacklist = run.load("external_blacklist.json")
    require(
        isinstance(blacklist, dict) and isinstance(blacklist.get("names"), list),
        "Blacklist needs names and sources",
    )
    required = set(run.request["external_exclusion_sources"])
    sources = blacklist.get("sources", [])
    require(
        isinstance(sources, list) and {s.get("id") for s in sources} == required,
        "Every requested external exclusion source must be loaded",
    )
    require(len(sources) == len(required), "Duplicate exclusion source")
    for source in sources:
        require(
            source.get("complete") is True,
            "Exclusion source is incomplete; finish all pagination",
        )
        require(
            isinstance(source.get("names"), list), "Exclusion source must contain names"
        )
        require(
            age_hours(source.get("retrieved_at"))
            <= run.request["freshness"]["exclusion_hours"],
            "External exclusion snapshot is stale; refresh it",
        )
    for name in blacklist["names"] + [n for s in sources for n in s["names"]]:
        nonempty(name, "excluded card name")


def excluded_names(run):
    validate_exclusions(run)
    blacklist = run.load("external_blacklist.json")
    names = blacklist["names"] + run.request["rejected_cards"]
    names += [name for source in blacklist["sources"] for name in source["names"]]
    return {name_key(name) for name in names}


def candidate_filter(run, *, persist=True):
    run.ready("filter")
    fmt = get_format(run.request["format"])
    active = run.load("card_data.json")
    active_ids = {identity(card) for card in active}
    active_aliases = set().union(*(aliases(card) for card in active))
    forbidden = excluded_names(run)
    commander_names = {
        row["name"]
        for row in run.load("active_cards.json")
        if row["zone"] == "commanders"
    }
    colors = set().union(
        *(set(c["color_identity"]) for c in active if c["name"] in commander_names)
    )
    accepted, rejected = {}, []
    for item in run.load("candidates_raw.json"):
        card, market = item["card"], item["market"]
        reasons = []
        if identity(card) in active_ids or aliases(card) & active_aliases:
            reasons.append("already_active")
        if aliases(card) & forbidden:
            reasons.append("excluded")
        combined = {**card, **market}
        if not fmt.is_legal(combined):
            reasons.append("format_illegal_or_unknown")
        if not set(card["color_identity"]) <= colors:
            reasons.append("color_identity")
        try:
            fresh_legality(market, run.request)
            require(
                age_hours(market.get("oracle_at"))
                <= run.request["freshness"]["oracle_hours"],
                "Stale Oracle data",
            )
            amount = price(market, run.request)
            cap = run.request["budget"].get("per_card")
            if cap is not None and amount > money(cap):
                reasons.append("over_per_card_budget")
        except ResearchError as error:
            reasons.append(str(error))
            amount = Decimal("Infinity")
        if reasons:
            rejected.append({"name": card["name"], "reasons": reasons})
            continue
        key = identity(card)
        previous = accepted.get(key)
        if previous is None or amount < price(previous["market"], run.request):
            if previous:
                rejected.append(
                    {
                        "name": previous["card"]["name"],
                        "reasons": ["duplicate_more_expensive_printing"],
                    }
                )
            accepted[key] = item
        else:
            rejected.append({"name": card["name"], "reasons": ["duplicate_printing"]})
    result = sorted(accepted.values(), key=lambda item: item["card"]["name"])
    if persist:
        run.save("candidates_filtered.json", result)
        run.save("candidate_rejections.json", rejected)
        run.seal("filter")
    return result, rejected


def validate_plan(run):
    plan = run.load("proposed_swaps.json")
    swaps, repairs = plan.get("swaps"), plan.get("repairs", [])
    require(
        isinstance(swaps, list) and isinstance(repairs, list),
        "Plan requires swaps and repairs lists",
    )
    require(len(swaps) <= run.request["max_swaps"], "Plan exceeds max_swaps")
    count = run.request["recommendation_count"]
    if count is not None:
        require(
            len(swaps) == count,
            f"Requested {count} swaps, got {len(swaps)}; report shortfall, never pad",
        )
    active = {
        row["name"] for row in run.load("active_cards.json") if row["zone"] == "cards"
    }
    pool = {row["name"] for row in run.load("cut_pool.json")}
    candidates = {row["name"]: row for row in run.load("candidate_analysis.json")}
    protected = protected_names(run)
    used_adds, used_cuts = set(), set()
    final_names = (
        {row["name"] for row in run.load("active_cards.json")}
        - {row.get("cut") for row in swaps + repairs}
    ) | {row.get("add") for row in swaps + repairs}
    for row in swaps + repairs:
        cut, add = row.get("cut"), row.get("add")
        require(cut or add, "Empty change")
        if row in swaps:
            require(cut and add, "A swap must have both add and cut")
        if cut:
            require(
                cut in active and cut in pool,
                f"Cut must be an analyzed mainboard cut candidate: {cut}",
            )
            require(cut not in protected, f"Protected card: {cut}")
            require(cut not in used_cuts, f"Same cut used twice: {cut}")
            used_cuts.add(cut)
        if add:
            require(
                add in candidates and candidates[add]["fit"] in ("high", "very_high"),
                f"Add must be a high-fit analyzed candidate: {add}",
            )
            require(add not in used_adds, f"Same addition used twice: {add}")
            used_adds.add(add)
        for key in (
            "reason",
            "lost_function",
            "replacement_evidence",
            "curve_and_mana",
            "combo_impact",
        ):
            nonempty(row.get(key), f"change.{key}")
        require(
            isinstance(row.get("remaining_providers"), list),
            "Name remaining providers for the cut's job",
        )
        require(
            set(row["remaining_providers"]) <= final_names,
            "Replacement witness names a provider absent from the final deck",
        )
    delta = sum(bool(row.get("add")) - bool(row.get("cut")) for row in repairs)
    required_delta = run.load("deck_validation.json")["size_correction"]
    require(
        delta == required_delta,
        "Repairs must correct the starting deck size exactly; swaps are balanced",
    )
    require(
        not repairs or required_delta != 0,
        "Size-valid decks use balanced swaps, not unpaired repairs",
    )
    return plan


def validate_review(run):
    review = run.load("strategic_review.json")
    require(
        review.get("mode") in ("independent_agents", "separate_passes"),
        "Record the actual review mode",
    )
    require(
        review.get("proposal_digest")
        == run.state["stages"]["swaps"]["outputs"]["proposed_swaps.json"],
        "Strategic review applies to a different proposal",
    )
    pairs = run.load("proposed_swaps.json")["swaps"]
    rows = review.get("pairs", [])
    require(len(rows) == len(pairs), "Review every proposed swap")
    require(
        {(r.get("cut"), r.get("add")) for r in rows}
        == {(r["cut"], r["add"]) for r in pairs},
        "Review pairs differ from proposal",
    )
    for row in rows:
        for key in (
            "best_case_for_keeping_cut",
            "failure_case_for_add",
            "alternative",
            "resolution",
        ):
            nonempty(row.get(key), f"review.{key}")
        require(
            row.get("verdict") == "accept",
            "Resolve or remove contested swaps before final validation",
        )
    for key in (
        "whole_deck_plan",
        "commander_identity",
        "combo_preservation",
        "mana",
        "user_preferences",
    ):
        nonempty(review.get(key), f"review.{key}")


def rules_allow(run, name):
    reviews = run.load("rules_review.json")
    for row in reviews:
        if row["id"].startswith(name + "::") or row["id"].startswith(
            "commander_model::"
        ):
            require(
                row["status"] == "verified",
                f"Unresolved/rejected central interaction: {row['id']}",
            )


def apply_change(active, row):
    result = [dict(entry) for entry in active]
    if row.get("cut"):
        found = next(
            (
                entry
                for entry in result
                if entry["name"] == row["cut"] and entry["zone"] == "cards"
            ),
            None,
        )
        require(found is not None, f"Cut absent from current deck: {row['cut']}")
        found["quantity"] -= 1
        result = [entry for entry in result if entry["quantity"] > 0]
    if row.get("add"):
        result.append({"name": row["add"], "quantity": 1, "zone": "cards"})
    return result


def structure_check(before, after, floors, retired=()):
    core_roles = ROLES - {"utility"} - set(retired)
    for role in core_roles:
        require(
            not before["roles"].get(role, 0) or after["roles"].get(role, 0) > 0,
            f"Change removes the last provider of {role}",
        )
    for role, minimum in floors.items():
        threshold = min(minimum, before["roles"].get(role, 0))
        require(
            after["roles"].get(role, 0) >= threshold,
            f"Change damages critical role: {role}",
        )
    # A sole provider has informational value beyond a broad role count. The
    # explicit per-pair witness and strategic review cover those narrower jobs.


def final_validation(run):  # noqa: PLR0915 - sequential gates share the proposal context
    run.ready("final")
    validate_plan(run)
    validate_review(run)
    filtered, _ = candidate_filter(run, persist=False)
    accepted = {item["card"]["name"]: item for item in filtered}
    plan = run.load("proposed_swaps.json")
    initial = run.load("active_cards.json")
    cards = run.load("card_data.json") + [item["card"] for item in filtered]
    evaluations = run.load("deck_card_analysis.json") + run.load(
        "candidate_analysis.json"
    )
    floors = run.load("diagnosis.json")["critical_role_floors"]
    diagnosis = run.load("diagnosis.json")
    evaluations_by_name = {row["name"]: row for row in evaluations}
    retired = run.request.get("retire_roles", [])
    before, _ = summarize(initial, cards, evaluations)
    current = initial
    checks = []
    total_cost = Decimal(0)
    for row in plan.get("repairs", []) + plan["swaps"]:
        if row.get("add"):
            require(
                row["add"] in accepted,
                f"Addition no longer passes hard filters: {row['add']}",
            )
            rules_allow(run, row["add"])
            total_cost += price(accepted[row["add"]]["market"], run.request)
        if row.get("cut"):
            rules_allow(run, row["cut"])
            cut_roles = set(evaluations_by_name[row["cut"]]["roles"])
            provider_roles = set()
            for provider in row["remaining_providers"]:
                provider_roles.update(evaluations_by_name[provider]["roles"])
                require(
                    bool(cut_roles & set(evaluations_by_name[provider]["roles"])),
                    f"Replacement witness has no shared role: {provider}",
                )
            require(
                (cut_roles - {"utility"} - set(retired)) <= provider_roles,
                "Name surviving providers for every function lost by the cut",
            )
        single, _ = summarize(apply_change(initial, row), cards, evaluations)
        structure_check(before, single, floors, retired)
        prior, _ = summarize(current, cards, evaluations)
        current = apply_change(current, row)
        after, _ = summarize(current, cards, evaluations)
        structure_check(prior, after, floors, retired)
        if after["front_face_lands"] < prior["front_face_lands"]:
            nonempty(
                diagnosis.get("land_surplus_evidence"),
                "Land reduction requires measured surplus",
            )
            minimum = diagnosis.get("minimum_lands")
            require(
                type(minimum) is int and after["front_face_lands"] >= minimum,
                "Land reduction requires a justified minimum_lands and a sufficient remaining count",  # noqa: E501 - complete diagnostic or template literal
            )
        checks.append(
            {
                "cut": row.get("cut"),
                "add": row.get("add"),
                "individual_after": single,
                "cumulative_after": after,
            }
        )
    after, _ = summarize(current, cards, evaluations)
    fmt = get_format(run.request["format"])
    require(
        after["physical_cards"] == fmt.deck_size, "Final deck has the wrong total size"
    )
    total_cap = run.request["budget"].get("total_additions")
    require(
        total_cap is None or total_cost <= money(total_cap),
        "Total additions exceed budget",
    )
    deck = {"format": fmt.name, "commanders": [], "cards": [], "sideboard": []}
    original_deck = run.load("deck.json")
    for key in ("companion", "owned_cards", "medium"):
        if key in original_deck:
            deck[key] = original_deck[key]
    for row in current:
        deck[row["zone"]].append({"name": row["name"], "quantity": row["quantity"]})
    markets = {m["name"]: m for m in run.load("market_data.json")}
    markets.update({name: item["market"] for name, item in accepted.items()})
    records = []
    names = {row["name"] for row in current}
    for function in diagnosis["unique_functions"]:
        retained = set(function["providers"]) & names
        replacements = [
            name
            for name in names
            if evaluations_by_name[name]
            .get("function_coverage", {})
            .get(function["id"])
        ]
        require(
            retained or replacements,
            f"Change removes critical function: {function['job']}",
        )
    for card in cards:
        if card["name"] not in names:
            continue
        market = markets[card["name"]]
        fresh_legality(market, run.request)
        require(
            age_hours(market.get("oracle_at"))
            <= run.request["freshness"]["oracle_hours"],
            "Refresh stale Oracle data",
        )
        records.append({**card, **market})
    by_name = {card["name"]: card for card in records}
    for item in run.load("auxiliary_data.json"):
        fresh_legality(item["market"], run.request)
        by_name[item["card"]["name"]] = {**item["card"], **item["market"]}
    for commander in deck["commanders"]:
        require(commander["quantity"] == 1, "Each designated commander counts once")
        require(
            fmt.commander_eligibility(by_name[commander["name"]])["eligible"],
            f"Card is not eligible as commander: {commander['name']}",
        )
    rules_allow(run, "commander_model")
    audit = legality_audit(
        HydratedDeck.from_parsed(deck, records=list(by_name.values()))
    )
    require(
        audit["overall_status"] == "PASS",
        f"Final legality fails: {audit['violations']}",
    )
    quantities = Counter()
    for row in current:
        quantities[row["name"]] += row["quantity"]
    for name, quantity in quantities.items():
        limit = card_copy_limit(by_name[name], fmt)
        require(
            limit is None or quantity <= limit,
            f"Copy limit including command zone: {name}",
        )
    recommendations = []
    for row in plan["swaps"]:
        market = accepted[row["add"]]["market"]
        require(
            valid_url(market.get("scryfall_url")),
            f"Missing HTTPS card link: {row['add']}",
        )
        if run.request["output"]["images"]:
            require(
                valid_url(market.get("image_url")),
                f"Missing HTTPS image link: {row['add']}",
            )
        recommendations.append(
            {
                **row,
                "price": str(price(market, run.request)),
                "currency": run.request["budget"]["currency"],
                "price_timestamp": market["price_at"],
                "card_url": market["scryfall_url"],
                "image_url": market["image_url"],
            }
        )
    validation = {
        "status": "PASS",
        "before": before,
        "after": after,
        "per_change": checks,
        "legality": audit,
        "additions_cost": str(total_cost),
        "budget_basis": "gross additions; shipping and proceeds from cuts excluded",
        "url_validation": "HTTPS syntax and provider-supplied metadata; reachability is not asserted",  # noqa: E501 - complete diagnostic or template literal
    }
    run.save("new-deck.json", deck)
    run.save("swap_validation.json", validation)
    run.save(
        "final_recommendations.json",
        {
            "status": "PASS",
            "recommendations": recommendations,
            "repairs": plan.get("repairs", []),
            "validation": "swap_validation.json",
        },
    )
    run.seal("final")
    return validation
