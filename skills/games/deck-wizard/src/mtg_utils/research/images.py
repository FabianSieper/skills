# Copyright (c) 2026. SPDX-License-Identifier: 0BSD
"""Verified Scryfall image completion for raw candidate market records.

MTGJSON bulk records carry no ``image_uris`` and the ``scryfall-lookup``
record shape strips them, so market records imported from those sources lack
the ``image_url`` the final validation requires for every swap addition when
``output.images`` is set. This module fetches the raw Scryfall API record per
printing, verifies the image URL over HTTP, and patches the market records in
``candidates_raw.json`` — then re-seals discovery and re-runs the
deterministic filter so every downstream receipt stays valid.
"""

from __future__ import annotations

import time

import requests

from .cards import valid_url
from .selection import candidate_filter
from .storage import ResearchError, Run, now, require

SCRYFALL_API = "https://api.scryfall.com/cards/"
# The raw Scryfall API rejects requests without both headers (HTTP 400).
SCRYFALL_HEADERS = {
    "User-Agent": "deck-wizard research run",
    "Accept": "application/json",
}
# api.scryfall.com allows roughly one request per second.
API_SPACING_SECONDS = 1.0
_throttle_state = {"last_api_call": 0.0}


def _throttle():
    wait = API_SPACING_SECONDS - (time.monotonic() - _throttle_state["last_api_call"])
    if wait > 0:
        time.sleep(wait)
    _throttle_state["last_api_call"] = time.monotonic()


def _verify_image(url):
    """Return (ok, detail) for an image URL; HEAD with a streamed GET fallback."""
    try:
        response = requests.head(
            url, headers=SCRYFALL_HEADERS, timeout=30, allow_redirects=True
        )
        if response.status_code == 405:
            response = requests.get(
                url, headers=SCRYFALL_HEADERS, timeout=30, stream=True
            )
            response.close()
        content_type = str(response.headers.get("Content-Type", ""))
        detail = f"HTTP {response.status_code} {content_type or 'no content type'}"
        return response.status_code == 200 and content_type.startswith("image/"), detail
    except requests.RequestException as error:
        return False, str(error)


def fetch_verified_image(market):
    """Return (image_url, source_note) for a market record, verified over HTTP.

    Raises ResearchError when the record has no scryfall id, the API is
    unreachable, the printing has no image, or the image URL fails the
    200/image-* check.
    """
    require(
        market.get("scryfall_url"),
        f"Market record has no scryfall_url: {market['name']}",
    )
    card_id = market["scryfall_url"].rsplit("/", 1)[-1]
    _throttle()
    try:
        response = requests.get(
            SCRYFALL_API + card_id, headers=SCRYFALL_HEADERS, timeout=30
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError) as error:
        raise ResearchError(
            f"Scryfall API unavailable for {market['name']}: {error}"
        ) from error
    uris = data.get("image_uris") or {}
    image = uris.get("normal") or uris.get("large")
    require(image, f"Scryfall record has no image for {market['name']}")
    ok, detail = _verify_image(image)
    require(ok, f"Image URL failed verification for {market['name']}: {detail}")
    note = f"; scryfall image refresh {now()} (api.scryfall.com, verified 200 image/*)"
    return image, note


def refresh_images(run: Run, names) -> dict:
    """Fill missing ``image_url`` values for named raw candidate records.

    Only records that currently lack a valid HTTPS image are touched; a
    request whose records all carry images is a non-mutating no-op. When
    something changes, discovery is re-sealed and the deterministic filter
    re-run so the run's receipts stay consistent.
    """
    raw = run.load("candidates_raw.json")
    names = set(names)
    require(names, "Name at least one card or use --all")
    present = {}
    missing = []
    for item in raw:
        name = item["card"]["name"]
        if name not in names:
            continue
        if valid_url(item["market"].get("image_url")):
            present[name] = present.get(name, 0) + 1
        else:
            missing.append(item)
    total = dict.fromkeys(names, 0)
    for item in raw:
        if item["card"]["name"] in names:
            total[item["card"]["name"]] += 1
    already = sorted(
        name
        for name in names
        if total.get(name, 0) > 0 and total[name] == present.get(name, 0)
    )
    not_found = sorted(name for name in names if total.get(name, 0) == 0)
    if not missing:
        return {
            "requested": sorted(names),
            "updated": [],
            "already_present": already,
            "not_found": not_found,
            "failed": {},
        }
    updated, failed = set(), {}
    for item in missing:
        market = item["market"]
        try:
            image, note = fetch_verified_image(market)
        except ResearchError as error:
            failed.setdefault(market["name"], []).append(str(error))
            continue
        market["image_url"] = image
        if note not in market.get("source", ""):
            market["source"] = f"{market.get('source') or 'unknown source'}{note}"
        updated.add(market["name"])
    if updated:
        run.save("candidates_raw.json", raw)
        run.seal("discovery")
        candidate_filter(run, persist=True)
    return {
        "requested": sorted(names),
        "updated": sorted(updated),
        "already_present": already,
        "not_found": not_found,
        "failed": failed,
    }
