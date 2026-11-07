# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Efficiency regressions; existing research criteria remain unchanged."""

import json
import subprocess
import sys
from argparse import Namespace
from copy import deepcopy

import pytest
from test_research import NEW, RECORDS, answer, make_run, submit_all

from mtg_utils.research import selection
from mtg_utils.research.cards import oracle_record
from mtg_utils.research.cli import (
    competitors,
    complete,
    import_candidates,
    import_data,
    lookup_cards,
    next_operation,
    normalize_request,
)
from mtg_utils.research.evaluation import accept_batch, packet
from mtg_utils.research.selection import candidate_filter, final_validation
from mtg_utils.research.storage import ResearchError, now, read, write
from mtg_utils.research.transport import expand_response


def refresh_candidates(run, records):
    path = run.root / "refresh.json"
    write(path, records)
    import_candidates(
        run,
        Namespace(
            records=path,
            source="synthetic-complete-pool",
            as_of=now(),
            theme="draw",
            exhausted=True,
        ),
    )
    complete(run, "discovery")
    candidate_filter(run)


@pytest.mark.parametrize("field", ["id", "printed_name", "flavor_name"])
def test_printing_metadata_does_not_change_rules_hash(field):
    original = oracle_record(NEW)
    changed = oracle_record({**NEW, field: "Another printing"})
    assert original["oracle_hash"] == changed["oracle_hash"]
    assert changed[field] == "Another printing"


def test_market_refresh_preserves_candidate_interpretation(tmp_path):
    run = make_run(tmp_path)
    refresh_candidates(run, [deepcopy(NEW)])
    assert run.status()["stages"]["candidates"] == "complete"
    assert packet(run, "candidates", 8)["count"] == 0


def test_new_candidate_only_requires_its_own_interpretation(tmp_path):
    run = make_run(tmp_path)
    additional = {**NEW, "name": "Second Shield", "oracle_id": "second-shield"}
    refresh_candidates(run, [deepcopy(NEW), additional])
    result = packet(run, "candidates", 8)
    assert result["count"] == 1


def test_changed_oracle_requires_fresh_candidate_interpretation(tmp_path):
    run = make_run(tmp_path)
    refresh_candidates(run, [{**NEW, "oracle_text": "Draw two cards."}])
    assert run.status()["stages"]["candidates"] != "complete"
    assert packet(run, "candidates", 8)["count"] == 1


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("mana_cost", "{U}"),
        ("cmc", 4),
        ("color_identity", ["U", "B"]),
        ("type_line", "Enchantment"),
        ("oracle_text", "Draw two cards."),
    ],
)
def test_rules_characteristics_remain_part_of_hash(field, value):
    assert (
        oracle_record(NEW)["oracle_hash"]
        != oracle_record({**NEW, field: value})["oracle_hash"]
    )


def test_candidate_printing_switch_reuses_evaluation(tmp_path):
    run = make_run(tmp_path)
    refresh_candidates(
        run, [{**NEW, "id": "cheaper-printing", "prices": {"eur": "1.00"}}]
    )
    assert run.status()["stages"]["candidates"] == "complete"
    validation = final_validation(run)
    assert validation["additions_cost"] == "1.00"


def test_existing_printing_refresh_preserves_understanding(tmp_path):
    run = make_run(tmp_path)
    path = run.root / "reprinted.json"
    write(path, [{**record, "id": "new-printing"} for record in RECORDS])
    import_data(run, Namespace(records=path, source="new-bulk", as_of=now()))
    assert run.status()["stages"]["understanding"] == "complete"
    assert run.status()["stages"]["existing"] == "complete"


def test_removed_candidate_preserves_surviving_evaluations(tmp_path):
    run = make_run(tmp_path)
    additional = {**NEW, "name": "Second Shield", "oracle_id": "second-shield"}
    refresh_candidates(run, [deepcopy(NEW), additional])
    submit_all(run, "candidates")
    refresh_candidates(run, [deepcopy(NEW)])
    assert packet(run, "candidates", 8)["count"] == 0
    complete(run, "candidates")
    assert [row["name"] for row in run.load("candidate_analysis.json")] == [
        "New Shield"
    ]


def test_fresh_market_filter_still_rejects_over_budget_card(tmp_path):
    run = make_run(tmp_path)
    refresh_candidates(run, [{**NEW, "prices": {"eur": "100.00"}}])
    assert run.load("candidates_filtered.json") == []
    complete(run, "candidates")
    assert run.load("candidate_analysis.json") == []
    with pytest.raises(ResearchError):
        final_validation(run)


def compact_answer(record, position):
    result = answer(record)
    result.pop("name")
    result.pop("oracle_hash")
    result["card"] = str(position + 1)
    for state in ("with_commander", "without_commander", "behind"):
        result["states"][state] = {"same_as": "before_commander"}
    return result


def test_compact_round_trip_preserves_complete_evaluation(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8, compact=True)
    payload = read(result["packet"])
    original = {record["name"]: record for record in run.load("card_data.json")}
    responses = [
        compact_answer(original[record["name"]], index)
        for index, record in enumerate(payload["cards"])
    ]
    write(result["response_template"], responses)
    accept_batch(run, result["packet"], result["response_template"])
    complete(run, "existing")
    for row in run.load("deck_card_analysis.json"):
        row.pop("context_digest")
        assert row == answer(original[row["name"]])
    assert len(json.dumps(responses)) < len(
        json.dumps([answer(record) for record in original.values()])
    )
    assert all(
        "oracle_text" not in record
        and record["clauses"] == original[record["name"]]["clauses"]
        for record in payload["cards"]
    )


@pytest.mark.parametrize(
    "states",
    [
        {"before_commander": {"same_as": "before_commander"}},
        {
            "before_commander": {"same_as": "behind"},
            "behind": {"same_as": "before_commander"},
        },
        {"behind": {"same_as": "before_commander", "rating": "high"}},
        {"behind": {"same_as": "imaginary"}},
    ],
)
def test_invalid_state_references_are_rejected(states):
    record = oracle_record(NEW)
    row = compact_answer(record, 0)
    row["states"].update(states)
    with pytest.raises(ResearchError):
        expand_response(row, record)


def test_compact_transport_rejects_foreign_identity(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 1, compact=True)
    record = read(result["packet"])["cards"][0]
    response = compact_answer(record, 0)
    response["name"] = "Foreign Card"
    write(result["response_template"], [response])
    with pytest.raises(ResearchError, match="identity"):
        accept_batch(run, result["packet"], result["response_template"])


def test_character_budget_reduces_batch_without_truncating_cards(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8, compact=True, max_chars=1)
    assert result["count"] == 1
    record = read(result["packet"])["cards"][0]
    original = next(
        card for card in run.load("card_data.json") if card["name"] == record["name"]
    )
    assert record["clauses"] == original["clauses"]


def test_partial_acceptance_collects_errors_and_keeps_valid_rows(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8, compact=True)
    records = read(result["packet"])["cards"]
    responses = [compact_answer(record, index) for index, record in enumerate(records)]
    responses[0]["job"] = ""
    responses[1]["states"]["behind"] = {"rating": "wrong", "reason": "Invalid rating"}
    write(result["response_template"], responses)
    accepted = accept_batch(
        run, result["packet"], result["response_template"], partial=True
    )
    assert accepted["accepted"] == 2
    assert len(accepted["errors"]) == 2
    assert len(run.load("deck_card_analysis.json")) == 2
    with pytest.raises(ResearchError, match="every distinct"):
        complete(run, "existing")
    repairs = [
        compact_answer(record, index) for index, record in enumerate(records[:2])
    ]
    write(accepted["repair_response"], repairs)
    accepted = accept_batch(
        run, result["packet"], accepted["repair_response"], partial=True
    )
    assert accepted["complete"] == 4
    complete(run, "existing")


def advance(run, **kwargs):
    return next_operation(
        run,
        Namespace(
            packet=None, response=None, complete=None, size=8, max_chars=24000, **kwargs
        ),
    )


def test_next_returns_compact_task_and_stops_for_interpretation(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = advance(run)
    assert result["next"] == "existing"
    assert result["task"]["response_format"] == "compact_v1"
    rows = [
        compact_answer(record, index)
        for index, record in enumerate(result["task"]["cards"])
    ]
    write(result["response_template"], rows)
    result = next_operation(
        run,
        Namespace(
            packet=result["packet"],
            response=result["response_template"],
            complete=None,
            size=8,
            max_chars=24000,
        ),
    )
    assert result["next"] == "diagnosis"
    assert result["advanced"] == ["existing", "structure"]
    assert not (run.root / "diagnosis.json").exists()


def test_next_generates_report_after_required_review(tmp_path):
    run = make_run(tmp_path)
    result = advance(run)
    assert result["status"] == "complete"
    assert result["advanced"] == ["final", "report"]
    assert read(run.root / "swap_validation.json")["status"] == "PASS"


def test_competitor_lookup_returns_all_selected_roles_and_names(tmp_path):
    run = make_run(tmp_path)
    result = competitors(run, roles=["card_advantage", "ramp"], names=["Old Shield"])
    assert {row["entry"]["name"] for row in result} == {"Core", "Battery", "Old Shield"}
    assert all(row["card"]["clauses"] and row["evaluation"]["states"] for row in result)


def test_non_commander_requests_are_explicitly_out_of_scope():
    with pytest.raises(ResearchError, match="Commander"):
        normalize_request(
            {"format": "brawl", "deck_source": "deck.json", "goals": ["Improve"]}
        )


def test_completed_run_rechecks_age_at_delivery(tmp_path, monkeypatch):
    run = make_run(tmp_path)
    advance(run)
    monkeypatch.setattr(selection, "age_hours", lambda _: 10000)
    with pytest.raises(ResearchError):
        advance(run)


@pytest.mark.parametrize("key", ["goals", "avoid", "preferences", "meta"])
def test_changed_user_context_never_reuses_interpretation_even_if_summary_matches(
    tmp_path, key
):
    run = make_run(tmp_path)
    run.request[key] = ["Changed context"] if key != "meta" else "Changed context"
    run.save("request.json", run.request)
    complete(run, "understanding")
    result = packet(run, "existing", 8)
    assert result["count"] == 4
    assert result["reused"] == 0


def test_compact_transport_retains_all_faces_and_clauses(tmp_path):
    run = make_run(tmp_path, "understanding")
    records = run.load("card_data.json")
    original = next(record for record in records if record["name"] == "Core")
    replacement = oracle_record(
        {
            **original,
            "card_faces": [
                {
                    "name": "Core",
                    "type_line": "Legendary Creature",
                    "oracle_text": "First clause.\nSecond clause.",
                },
                {
                    "name": "Core Back",
                    "type_line": "Land",
                    "oracle_text": "Third clause.",
                },
            ],
        }
    )
    records[records.index(original)] = replacement
    run.save("card_data.json", records)
    run.seal("data")
    model = run.load("commander_model.json")
    model["commander_clauses"]["Core"] = dict.fromkeys(
        replacement["clauses"], "Explicit clause assessment"
    )
    run.save("commander_model.json", model)
    complete(run, "understanding")
    result = packet(run, "existing", 8, compact=True)
    record = next(
        card for card in read(result["packet"])["cards"] if card["name"] == "Core"
    )
    assert record["clauses"] == {
        "0:0": "First clause.",
        "0:1": "Second clause.",
        "1:0": "Third clause.",
    }
    assert [face["name"] for face in record["card_faces"]] == ["Core", "Core Back"]


def test_next_refuses_to_skip_missing_review(tmp_path):
    run = make_run(tmp_path, "swaps")
    result = advance(run)
    assert result["next"] == "review"
    assert not (run.root / "report.html").exists()


def test_next_preserves_nonempty_rule_questions(tmp_path):
    run = make_run(tmp_path, "filter")
    result = packet(run, "candidates", 8, compact=True)
    record = read(result["packet"])["cards"][0]
    response = compact_answer(record, 0)
    response.update(
        fit="high",
        comparison="Actual providers compared",
        rules_questions=[
            {"id": "timing", "question": "A precise unresolved interaction?"}
        ],
    )
    write(result["response_template"], [response])
    output = next_operation(
        run,
        Namespace(
            packet=result["packet"],
            response=result["response_template"],
            complete=None,
            size=8,
            max_chars=24000,
        ),
    )
    assert output["next"] == "rules"
    assert "swaps" not in output["advanced"]


def test_strict_batch_keeps_atomic_rejection(tmp_path):
    run = make_run(tmp_path, "understanding")
    result = packet(run, "existing", 8)
    rows = [answer(record) for record in read(result["packet"])["cards"]]
    rows[-1]["job"] = ""
    write(result["response_template"], rows)
    with pytest.raises(ResearchError):
        accept_batch(run, result["packet"], result["response_template"])
    assert not (run.root / "deck_card_analysis.json").exists()


def test_source_inventory_reordering_does_not_repeat_analysis(tmp_path):
    run = make_run(tmp_path)
    deck = run.load("deck.json")
    deck["cards"].reverse()
    run.save("deck.json", deck)
    run.save("active_cards.json", list(reversed(run.load("active_cards.json"))))
    run.seal("ingest")
    assert run.status()["stages"]["understanding"] == "complete"
    assert run.status()["stages"]["existing"] == "complete"


def test_changed_quantity_requires_fresh_analysis(tmp_path):
    run = make_run(tmp_path)
    active = run.load("active_cards.json")
    active[1]["quantity"] -= 1
    run.save("active_cards.json", active)
    run.seal("ingest")
    assert run.status()["stages"]["data"] != "complete"
    assert run.status()["stages"]["existing"] != "complete"


def test_next_cli_accepts_compact_responses_with_spaced_paths(tmp_path):
    run = make_run(tmp_path / "space case", "understanding")
    command = [sys.executable, "-m", "mtg_utils.research.cli", "next", str(run.root)]
    process = subprocess.run(command, capture_output=True, text=True, check=True)
    task = json.loads(process.stdout)
    rows = [
        compact_answer(record, index)
        for index, record in enumerate(task["task"]["cards"])
    ]
    write(task["response_template"], rows)
    process = subprocess.run(
        [*command, "--packet", task["packet"], "--response", task["response_template"]],
        capture_output=True,
        text=True,
        check=True,
    )
    assert json.loads(process.stdout)["next"] == "diagnosis"


def test_saved_card_lookup_works_before_interpretation(tmp_path):
    run = make_run(tmp_path, "data")
    result = lookup_cards(run, ["Island", "Core"])
    assert {row["card"]["name"] for row in result} == {"Core", "Island"}
    island = next(row for row in result if row["card"]["name"] == "Island")
    assert island["entries"][0]["quantity"] == 97
    assert island["card"]["clauses"] == {"0:0": "{T}: Add {U}."}
    assert not (run.root / "deck_card_analysis.json").exists()


def test_compact_task_contains_full_inventory(tmp_path):
    run = make_run(tmp_path, "understanding")
    task = advance(run)["task"]
    assert task["inventory"] == run.load("active_cards.json")
    assert sum(entry["quantity"] for entry in task["inventory"]) == 100
