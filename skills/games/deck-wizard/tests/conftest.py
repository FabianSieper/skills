# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Keep the research test-suite hermetic: the combo engine is a network
dependency, so final validation always sees a deterministic stub unless a
test overrides it."""

from __future__ import annotations

import pytest

from mtg_utils.research import selection


@pytest.fixture(autouse=True)
def _stub_combo_engine(monkeypatch):
    monkeypatch.setattr(
        selection,
        "combo_search",
        lambda _hydrated, **_kwargs: {
            "combos": [],
            "near_misses": [],
            "api_unavailable": False,
        },
    )
