# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Artifact storage and dependency-aware receipts for a research run."""

from __future__ import annotations

import hashlib
import json
import tempfile
from datetime import UTC, datetime
from pathlib import Path


class ResearchError(ValueError):
    """An incomplete or inconsistent artifact that requires a concrete repair."""


def read(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise ResearchError(f"Cannot read JSON {path}: {error}") from error


def write(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", dir=path.parent, prefix=".research-", delete=False
    ) as handle:
        temporary = Path(handle.name)
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write("\n")
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def digest(value):
    encoded = json.dumps(
        value,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def now():
    return datetime.now(UTC).isoformat()


def age_hours(timestamp):
    try:
        value = datetime.fromisoformat(timestamp)
    except (AttributeError, TypeError, ValueError) as error:
        raise ResearchError(f"Invalid data timestamp: {timestamp!r}") from error
    require(value.tzinfo is not None, "Timestamp needs timezone")
    hours = (datetime.now(UTC) - value).total_seconds() / 3600
    require(hours >= -0.1, "Timestamp is in the future")
    return hours


def require(condition, message):
    if not condition:
        raise ResearchError(message)


def nonempty(value, label):
    require(isinstance(value, str) and bool(value.strip()), f"Missing {label}")


# Each stage reads only its declared inputs. Market refreshes therefore do not
# change the interpretation stages' fingerprints when Oracle text is unchanged.
INTERPRETATION_KEYS = [
    "goals",
    "avoid",
    "preferences",
    "power_level",
    "meta",
    "variant",
    "protected_cards",
]

STAGES = {
    "ingest": (
        [],
        [],
        ["deck_source", "format", "excluded_categories", "excluded_cards"],
        [
            "deck_raw.json",
            "deck.json",
            "active_cards.json",
            "excluded_cards.json",
            "unresolved_cards.json",
            "deck_validation.json",
        ],
    ),
    "data": (
        ["ingest"],
        ["active_cards.json"],
        [],
        ["card_data.json", "market_data.json", "auxiliary_data.json"],
    ),
    "exclusions": (
        ["data"],
        [],
        ["external_exclusion_sources", "rejected_cards"],
        ["external_blacklist.json"],
    ),
    "understanding": (
        ["data", "exclusions"],
        ["deck.json", "card_data.json"],
        [
            "goals",
            "avoid",
            "preferences",
            "power_level",
            "meta",
            "variant",
            "protected_cards",
        ],
        ["commander_model.json"],
    ),
    "existing": (
        ["understanding"],
        ["active_cards.json", "card_data.json", "commander_model.json"],
        INTERPRETATION_KEYS,
        ["deck_card_analysis.json"],
    ),
    "structure": (
        ["existing"],
        ["active_cards.json", "card_data.json", "deck_card_analysis.json"],
        [],
        ["deck_role_summary.json", "role_groups.json"],
    ),
    "diagnosis": (
        ["structure"],
        ["deck_role_summary.json", "role_groups.json", "commander_model.json"],
        ["goals", "avoid", "preferences", "protected_cards"],
        ["diagnosis.json", "cut_pool.json"],
    ),
    "search": (
        ["diagnosis"],
        ["diagnosis.json", "commander_model.json"],
        ["goals", "avoid", "preferences"],
        ["search_plan.json"],
    ),
    "discovery": (
        ["search"],
        ["search_plan.json"],
        [],
        ["candidates_raw.json", "search_log.json"],
    ),
    "filter": (
        ["discovery", "exclusions"],
        [
            "candidates_raw.json",
            "card_data.json",
            "active_cards.json",
            "external_blacklist.json",
            "market_data.json",
        ],
        ["budget", "freshness", "rejected_cards"],
        ["candidates_filtered.json", "candidate_rejections.json"],
    ),
    "candidates": (
        ["filter"],
        [
            "candidates_filtered.json",
            "commander_model.json",
            "diagnosis.json",
            "deck_role_summary.json",
            "deck_card_analysis.json",
        ],
        INTERPRETATION_KEYS,
        ["candidate_analysis.json"],
    ),
    "rules": (
        ["candidates"],
        ["candidate_analysis.json", "deck_card_analysis.json", "commander_model.json"],
        [],
        ["rules_review_queue.json", "rules_review.json"],
    ),
    "swaps": (
        ["rules"],
        [
            "candidate_analysis.json",
            "rules_review.json",
            "cut_pool.json",
            "diagnosis.json",
            "deck_card_analysis.json",
            "card_data.json",
            "active_cards.json",
        ],
        [
            "recommendation_count",
            "max_swaps",
            "protected_cards",
            "retire_roles",
            "budget",
        ],
        ["proposed_swaps.json"],
    ),
    "review": (
        ["swaps"],
        [
            "proposed_swaps.json",
            "commander_model.json",
            "deck_card_analysis.json",
            "candidate_analysis.json",
            "rules_review.json",
        ],
        [],
        ["strategic_review.json"],
    ),
    "final": (
        ["review", "filter"],
        [
            "proposed_swaps.json",
            "strategic_review.json",
            "auxiliary_data.json",
            "diagnosis.json",
            "active_cards.json",
            "card_data.json",
            "deck_card_analysis.json",
            "candidates_filtered.json",
            "candidate_analysis.json",
            "rules_review.json",
            "market_data.json",
            "external_blacklist.json",
        ],
        [
            "budget",
            "freshness",
            "recommendation_count",
            "max_swaps",
            "protected_cards",
            "retire_roles",
        ],
        ["new-deck.json", "swap_validation.json", "final_recommendations.json"],
    ),
    "report": (
        ["final"],
        ["final_recommendations.json", "swap_validation.json", "diagnosis.json"],
        ["output"],
        ["report.json"],
    ),
}

REFERENCES = {
    "ingest": "acquisition.md",
    "data": "acquisition.md",
    "exclusions": "acquisition.md",
    "understanding": "understanding.md",
    "existing": "existing-card-evaluation.md",
    "structure": "diagnosis.md",
    "diagnosis": "diagnosis.md",
    "search": "candidate-evaluation.md",
    "discovery": "candidate-evaluation.md",
    "filter": "candidate-evaluation.md",
    "candidates": "candidate-evaluation.md",
    "rules": "commander-rules-workflow.md",
    "swaps": "swaps-and-review.md",
    "review": "swaps-and-review.md",
    "final": "output-format.md",
    "report": "output-format.md",
}


class Run:
    def __init__(self, directory):
        self.root = Path(directory).resolve()
        self.request = read(self.root / "request.json")
        self.state = read(self.root / "run_state.json")
        require(self.state.get("schema_version") == 1, "Unsupported run_state schema")

    def load(self, filename):
        return read(self.root / filename)

    def save(self, filename, value):
        write(self.root / filename, value)

    def input_digest(self, stage, *, exclude=()):
        _, files, keys, _ = STAGES[stage]
        values = {}
        for name in files:
            if name in exclude:
                continue
            value = self.load(name)
            if name == "active_cards.json":
                value = sorted(value, key=lambda row: (row["zone"], row["name"]))
            elif name == "deck.json":
                value = dict(value)
                for zone in (
                    "commanders",
                    "cards",
                    "sideboard",
                    "owned_cards",
                    "companion",
                ):
                    if isinstance(value.get(zone), list):
                        value[zone] = sorted(value[zone], key=lambda row: row["name"])
            elif name == "card_data.json" or (
                stage == "candidates" and name == "candidates_filtered.json"
            ):
                cards = (
                    [item["card"] for item in value]
                    if name == "candidates_filtered.json"
                    else value
                )
                value = sorted(
                    [
                        {"name": c["name"], "oracle_hash": c["oracle_hash"]}
                        for c in cards
                    ],
                    key=lambda c: c["name"],
                )
            values[name] = value
        return digest(
            {
                "contract_version": 2,
                "files": values,
                "request": {key: self.request.get(key) for key in keys},
            }
        )

    def statuses(self):
        statuses = {}
        for stage, (dependencies, _, _, outputs) in STAGES.items():
            receipt = self.state.get("stages", {}).get(stage)
            if any(statuses[dep] != "complete" for dep in dependencies):
                statuses[stage] = "waiting"
                continue
            if not receipt:
                statuses[stage] = "pending"
                continue
            try:
                valid = receipt["inputs"] == self.input_digest(stage)
                valid = valid and receipt["outputs"] == {
                    name: digest(self.load(name)) for name in outputs
                }
            except (ResearchError, KeyError, TypeError, ValueError):
                valid = False
            statuses[stage] = "complete" if valid else "stale"
        return statuses

    def ready(self, stage):
        require(stage in STAGES, f"Unknown stage {stage}")
        statuses = self.statuses()
        missing = [dep for dep in STAGES[stage][0] if statuses[dep] != "complete"]
        require(not missing, f"{stage} requires completed stages: {', '.join(missing)}")

    def seal(self, stage):
        self.ready(stage)
        outputs = STAGES[stage][3]
        self.state.setdefault("stages", {})[stage] = {
            "inputs": self.input_digest(stage),
            "outputs": {name: digest(self.load(name)) for name in outputs},
            "completed_at": now(),
        }
        self.save("run_state.json", self.state)

    def status(self):
        statuses = self.statuses()
        next_stage = next(
            (stage for stage in STAGES if statuses[stage] != "complete"), None
        )
        return {
            "run": str(self.root),
            "stages": statuses,
            "next": next_stage,
            "read": f"references/{REFERENCES[next_stage]}" if next_stage else None,
            "inputs": STAGES[next_stage][1] if next_stage else [],
            "outputs": STAGES[next_stage][3] if next_stage else [],
            "external_write": "separate; only when requested and after current final PASS",  # noqa: E501 - complete diagnostic or template literal
        }
