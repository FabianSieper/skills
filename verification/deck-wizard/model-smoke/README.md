# Small-model packet smoke test

Model: GPT-6 Luna (`gpt-6-luna`), reasoning effort high. Date: 2026-11-06.
The independent agent received the installed skill references and local file paths,
then used the packet / accept-batch / complete workflow on one synthetic run.

This is deliberately artificial: five distinct entries, 100 physical cards,
including 96 Islands. Card records and example.org links are test fixtures, not
verified real card facts or a playable deck recommendation.

Observed results:
- All five existing-card evaluations were accepted and the existing phase completed.
- The first response had a mistyped Island Oracle hash. The gate rejected it;
  the agent corrected it. The final tool now emits response templates with exact
  identities, hashes and clause keys to avoid manual copying.
- It distinguished activated draw from ETB draw, recognized that Core pays the
  acquired tap cost, and raised the summoning-sickness question.
- It distinguished Silent Sentinel's activated protection from its ETB trigger.
- It accounted for Library Robe's equip cost and both protection and stats.
- It identified the excessive land quantity instead of treating the fixture as good.

The saved packet preserves the original execution paths and pre-template payload;
`deck_card_analysis.json` is the accepted model output. The source records make
this evidence inspectable. This test does not establish performance over real decks,
prove every rules claim or compare baseline and candidate models statistically.
