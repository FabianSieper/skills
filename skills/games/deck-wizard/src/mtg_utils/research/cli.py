# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Small explicit operations for a persistent research run."""

from __future__ import annotations

import argparse
import html
import json
import sys
from pathlib import Path

from mtg_utils.formats import get_format

from .acquisition import (
    assemble,
    classify_archidekt,
    deck_id,
    fetch_archidekt,
    from_parsed,
)
from .cards import (
    ROLES,
    aliases,
    index_records,
    market_record,
    name_key,
    oracle_record,
    resolve,
    valid_url,
)
from .evaluation import (
    accept_batch,
    aggregate,
    packet,
    rules_questions,
    validate_coverage,
    validate_diagnosis,
    validate_model,
    validate_rules,
)
from .images import refresh_images
from .selection import (
    candidate_filter,
    final_validation,
    money,
    plan_gate_findings,
    validate_exclusions,
    validate_plan,
    validate_review,
)
from .storage import (
    STAGES,
    ResearchError,
    Run,
    nonempty,
    now,
    read,
    require,
    write,
)
from .transport import packet_card


def normalize_request(raw):
    request = dict(raw)
    request.setdefault("format", "commander")
    require(
        request["format"] == "commander",
        "This skill covers paper Commander; use a separate workflow for other formats",
    )
    nonempty(request.get("deck_source"), "deck_source")
    for key in (
        "goals",
        "avoid",
        "preferences",
        "protected_cards",
        "rejected_cards",
        "external_exclusion_sources",
        "excluded_categories",
        "excluded_cards",
        "retire_roles",
    ):
        request.setdefault(key, [])
        require(
            isinstance(request[key], list)
            and all(isinstance(value, str) for value in request[key]),
            f"{key} must be a string list",
        )
    require(
        bool(request["goals"]),
        "Normalize at least one user goal; record general optimization explicitly",
    )
    request.setdefault("recommendation_count", None)
    require(set(request["retire_roles"]) <= ROLES, "Unknown role in retire_roles")
    request.setdefault("max_swaps", request["recommendation_count"] or 10)
    require(
        type(request["max_swaps"]) is int and request["max_swaps"] >= 0,
        "Invalid max_swaps",
    )
    count = request["recommendation_count"]
    require(
        count is None or (type(count) is int and 0 <= count <= request["max_swaps"]),
        "Invalid recommendation_count",
    )
    request.setdefault("budget", {})
    request["budget"].setdefault("currency", "EUR")
    require(
        request["budget"]["currency"] in ("EUR", "USD"),
        "Budget currency must be EUR or USD; Arena wildcard work uses the Arena workflow",  # noqa: E501 - complete diagnostic or template literal
    )
    request["budget"].setdefault("per_card", raw.get("max_price_eur"))
    request["budget"].setdefault("total_additions", None)
    for field in ("per_card", "total_additions"):
        if request["budget"][field] is not None:
            money(request["budget"][field])
    request.setdefault("freshness", {})
    for field, default in (
        ("price_hours", 24),
        ("legality_hours", 24),
        ("oracle_hours", 720),
        ("exclusion_hours", 24),
    ):
        request["freshness"].setdefault(field, default)
        value = request["freshness"][field]
        require(type(value) in (int, float) and value > 0, f"Invalid {field}")
    request.setdefault("output", {})
    request["output"].setdefault("images", True)
    request["output"].setdefault("language", "user")
    request.setdefault("external_write", None)
    return request


def initialize(directory, request_path):
    root = Path(directory).resolve()
    require(
        not (root / "run_state.json").exists(),
        "Run already exists; use status and update-request",
    )
    write(root / "request.json", normalize_request(read(request_path)))
    write(
        root / "run_state.json",
        {"schema_version": 1, "created_at": now(), "stages": {}},
    )
    return Run(root).status()


def ingest(run, args):
    run.ready("ingest")
    fmt = get_format(run.request["format"])
    if args.deck_json:
        raw = read(args.deck_json)
        artifacts = from_parsed(raw, fmt)
    else:
        identifier = deck_id(run.request["deck_source"])
        raw = read(args.payload) if args.payload else fetch_archidekt(identifier)
        artifacts = classify_archidekt(
            raw,
            identifier,
            fmt,
            run.request["excluded_categories"],
            run.request["excluded_cards"],
        )
    run.save("deck_raw.json", raw)
    for name, value in artifacts.items():
        run.save(name, value)
    require(
        artifacts["deck_validation.json"]["complete"],
        "Deck is incomplete; resolve unresolved cards/commander before analysis",
    )
    run.seal("ingest")
    return artifacts["deck_validation.json"]


def record_list(path):
    value = read(path)
    records = value.get("records") if isinstance(value, dict) else value
    require(
        isinstance(records, list) and all(isinstance(card, dict) for card in records),
        "Expected a full hydrated sidecar or list of card records; resolve missing records first",  # noqa: E501 - complete diagnostic or template literal
    )
    return records


def import_data(run, args):
    run.ready("data")
    records = record_list(args.records)
    index = index_records(records)
    active = run.load("active_cards.json")
    canonical, markets, counts = {}, {}, {}
    mapping = {}
    excluded = run.load("excluded_cards.json")
    excluded_keys = {name_key(name) for name in run.request["excluded_cards"]}
    for row in active:
        card = resolve(index, row["name"])
        if aliases(card) & excluded_keys:
            excluded.append(
                {**row, "reasons": ["explicit_card_exclusion_after_name_resolution"]}
            )
            continue
        canonical[card["name"]] = oracle_record(card)
        markets[card["name"]] = market_record(card, args.as_of, args.source)
        mapping[row["name"]] = card["name"]
        key = (row["zone"], card["name"])
        counts[key] = counts.get(key, 0) + row["quantity"]
    normalized = [
        {"zone": zone, "name": name, "quantity": qty}
        for (zone, name), qty in counts.items()
    ]
    if normalized != active:
        deck = run.load("deck.json")
        artifacts = assemble(
            normalized, excluded, [], [], get_format(run.request["format"])
        )
        for key in ("owned_cards", "companion", "pool", "medium"):
            if key in deck:
                artifacts["deck.json"][key] = deck[key]
        for name, value in artifacts.items():
            run.save(name, value)
        require(
            artifacts["deck_validation.json"]["complete"],
            "Exclusions removed the commander; resolve the deck",
        )
        run.seal("ingest")
    run.save("card_data.json", sorted(canonical.values(), key=lambda c: c["name"]))
    run.save("market_data.json", sorted(markets.values(), key=lambda c: c["name"]))
    run.save("name_resolution.json", mapping)
    auxiliary = []
    for entry in run.load("deck.json").get("companion", []):
        card = resolve(index, entry["name"])
        auxiliary.append(
            {
                "card": oracle_record(card),
                "market": market_record(card, args.as_of, args.source),
            }
        )
    run.save("auxiliary_data.json", auxiliary)
    run.seal("data")
    return {"cards": len(canonical), "quantity": sum(r["quantity"] for r in normalized)}


def validate_search(run):
    themes = run.load("search_plan.json").get("themes")
    require(
        isinstance(themes, list) and themes, "Search plan requires mechanical themes"
    )
    require(len({t.get("id") for t in themes}) == len(themes), "Duplicate search theme")
    for theme in themes:
        for key in ("id", "job", "hypothesis", "evidence", "query"):
            nonempty(theme.get(key), f"search theme.{key}")
        require(
            theme.get("priority") in ("high", "medium", "low"),
            "Use qualitative search priorities",
        )


def import_candidates(run, args):
    run.ready("discovery")
    themes = {t["id"] for t in run.load("search_plan.json")["themes"]}
    require(
        args.theme in themes, "Candidate search must belong to the saved search plan"
    )
    signature = run.input_digest("discovery")
    raw_path, log_path = run.root / "candidates_raw.json", run.root / "search_log.json"
    log = (
        read(log_path)
        if log_path.exists()
        else {"context_digest": signature, "searches": []}
    )
    if log.get("context_digest") != signature:
        log = {"context_digest": signature, "searches": []}
        prior = []
    else:
        prior = read(raw_path) if raw_path.exists() else []
    records = record_list(args.records)
    items = [
        {
            "card": oracle_record(card),
            "market": market_record(card, args.as_of, args.source),
            "theme": args.theme,
        }
        for card in records
    ]
    key = (args.theme, args.source)
    prior = [item for item in prior if (item["theme"], item["market"]["source"]) != key]
    run.save("candidates_raw.json", prior + items)
    log["searches"] = [s for s in log["searches"] if (s["theme"], s["source"]) != key]
    log["searches"].append(
        {
            "theme": args.theme,
            "source": args.source,
            "count": len(records),
            "as_of": args.as_of,
            "exhausted": args.exhausted,
        }
    )
    run.save("search_log.json", log)
    return {"imported": len(items), "raw_total": len(prior) + len(items)}


def complete(run, stage):
    run.ready(stage)
    if stage == "exclusions":
        validate_exclusions(run)
    elif stage == "understanding":
        validate_model(run)
    elif stage in ("existing", "candidates"):
        validate_coverage(run, stage)
    elif stage == "diagnosis":
        validate_diagnosis(run)
    elif stage == "search":
        validate_search(run)
    elif stage == "discovery":
        log = run.load("search_log.json")
        require(
            log.get("context_digest") == run.input_digest(stage), "Search log is stale"
        )
        themes = {t["id"] for t in run.load("search_plan.json")["themes"]}
        require(
            {s["theme"] for s in log["searches"]} == themes,
            "Search every planned mechanical theme",
        )
        require(
            all(s.get("exhausted") is True for s in log["searches"]),
            "Finish each saved search query (pagination/result limits); refine an over-broad theme before completing",  # noqa: E501 - complete diagnostic or template literal
        )
        require(
            isinstance(run.load("candidates_raw.json"), list), "Missing raw candidates"
        )
    elif stage == "rules":
        validate_rules(run)
    elif stage == "swaps":
        validate_plan(run)
    elif stage == "review":
        validate_review(run)
    else:
        raise ResearchError(
            f"{stage} is deterministic; run its named command rather than manually completing it"  # noqa: E501 - complete diagnostic or template literal
        )
    run.seal(stage)
    return run.status()


def report(run):
    run.ready("report")
    # A receipt cannot freeze a price forever. Re-run hard filters/legality at
    # delivery time even if no file has changed since the earlier validation.
    final_validation(run)
    final = run.load("final_recommendations.json")
    validation = run.load("swap_validation.json")
    limitations = [validation["budget_basis"], validation["url_validation"]]
    if validation.get("combos", {}).get("status") != "searched":
        limitations.append(
            "combo audit degraded: "
            + validation.get("combos", {}).get(
                "reason", "Commander Spellbook unavailable"
            )
        )
    document = {
        "deck": run.request["deck_source"],
        "goals": run.request["goals"],
        "diagnosis": run.load("diagnosis.json"),
        "recommendations": final["recommendations"],
        "repairs": final["repairs"],
        "before": validation["before"],
        "after": validation["after"],
        "currency": run.request["budget"]["currency"],
        "additions_cost": validation["additions_cost"],
        "limitations": limitations,
    }
    run.save("report.json", document)

    def esc(value):
        return html.escape(str(value))

    parts = [
        "<!doctype html><html lang='en'><meta charset='utf-8'><title>Deck analysis</title>",  # noqa: E501 - complete diagnostic or template literal
        "<style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:20px}table{border-collapse:collapse;width:100%}td,th{padding:12px;text-align:left;border-bottom:1px solid #ccc}img{width:110px}small{color:#555}</style>",  # noqa: E501 - complete diagnostic or template literal
        f"<h1>Deck analysis</h1><p>{esc(document['deck'])}</p>",
        f"<p>{esc('; '.join(document['goals']))}</p><h2>Findings</h2><ul>",
    ]
    for gap in document["diagnosis"]["gaps"]:
        parts.append(  # noqa: PERF401 - readable report assembly
            f"<li><b>{esc(gap['role'])}: {gap['observed']}</b> — {esc(gap['evidence'])}. {esc(gap['consequence'])}</li>"  # noqa: E501 - complete diagnostic or template literal
        )
    parts += [
        "</ul><h2>Swaps</h2><table><tr><th>Cut</th><th>Add</th><th>Comparison</th><th>Price</th></tr>"
    ]
    for row in document["recommendations"]:
        picture = (
            f"<br><img loading='lazy' src='{esc(row['image_url'])}' alt='{esc(row['add'])}'>"  # noqa: E501 - complete diagnostic or template literal
            if run.request["output"]["images"]
            else ""
        )
        parts.append(
            f"<tr><td>{esc(row['cut'])}</td><td><a href='{esc(row['card_url'])}'>{esc(row['add'])}</a>{picture}</td><td>{esc(row['reason'])}<br><small>Lost: {esc(row['lost_function'])}</small></td><td>{esc(row['price'])} {esc(row['currency'])}<br><small>{esc(row['price_timestamp'])}</small></td></tr>"  # noqa: E501 - complete diagnostic or template literal
        )
    parts += [
        "</table>",
        f"<p>Additions: {esc(document['additions_cost'])} {esc(document['currency'])}</p>",  # noqa: E501 - complete diagnostic or template literal
        f"<p>Cards: {document['before']['physical_cards']} → {document['after']['physical_cards']}; lands: {document['before']['front_face_lands']} → {document['after']['front_face_lands']}</p>",  # noqa: E501 - complete diagnostic or template literal
        f"<small>{esc(' · '.join(document['limitations']))}</small></html>",
    ]
    (run.root / "report.html").write_text("\n".join(parts), encoding="utf-8")
    run.seal("report")
    return {
        "report": str(run.root / "report.html"),
        "data": str(run.root / "report.json"),
    }


def lookup_cards(run, names):
    require(names, "Choose exact active card names")
    require(
        run.statuses()["data"] == "complete", "Import current full card records first"
    )
    cards = {card["name"]: card for card in run.load("card_data.json")}
    require(set(names) <= cards.keys(), "Card name is not active")
    entries = run.load("active_cards.json")
    return [
        {
            "entries": [row for row in entries if row["name"] == name],
            "card": packet_card(cards[name], compact=True),
        }
        for name in sorted(set(names))
    ]


def competitors(run, *, roles=(), names=()):
    require(roles or names, "Choose roles or exact active card names")
    require(set(roles) <= ROLES, "Unknown competitor role")
    require(
        run.statuses()["structure"] == "complete",
        "Aggregate current existing-card analyses first",
    )
    cards = {card["name"]: card for card in run.load("card_data.json")}
    require(set(names) <= cards.keys(), "Competitor name is not active")
    entries = {row["name"]: row for row in run.load("active_cards.json")}
    return [
        {
            "entry": entries[row["name"]],
            "card": packet_card(cards[row["name"]], compact=True),
            "evaluation": row,
        }
        for row in run.load("deck_card_analysis.json")
        if row["name"] in names or set(row["roles"]) & set(roles)
    ]


def next_operation(run, args):
    require(
        bool(args.packet) == bool(args.response), "Supply both --packet and --response"
    )
    require(
        not (args.response and args.complete),
        "Accept a response or complete a phase, one at a time",
    )
    if args.response:
        accepted = accept_batch(run, args.packet, args.response, partial=True)
        if accepted.get("errors"):
            return {"status": "repair", **accepted}
    if args.complete:
        complete(run, args.complete)
    advanced = []
    for _ in STAGES:
        status = run.status()
        stage = status["next"]
        if stage is None:
            if not advanced or advanced[-1] != "report":
                report(run)
            return {
                "status": "complete",
                "advanced": advanced,
                "report": str(run.root / "report.html"),
            }
        if stage in ("existing", "candidates"):
            result = packet(
                run, stage, args.size, compact=True, max_chars=args.max_chars
            )
            if result["count"]:
                return {
                    "status": "work",
                    "next": stage,
                    "read": status["read"],
                    "advanced": advanced,
                    **result,
                    "task": read(result["packet"]),
                }
            complete(run, stage)
        elif stage == "structure":
            aggregate(run)
        elif stage == "filter":
            candidate_filter(run)
        elif stage == "exclusions" and not run.request["external_exclusion_sources"]:
            if not (run.root / "external_blacklist.json").exists():
                run.save("external_blacklist.json", {"names": [], "sources": []})
            complete(run, stage)
        elif stage == "rules":
            questions = rules_questions(run)
            run.save("rules_review_queue.json", questions)
            if questions:
                return {
                    "status": "work",
                    "next": stage,
                    "read": status["read"],
                    "advanced": advanced,
                    "questions": questions,
                }
            run.save("rules_review.json", [])
            complete(run, stage)
        elif stage == "final":
            final_validation(run)
        elif stage == "report":
            report(run)
        elif stage == "review":
            return {
                "status": "work",
                "next": stage,
                "read": status["read"],
                "inputs": status["inputs"],
                "outputs": status["outputs"],
                "required_audits": {
                    "before_complete_review": [
                        "deck-research check-plan <run>",
                        "mana-audit <old> --compare <new> --bulk-data <bulk>",
                        "deck-stats <old> and deck-stats <new>",
                        "combo-search <new> --bulk-data <bulk>",
                        "proposal-check <old> --cuts <cuts.json> --adds <adds.json>",
                    ],
                    "note": (
                        "Build the old/new deck JSON with parse-deck from the run's "
                        "active cards plus the proposal before auditing. Resolve "
                        "every finding before next --complete review. Final "
                        "validation embeds the combo engine and records it in "
                        "swap_validation.json (combos key); a Spellbook outage is "
                        "recorded as degraded, never blocking."
                    ),
                },
                "advanced": advanced,
            }
        else:
            return {
                "status": "work",
                "next": stage,
                "read": status["read"],
                "inputs": status["inputs"],
                "outputs": status["outputs"],
                "advanced": advanced,
            }
        advanced.append(stage)
    raise ResearchError("Phase advancement did not converge")


def parser():
    root = argparse.ArgumentParser(
        description="Persistent Commander analysis: status selects the next evidence-gated phase"  # noqa: E501 - complete diagnostic or template literal
    )
    commands = root.add_subparsers(dest="command", required=True)
    for command in (
        "init",
        "update-request",
        "status",
        "ingest",
        "import-data",
        "packet",
        "accept-batch",
        "complete",
        "aggregate",
        "import-candidates",
        "filter",
        "rules-queue",
        "check-plan",
        "refresh-images",
        "validate",
        "report",
        "next",
        "competitors",
        "cards",
    ):
        sub = commands.add_parser(command)
        sub.add_argument("run", help="Absolute per-deck working directory")
        if command in ("init", "update-request"):
            sub.add_argument("--request", required=True)
        if command == "ingest":
            group = sub.add_mutually_exclusive_group()
            group.add_argument(
                "--payload",
                help="Saved full Archidekt response for offline/reproducible import",
            )
            group.add_argument(
                "--deck-json", help="Parsed deck from parse-deck/build workflow"
            )
        if command in ("import-data", "import-candidates"):
            sub.add_argument("--records", required=True)
            sub.add_argument(
                "--source",
                required=True,
                help="Actual source URL or bulk file identifier",
            )
            sub.add_argument(
                "--as-of",
                required=True,
                help="Source timestamp, not the time an old cache was copied",
            )
        if command == "import-candidates":
            sub.add_argument("--theme", required=True)
            sub.add_argument(
                "--exhausted",
                action="store_true",
                help="Search exhausted rather than truncated at a result limit",
            )
        if command == "packet":
            sub.add_argument(
                "--kind", required=True, choices=("existing", "candidates")
            )
            sub.add_argument("--size", default=8, type=int)
            sub.add_argument("--compact", action="store_true")
            sub.add_argument("--max-chars", type=int)
        if command == "next":
            sub.add_argument("--packet")
            sub.add_argument("--response")
            sub.add_argument("--complete", choices=tuple(STAGES))
            sub.add_argument("--size", default=8, type=int)
            sub.add_argument("--max-chars", default=24000, type=int)
        if command == "competitors":
            sub.add_argument("--roles", nargs="+", default=[])
            sub.add_argument("--names", nargs="+", default=[])
        if command == "cards":
            sub.add_argument("--names", nargs="+", required=True)
        if command == "refresh-images":
            group = sub.add_mutually_exclusive_group(required=True)
            group.add_argument(
                "--names", help="Comma-separated exact card names to refresh"
            )
            group.add_argument(
                "--all",
                action="store_true",
                help="Refresh every raw candidate without a valid image",
            )
        if command == "accept-batch":
            sub.add_argument("--packet", required=True)
            sub.add_argument("--response", required=True)
        if command == "complete":
            sub.add_argument("stage", choices=tuple(STAGES))
    return root


def execute(args):
    require(Path(args.run).is_absolute(), "Use an absolute run directory")
    if args.command == "init":
        return initialize(args.run, args.request)
    run = Run(args.run)
    if args.command == "next":
        return next_operation(run, args)
    if args.command == "competitors":
        return competitors(run, roles=args.roles, names=args.names)
    if args.command == "cards":
        return lookup_cards(run, args.names)
    if args.command == "update-request":
        run.save("request.json", normalize_request(read(args.request)))
        return Run(args.run).status()
    if args.command == "status":
        return run.status()
    if args.command == "ingest":
        return ingest(run, args)
    if args.command == "import-data":
        return import_data(run, args)
    if args.command == "packet":
        return packet(
            run, args.kind, args.size, compact=args.compact, max_chars=args.max_chars
        )
    if args.command == "accept-batch":
        return accept_batch(run, args.packet, args.response)
    if args.command == "complete":
        return complete(run, args.stage)
    if args.command == "aggregate":
        return aggregate(run)
    if args.command == "import-candidates":
        return import_candidates(run, args)
    if args.command == "filter":
        accepted, rejected = candidate_filter(run)
        return {"accepted": len(accepted), "rejected": len(rejected)}
    if args.command == "rules-queue":
        run.ready("rules")
        questions = rules_questions(run)
        run.save("rules_review_queue.json", questions)
        return {
            "questions": len(questions),
            "path": str(run.root / "rules_review_queue.json"),
        }
    if args.command == "check-plan":
        if not (run.root / "proposed_swaps.json").exists():
            return {
                "status": "FAIL",
                "findings": [
                    "check-plan needs the swaps stage: write proposed_swaps.json first"
                ],
            }
        findings = plan_gate_findings(run)
        return {"status": "PASS" if not findings else "FAIL", "findings": findings}
    if args.command == "refresh-images":
        raw = run.load("candidates_raw.json")
        if args.all:
            names = {
                item["card"]["name"]
                for item in raw
                if not valid_url(item["market"].get("image_url"))
            }
        else:
            names = {name.strip() for name in args.names.split(",") if name.strip()}
        return refresh_images(run, names)
    if args.command == "validate":
        result = final_validation(run)
        return {
            "status": result["status"],
            "cards": result["after"]["physical_cards"],
            "cost": result["additions_cost"],
        }
    return report(run)


def main():
    args = parser().parse_args()
    try:
        result = execute(args)
    except (ResearchError, OSError, KeyError, TypeError, ValueError) as error:
        print(
            json.dumps({"status": "BLOCKED", "reason": str(error)}, ensure_ascii=False),
            file=sys.stderr,
        )
        raise SystemExit(1) from error
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.command == "check-plan" and result.get("status") == "FAIL":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
