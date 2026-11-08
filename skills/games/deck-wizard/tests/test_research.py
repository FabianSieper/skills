# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Offline regression cases using deliberately synthetic cards, never card advice."""

import json
import subprocess
import sys
from argparse import Namespace
from copy import deepcopy

import pytest

from mtg_utils.formats import get_format
from mtg_utils.research.acquisition import classify_archidekt, deck_id
from mtg_utils.research.cards import oracle_record, protected_names, validate_evaluation
from mtg_utils.research.cli import (
    complete,
    execute,
    import_candidates,
    import_data,
    ingest,
    initialize,
    next_operation,
    normalize_request,
    parser,
    report,
)
from mtg_utils.research.evaluation import (
    accept_batch,
    aggregate,
    packet,
    validate_diagnosis,
    validate_rules,
)
from mtg_utils.research.images import refresh_images
from mtg_utils.research.selection import (
    candidate_filter,
    final_validation,
    plan_gate_findings,
    structure_check,
    validate_exclusions,
    validate_plan,
)
from mtg_utils.research.storage import ResearchError, Run, digest, now, read, write


def card(name, text, type_line="Creature — Test", **extra):
    return {
        "name": name,
        "oracle_id": name,
        "id": "synthetic-test-id",
        "oracle_text": text,
        "type_line": type_line,
        "cmc": 2,
        "mana_cost": "{1}{U}",
        "color_identity": ["U"],
        "legalities": {"commander": "legal"},
        "prices": {"eur": "2.00", "usd": "3.00"},
        "scryfall_uri": "https://scryfall.com/card/synthetic-test-id",
        "image_uris": {"normal": "https://cards.scryfall.io/synthetic.jpg"},
        **extra,
    }


RECORDS = [
    card(
        "Core", "Whenever you cast a spell, draw a card.", "Legendary Creature — Test"
    ),
    card("Island", "{T}: Add {U}.", "Basic Land — Island", cmc=0, mana_cost=""),
    card("Old Shield", "{U}: Target creature gains hexproof until end of turn."),
    card("Battery", "{T}: Add {C}."),
]
NEW = card(
    "New Shield",
    "Target creature gains hexproof until end of turn.\nDraw a card.",
    "Instant",
)
ROLES = {
    "Core": ["value_engine", "card_advantage"],
    "Island": ["land", "mana_fixing"],
    "Old Shield": ["commander_protection"],
    "Battery": ["ramp"],
    "New Shield": ["commander_protection", "card_draw"],
}


def answer(record):
    result = {
        "name": record["name"],
        "oracle_hash": record["oracle_hash"],
        "job": "Synthetic test role",
        "roles": ROLES.get(record["name"], ["utility"]),
        "characteristics": "Synthetic deployment assessment",
        "clause_review": dict.fromkeys(
            record["clauses"], "Effect and actual condition"
        ),
        "states": {
            state: {"rating": "medium", "reason": "Explicit synthetic state assessment"}
            for state in (
                "before_commander",
                "with_commander",
                "without_commander",
                "behind",
            )
        },
        "commander_dependency": "low",
        "setup_complexity": "low",
        "role_compression": "medium",
        "dead_draw_risk": "low",
        "plan_fit": "Fits the synthetic engine",
        "mana_efficiency": "Two mana",
        "alternative_costs": "None",
        "resilience": "Independent of commander",
        "preference_fit": "Fits request",
        "interactions": [],
        "rules_questions": [],
    }
    if record["name"] == "Island":
        result["land"] = {
            "entry_condition": "Untapped",
            "fetchability": "Island basic type",
            "utility": "Mana",
            "source_reliability": "Available after land drop",
            "unconditional_colors": ["U"],
            "conditional_colors": [],
        }
    return result


def submit_all(run, kind):
    while True:
        result = packet(run, kind, 8)
        if not result["count"]:
            break
        payload = read(result["packet"])
        rows = [answer(record) for record in payload["cards"]]
        if kind == "candidates":
            for row in rows:
                row.update(
                    fit="high", comparison="Same protection job plus a needed cantrip"
                )
        response = run.root / "response.json"
        write(response, rows)
        accept_batch(run, result["packet"], response)
    complete(run, kind)


def make_run(tmp_path, through="review"):
    request = tmp_path / "input.json"
    write(
        request,
        {
            "deck_source": "https://archidekt.com/decks/42",
            "goals": ["resilience"],
            "recommendation_count": 1,
            "budget": {"currency": "EUR", "per_card": 5, "total_additions": 5},
        },
    )
    initialize(tmp_path / "run", request)
    run = Run(tmp_path / "run")
    deck_path = tmp_path / "deck.json"
    write(
        deck_path,
        {
            "format": "commander",
            "commanders": [{"name": "Core", "quantity": 1}],
            "cards": [
                {"name": "Island", "quantity": 97},
                {"name": "Old Shield", "quantity": 1},
                {"name": "Battery", "quantity": 1},
            ],
            "sideboard": [],
        },
    )
    ingest(run, Namespace(deck_json=deck_path, payload=None))
    records_path = tmp_path / "records.json"
    write(records_path, RECORDS)
    import_data(
        run, Namespace(records=records_path, source="synthetic-fixture", as_of=now())
    )
    run.save("external_blacklist.json", {"names": [], "sources": []})
    complete(run, "exclusions")
    if through == "data":
        return run
    core = next(c for c in run.load("card_data.json") if c["name"] == "Core")
    model = dict.fromkeys(
        (
            "primary_plan",
            "secondary_plan",
            "win_conditions",
            "setup_sequence",
            "recovery_plan",
            "bottlenecks",
            "realistic_resources",
            "user_alignment",
            "commander_legality_evidence",
        ),
        "Concrete synthetic plan",
    )
    model.update(
        commander_clauses={
            "Core": dict.fromkeys(core["clauses"], "Actual clause meaning")
        },
        interactions=[],
        rules_questions=[],
        predictions=dict.fromkeys(
            ("without_commander", "after_removal", "behind"),
            "Concrete failure prediction",
        ),
    )
    run.save("commander_model.json", model)
    complete(run, "understanding")
    if through == "understanding":
        return run
    submit_all(run, "existing")
    aggregate(run)
    run.save(
        "diagnosis.json",
        {
            "gaps": [
                {
                    "id": "draw",
                    "role": "card_draw",
                    "observed": 0,
                    "evidence": "No dedicated draw",
                    "consequence": "Runs out of cards",
                    "target_reason": "Need a floor",
                }
            ],
            "critical_role_floors": {"land": 35, "commander_protection": 1, "ramp": 1},
            "unique_functions": [],
        },
    )
    run.save(
        "cut_pool.json",
        [
            {
                "name": "Old Shield",
                "job": "Protection",
                "roles": ["commander_protection"],
                "competitors": [],
                "replaceability": "Replacement can provide protection",
                "opportunity_cost": "Cantrip",
                "flags": [],
                "reason": "One-use benefit",
                "lost_if_removed": "Protection",
            }
        ],
    )
    complete(run, "diagnosis")
    run.save(
        "search_plan.json",
        {
            "themes": [
                {
                    "id": "draw",
                    "priority": "high",
                    "job": "Protection and draw",
                    "hypothesis": "A cantrip can preserve the job",
                    "evidence": "draw gap",
                    "query": "Synthetic complete pool",
                }
            ]
        },
    )
    complete(run, "search")
    if through == "search":
        return run
    candidate_path = tmp_path / "candidates.json"
    write(candidate_path, [NEW])
    import_candidates(
        run,
        Namespace(
            records=candidate_path,
            source="synthetic-complete-pool",
            as_of=now(),
            theme="draw",
            exhausted=True,
        ),
    )
    complete(run, "discovery")
    candidate_filter(run)
    if through == "filter":
        return run
    submit_all(run, "candidates")
    run.save("rules_review.json", [])
    complete(run, "rules")
    if through == "rules":
        return run
    change = {
        "cut": "Old Shield",
        "add": "New Shield",
        "reason": "Old Shield protects while New Shield protects and draws.",
        "lost_function": "Protection",
        "remaining_providers": ["New Shield"],
        "replacement_evidence": "Hexproof clause on both",
        "curve_and_mana": "Same cost",
        "combo_impact": "No combo",
    }
    run.save("proposed_swaps.json", {"swaps": [change], "repairs": []})
    complete(run, "swaps")
    if through == "swaps":
        return run
    review = dict.fromkeys(
        (
            "whole_deck_plan",
            "commander_identity",
            "combo_preservation",
            "mana",
            "user_preferences",
        ),
        "Verified synthetic assessment",
    )
    review.update(
        mode="separate_passes",
        proposal_digest=digest(run.load("proposed_swaps.json")),
        pairs=[
            {
                "cut": "Old Shield",
                "add": "New Shield",
                "best_case_for_keeping_cut": "Repeated activation",
                "failure_case_for_add": "One shot",
                "alternative": "No change",
                "resolution": "Cantrip fits goal",
                "verdict": "accept",
            }
        ],
    )
    run.save("strategic_review.json", review)
    complete(run, "review")
    return run


def payload():
    return {
        "id": 42,
        "categories": [
            {"name": name, "includedInDeck": included}
            for name, included in (
                ("Commander", True),
                ("Ramp", True),
                ("To Be Removed", False),
                ("Sideboard", True),
            )
        ],
        "cards": [
            {
                "id": 1,
                "quantity": 1,
                "categories": ["Commander"],
                "card": {"oracleCard": {"name": "Core"}},
            },
            {
                "id": 2,
                "quantity": 1,
                "categories": ["Ramp"],
                "card": {"oracleCard": {"name": "Battery"}},
            },
        ],
    }


def test_full_pipeline_and_resume(tmp_path):
    run = make_run(tmp_path)
    result = final_validation(run)
    assert result["status"] == "PASS"
    assert result["after"]["physical_cards"] == 100
    assert result["after"]["roles"]["card_draw"] == 1
    assert result["additions_cost"] == "2.00"
    report(run)
    assert Run(run.root).status()["next"] is None
    assert (run.root / "report.html").is_file()


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (
            lambda p: p["cards"][1]["categories"].append("To Be Removed"),
            "excluded_cards.json",
        ),
        (
            lambda p: p["cards"][1]["categories"].append("Unknown"),
            "unresolved_cards.json",
        ),
        (lambda p: p["cards"][1].update(deletedAt="timestamp"), "excluded_cards.json"),
        (
            lambda p: p["cards"][1].update(categories=["Sideboard", "Ramp"]),
            "excluded_cards.json",
        ),
    ],
)
def test_membership_precedence(mutation, expected):
    data = payload()
    mutation(data)
    result = classify_archidekt(data, "42", get_format("commander"))
    assert result[expected][0]["name"] == "Battery"
    assert result["deck_validation.json"]["total"] == 1


def test_unknown_category_plus_exclusion_is_excluded():
    data = payload()
    data["cards"][1]["categories"] += ["Unknown", "To Be Removed"]
    result = classify_archidekt(data, "42", get_format("commander"))
    assert result["unresolved_cards.json"] == []
    assert len(result["excluded_cards.json"]) == 1


def test_wrong_deck_id_blocked():
    with pytest.raises(ResearchError, match="wrong"):
        classify_archidekt(payload(), "43", get_format("commander"))


def test_multi_categories_do_not_duplicate():
    data = payload()
    data["cards"][1]["categories"] += ["Ramp"]
    assert (
        classify_archidekt(data, "42", get_format("commander"))["deck_validation.json"][
            "total"
        ]
        == 2
    )


def test_multiple_printings_sum_quantities():
    data = payload()
    duplicate = deepcopy(data["cards"][1])
    duplicate["id"] = 3
    data["cards"].append(duplicate)
    result = classify_archidekt(data, "42", get_format("commander"))
    assert result["deck.json"]["cards"] == [{"name": "Battery", "quantity": 2}]


def test_partner_inventory_is_not_automatically_rejected():
    data = payload()
    data["cards"][1]["categories"] = ["Commander"]
    result = classify_archidekt(data, "42", get_format("commander"))
    assert result["deck_validation.json"]["commanders"] == 2
    assert result["deck_validation.json"]["complete"] is True


def test_source_url_domain_is_checked():
    with pytest.raises(ResearchError):
        deck_id("https://malicious.example/decks/42")


def test_search_cannot_skip_existing_analysis(tmp_path):
    run = make_run(tmp_path, "understanding")
    with pytest.raises(ResearchError, match="requires completed"):
        complete(run, "search")


def test_missing_second_oracle_clause_rejected():
    record = oracle_record(NEW)
    row = answer(record)
    row["clause_review"].pop("0:1")
    with pytest.raises(ResearchError, match="every Oracle"):
        validate_evaluation(row, record)


def test_missing_board_state_rejected():
    record = oracle_record(NEW)
    row = answer(record)
    del row["states"]["behind"]
    with pytest.raises(ResearchError, match="behind"):
        validate_evaluation(row, record)


def test_oversize_batch_rejected(tmp_path):
    with pytest.raises(ResearchError, match="1-12"):
        packet(make_run(tmp_path, "understanding"), "existing", 13)


def test_stale_packet_is_rejected(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8)
    response = tmp_path / "answer.json"
    write(response, [answer(c) for c in read(result["packet"])["cards"]])
    model = run.load("commander_model.json")
    model["primary_plan"] = "A changed plan"
    run.save("commander_model.json", model)
    complete(run, "understanding")
    with pytest.raises(ResearchError, match="stale"):
        accept_batch(run, result["packet"], response)


def test_incomplete_coverage_rejected(tmp_path):
    run = make_run(tmp_path, "understanding")
    run.save("deck_card_analysis.json", [])
    with pytest.raises(ResearchError, match="every distinct"):
        complete(run, "existing")


def test_budget_change_preserves_understanding_and_search(tmp_path):
    run = make_run(tmp_path)
    request = run.request
    request["budget"]["per_card"] = 1
    run.save("request.json", request)
    status = Run(run.root).status()
    assert status["stages"]["understanding"] == "complete"
    assert status["stages"]["search"] == "complete"
    assert status["next"] == "filter"


def test_output_change_only_invalidates_report(tmp_path):
    run = make_run(tmp_path)
    final_validation(run)
    report(run)
    request = run.request
    request["output"]["images"] = False
    run.save("request.json", request)
    assert Run(run.root).status()["next"] == "report"


def test_manual_output_change_invalidates_receipt(tmp_path):
    run = make_run(tmp_path)
    run.save("deck_card_analysis.json", [])
    assert Run(run.root).status()["next"] == "existing"


def test_protected_face_alias(tmp_path):
    run = make_run(tmp_path, "data")
    records = run.load("card_data.json")
    records[0]["flavor_name"] = "Special Printed Name"
    run.save("card_data.json", records)
    run.request["protected_cards"] = ["Special Printed Name"]
    assert protected_names(run) == {records[0]["name"]}


def test_unresolved_protection_blocks(tmp_path):
    run = make_run(tmp_path, "data")
    run.request["protected_cards"] = ["Unknown"]
    with pytest.raises(ResearchError, match="Unresolved"):
        protected_names(run)


def test_external_blacklist_incomplete_or_stale_blocks(tmp_path):
    run = make_run(tmp_path, "data")
    run.request["external_exclusion_sources"] = ["notion:db"]
    run.save(
        "external_blacklist.json",
        {
            "names": [],
            "sources": [
                {
                    "id": "notion:db",
                    "complete": False,
                    "names": [],
                    "retrieved_at": now(),
                }
            ],
        },
    )
    with pytest.raises(ResearchError, match="incomplete"):
        validate_exclusions(run)
    source = run.load("external_blacklist.json")
    source["sources"][0].update(complete=True, retrieved_at="2000-01-01T00:00:00+00:00")
    run.save("external_blacklist.json", source)
    with pytest.raises(ResearchError, match="stale"):
        validate_exclusions(run)


def test_truncated_search_cannot_complete(tmp_path):
    run = make_run(tmp_path, "search")
    path = tmp_path / "candidates.json"
    write(path, [NEW])
    import_candidates(
        run,
        Namespace(
            records=path,
            source="first-page",
            as_of=now(),
            theme="draw",
            exhausted=False,
        ),
    )
    with pytest.raises(ResearchError, match="Finish each"):
        complete(run, "discovery")


@pytest.mark.parametrize(
    ("mutation", "reason"),
    [
        (lambda c: c.update(color_identity=["R"]), "color_identity"),
        (
            lambda c: c.update(legalities={"commander": "banned"}),
            "format_illegal_or_unknown",
        ),
        (lambda c: c.update(prices={"eur": "50"}), "over_per_card_budget"),
        (lambda c: c.update(prices={}), "Missing EUR"),
    ],
)
def test_hard_filters(tmp_path, mutation, reason):
    run = make_run(tmp_path, "search")
    candidate = deepcopy(NEW)
    mutation(candidate)
    path = tmp_path / "candidates.json"
    write(path, [candidate])
    import_candidates(
        run,
        Namespace(
            records=path, source="pool", as_of=now(), theme="draw", exhausted=True
        ),
    )
    complete(run, "discovery")
    accepted, rejected = candidate_filter(run)
    assert accepted == []
    assert any(reason in r for r in rejected[0]["reasons"])


def test_active_oracle_identity_blocks_different_printing(tmp_path):
    run = make_run(tmp_path, "search")
    candidate = deepcopy(NEW)
    candidate["oracle_id"] = "Old Shield"
    path = tmp_path / "candidates.json"
    write(path, [candidate])
    import_candidates(
        run,
        Namespace(
            records=path, source="pool", as_of=now(), theme="draw", exhausted=True
        ),
    )
    complete(run, "discovery")
    assert "already_active" in candidate_filter(run)[1][0]["reasons"]


def test_rules_evidence_must_exist(tmp_path):
    run = make_run(tmp_path, "rules")
    analysis = run.load("candidate_analysis.json")
    analysis[0]["rules_questions"] = [
        {"id": "q", "question": "Does this interaction work?"}
    ]
    run.save("candidate_analysis.json", analysis)
    run.save(
        "rules_review.json",
        [
            {
                "id": "New Shield::q",
                "status": "verified",
                "answer": "Yes under conditions",
                "sources": [],
            }
        ],
    )
    with pytest.raises(ResearchError, match="saved primary evidence"):
        validate_rules(run)


def test_last_critical_provider_cannot_disappear():
    with pytest.raises(ResearchError, match="last provider"):
        structure_check({"roles": {"graveyard_protection": 1}}, {"roles": {}}, {})


def test_cumulative_losses_fail_even_when_individual_loss_passes():
    structure_check(
        {"roles": {"commander_protection": 2}},
        {"roles": {"commander_protection": 1}},
        {"commander_protection": 1},
    )
    with pytest.raises(ResearchError):
        structure_check(
            {"roles": {"commander_protection": 1}},
            {"roles": {}},
            {"commander_protection": 1},
        )


def test_exact_count_shortfall_is_not_padded(tmp_path):
    run = make_run(tmp_path, "rules")
    run.save("proposed_swaps.json", {"repairs": [], "swaps": []})
    with pytest.raises(ResearchError, match="Requested 1"):
        complete(run, "swaps")


def test_unknown_price_is_not_free():
    with pytest.raises(ResearchError):
        normalize_request(
            {"deck_source": "42", "goals": ["test"], "budget": {"per_card": "NaN"}}
        )


def test_report_escapes_source_text(tmp_path):
    run = make_run(tmp_path)
    plan = run.load("proposed_swaps.json")
    plan["swaps"][0]["reason"] = "<script>bad()</script>"
    run.save("proposed_swaps.json", plan)
    complete(run, "swaps")
    review = run.load("strategic_review.json")
    review["proposal_digest"] = digest(plan)
    run.save("strategic_review.json", review)
    complete(run, "review")
    final_validation(run)
    report(run)
    text = (run.root / "report.html").read_text()
    assert "<script>" not in text
    assert "&lt;script&gt;" in text


def test_response_template_preserves_machine_identifiers(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8)
    cards = read(result["packet"])["cards"]
    template = read(result["response_template"])
    assert [(row["name"], row["oracle_hash"]) for row in template] == [
        (record["name"], record["oracle_hash"]) for record in cards
    ]
    with pytest.raises(ResearchError, match="job"):
        accept_batch(run, result["packet"], result["response_template"])


def test_later_cut_cannot_be_a_remaining_provider(tmp_path):
    run = make_run(tmp_path, "swaps")
    run.request["recommendation_count"] = 2
    run.request["max_swaps"] = 2
    pool = run.load("cut_pool.json")
    pool.append({**pool[0], "name": "Battery"})
    run.save("cut_pool.json", pool)
    analysis = run.load("candidate_analysis.json")
    analysis.append({**analysis[0], "name": "Another Add"})
    run.save("candidate_analysis.json", analysis)
    plan = run.load("proposed_swaps.json")
    plan["swaps"][0]["remaining_providers"] = ["Battery"]
    plan["swaps"].append(
        {
            **plan["swaps"][0],
            "cut": "Battery",
            "add": "Another Add",
            "remaining_providers": ["New Shield"],
        }
    )
    run.save("proposed_swaps.json", plan)
    with pytest.raises(ResearchError, match="absent from the final deck"):
        validate_plan(run)


@pytest.mark.parametrize(
    "role", ["graveyard_setup", "tutor", "commander_enabler", "finisher"]
)
def test_last_specialized_provider_is_preserved(role):
    with pytest.raises(ResearchError, match="last provider"):
        structure_check({"roles": {role: 1}}, {"roles": {}}, {})


def test_explicitly_retired_role_can_be_removed():
    structure_check(
        {"roles": {"combat_enabler": 1}}, {"roles": {}}, {}, ["combat_enabler"]
    )


def test_alias_exclusion_is_applied_after_hydration(tmp_path):
    run = make_run(tmp_path, "data")
    run.request["excluded_cards"] = ["Printed Battery"]
    run.save("request.json", run.request)
    ingest(run, Namespace(deck_json=tmp_path / "deck.json", payload=None))
    records = deepcopy(RECORDS)
    records[-1]["flavor_name"] = "Printed Battery"
    write(tmp_path / "records.json", records)
    import_data(
        run, Namespace(records=tmp_path / "records.json", source="fixture", as_of=now())
    )
    assert "Battery" not in {row["name"] for row in run.load("active_cards.json")}
    assert run.load("deck_validation.json")["total"] == 99
    assert run.load("deck_validation.json")["excluded"] == 1


def test_constructed_sideboard_is_separate_even_when_not_in_main_deck():
    data = payload()
    data["cards"][0]["categories"] = ["Ramp"]
    data["cards"][1]["categories"] = ["Sideboard"]
    data["categories"][-1]["includedInDeck"] = False
    result = classify_archidekt(data, "42", get_format("modern"))
    assert result["deck_validation.json"]["total"] == 1
    assert result["deck_validation.json"]["sideboard"] == 1
    assert result["excluded_cards.json"] == []


def _broken_plan(run):
    run.request["recommendation_count"] = 2
    run.request["max_swaps"] = 2
    run.save("request.json", run.request)
    plan = run.load("proposed_swaps.json")
    swap = {**plan["swaps"][0], "remaining_providers": ["Old Shield"]}
    del swap["reason"]
    plan["swaps"] = [
        swap,
        {
            **plan["swaps"][0],
            "cut": "Battery",
            "add": "New Shield",
            "remaining_providers": ["New Shield"],
        },
    ]
    run.save("proposed_swaps.json", plan)
    return plan


def test_plan_gate_findings_collects_every_problem_at_once(tmp_path):
    run = make_run(tmp_path, "swaps")
    _broken_plan(run)
    findings = plan_gate_findings(run)
    text = "\n".join(findings)
    assert len(findings) >= 4
    assert "change 0 (Old Shield -> New Shield)" in text
    assert "absent from the final deck" in text
    assert "missing reason" in text
    assert "cut must be an analyzed mainboard cut candidate: Battery" in text
    assert "same addition used twice: New Shield" in text
    with pytest.raises(ResearchError) as raised:
        validate_plan(run)
    for fragment in (
        "Plan gate failures",
        "absent from the final deck",
        "missing reason",
    ):
        assert fragment in str(raised.value)


def test_check_plan_cli_reports_every_finding_with_exit_code(tmp_path):
    run = make_run(tmp_path, "swaps")
    process = subprocess.run(
        [sys.executable, "-m", "mtg_utils.research.cli", "check-plan", str(run.root)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert process.returncode == 0
    assert json.loads(process.stdout)["status"] == "PASS"
    _broken_plan(run)
    result = execute(parser().parse_args(["check-plan", str(run.root)]))
    assert result["status"] == "FAIL"
    assert len(result["findings"]) >= 4
    process = subprocess.run(
        [sys.executable, "-m", "mtg_utils.research.cli", "check-plan", str(run.root)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert process.returncode == 1
    assert json.loads(process.stdout)["status"] == "FAIL"


def test_check_plan_before_swaps_is_actionable(tmp_path):
    run = make_run(tmp_path, "rules")
    result = execute(parser().parse_args(["check-plan", str(run.root)]))
    assert result["status"] == "FAIL"
    assert "proposed_swaps.json" in result["findings"][0]


def test_next_for_review_lists_the_required_audits(tmp_path):
    run = make_run(tmp_path, "swaps")
    result = next_operation(
        run,
        Namespace(packet=None, response=None, complete=None, size=8, max_chars=24000),
    )
    assert result["next"] == "review"
    audits = result["required_audits"]["before_complete_review"]
    for tool in (
        "check-plan",
        "mana-audit",
        "deck-stats",
        "combo-search",
        "proposal-check",
    ):
        assert any(tool in line for line in audits)


def test_final_validation_records_the_combo_search(tmp_path, monkeypatch):
    import mtg_utils.research.selection as selection_module

    monkeypatch.setattr(
        selection_module,
        "combo_search",
        lambda _hydrated, **_kwargs: {
            "combos": [{"cards": ["Card A", "Card B"]}],
            "near_misses": [],
            "api_unavailable": False,
        },
    )
    run = make_run(tmp_path)
    result = final_validation(run)
    assert result["status"] == "PASS"
    assert result["combos"]["status"] == "searched"
    assert result["combos"]["combos"] == [{"cards": ["Card A", "Card B"]}]
    assert run.load("swap_validation.json")["combos"]["status"] == "searched"


def test_final_validation_degrades_when_spellbook_is_unavailable(tmp_path, monkeypatch):
    import mtg_utils.research.selection as selection_module

    monkeypatch.setattr(
        selection_module,
        "combo_search",
        lambda _hydrated, **_kwargs: {
            "combos": [],
            "near_misses": [],
            "api_unavailable": True,
        },
    )
    run = make_run(tmp_path)
    result = final_validation(run)
    assert result["status"] == "PASS"
    assert result["combos"]["status"] == "degraded"
    assert run.load("swap_validation.json")["combos"]["status"] == "degraded"


def test_final_validation_degrades_when_the_combo_call_raises(tmp_path, monkeypatch):
    import mtg_utils.research.selection as selection_module

    def unavailable(_hydrated, **_kwargs):
        raise RuntimeError("no network")

    monkeypatch.setattr(selection_module, "combo_search", unavailable)
    run = make_run(tmp_path)
    result = final_validation(run)
    assert result["status"] == "PASS"
    assert result["combos"]["status"] == "degraded"
    assert result["combos"]["reason"]


def test_cut_pool_roles_must_match_the_card_analysis(tmp_path):
    run = make_run(tmp_path)
    pool = run.load("cut_pool.json")
    pool[0]["roles"] = ["ramp"]
    run.save("cut_pool.json", pool)
    with pytest.raises(ResearchError, match="must equal the analyzed roles"):
        validate_diagnosis(run)
    pool = run.load("cut_pool.json")
    del pool[0]["roles"]
    run.save("cut_pool.json", pool)
    with pytest.raises(ResearchError, match="must equal the analyzed roles"):
        validate_diagnosis(run)


def test_refresh_images_patches_missing_records_and_keeps_run_complete(
    tmp_path, monkeypatch
):
    import mtg_utils.research.images as images_module

    monkeypatch.setattr(
        images_module,
        "fetch_verified_image",
        lambda _market: (
            "https://cards.scryfall.io/verified.jpg",
            "; scryfall image refresh (verified 200 image/*)",
        ),
    )
    run = make_run(tmp_path)
    raw = run.load("candidates_raw.json")
    name = raw[0]["card"]["name"]
    raw[0]["market"]["image_url"] = None
    run.save("candidates_raw.json", raw)
    result = refresh_images(run, {name})
    assert result["updated"] == [name]
    assert result["failed"] == {}
    patched = run.load("candidates_raw.json")
    record = next(item for item in patched if item["card"]["name"] == name)
    assert record["market"]["image_url"] == "https://cards.scryfall.io/verified.jpg"
    assert "image refresh" in record["market"]["source"]
    # A market-record change reseals discovery/filter deterministically and
    # preserves the interpretation (market-only); only the final gate repeats.
    statuses = Run(run.root).status()["stages"]
    for stage in ("discovery", "filter", "candidates", "swaps", "review"):
        assert statuses[stage] == "complete"
    assert statuses["final"] in ("pending", "stale")
    assert final_validation(run)["status"] == "PASS"
    report(run)
    assert Run(run.root).status()["next"] is None


def test_refresh_images_noop_when_images_are_present(tmp_path):
    run = make_run(tmp_path)
    raw = run.load("candidates_raw.json")
    name = raw[0]["card"]["name"]
    before = Run(run.root).status()
    result = refresh_images(run, {name})
    assert result["updated"] == []
    assert name in result["already_present"]
    assert Run(run.root).status() == before


def test_refresh_images_reports_unknown_names_without_writing(tmp_path):
    run = make_run(tmp_path)
    state_before = (run.root / "candidates_raw.json").read_bytes()
    result = refresh_images(run, {"NoSuch Card"})
    assert result["not_found"] == ["NoSuch Card"]
    assert result["updated"] == []
    assert (run.root / "candidates_raw.json").read_bytes() == state_before
