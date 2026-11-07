# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Offline, synthetic transport/reuse measurements; no model-speed claims."""

import json
import subprocess
import sys
import tempfile
from argparse import Namespace
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "skills/games/deck-wizard"
sys.path.insert(0, str(PACKAGE / "tests"))

from test_research import NEW, make_run  # noqa: E402

from mtg_utils.research.cli import complete, import_candidates  # noqa: E402
from mtg_utils.research.evaluation import packet  # noqa: E402
from mtg_utils.research.selection import candidate_filter  # noqa: E402
from mtg_utils.research.storage import now, read, write  # noqa: E402
from mtg_utils.research.transport import expand_response  # noqa: E402

BASE = "ed964cdbc3616d99250a7984b05786ffc9ce7405"


def characters(value):
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def measure_response_transport():
    rows = read(ROOT / "verification/deck-wizard/model-smoke/deck_card_analysis.json")
    compact = []
    originals = []
    for index, row in enumerate(rows):
        original = {key: value for key, value in row.items() if key != "context_digest"}
        originals.append(original)
        result = deepcopy(original)
        result.pop("name")
        result.pop("oracle_hash")
        result["card"] = str(index + 1)
        previous = {}
        for state, value in list(result["states"].items()):
            match = next(
                (name for name, prior in previous.items() if value == prior), None
            )
            if match:
                result["states"][state] = {"same_as": match}
            else:
                previous[state] = value
        assert expand_response(result, original) == original
        compact.append(result)
    full_chars, compact_chars = characters(originals), characters(compact)
    return {
        "source": "preserved five-card synthetic model smoke output",
        "full_response_chars": full_chars,
        "compact_response_chars": compact_chars,
        "reduction_percent": round((1 - compact_chars / full_chars) * 100, 2),
        "round_trip_equal": True,
    }


def baseline(path):
    return subprocess.run(
        ["git", "show", f"{BASE}:{path}"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def measure_reuse():
    with tempfile.TemporaryDirectory(prefix="commander-efficiency-") as directory:
        run = make_run(Path(directory))
        path = run.root / "fresh.json"

        def refresh(records):
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
            result = packet(run, "candidates", 8, compact=True)
            return {
                "evaluations_required": result["remaining"],
                "evaluations_reused": result["reused"],
            }

        return {
            "market_refresh": refresh([deepcopy(NEW)]),
            "one_candidate_added": refresh(
                [
                    deepcopy(NEW),
                    {**NEW, "name": "Second Shield", "oracle_id": "second-shield"},
                ]
            ),
        }


def main():
    tooling = "skills/games/deck-wizard/references/tooling.md"
    before, after = (
        len(baseline(tooling).split()),
        len((ROOT / tooling).read_text().split()),
    )
    result = {
        "baseline_commit": BASE,
        "scope": (
            "offline deterministic measurements; "
            "no real-model latency or recommendation benchmark"
        ),
        "response_transport": measure_response_transport(),
        "interpretation_reuse": measure_reuse(),
        "setup_reference_words": {
            "before": before,
            "after": after,
            "reduction_percent": round((1 - after / before) * 100, 2),
        },
        "model_quality": "not-run",
        "model_wall_time": "not-run",
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
