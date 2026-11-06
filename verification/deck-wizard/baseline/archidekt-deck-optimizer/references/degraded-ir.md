# Manual audit when deck-wizard's card IR is degraded

Symptoms (verbatim from the tools):

```
crosswalk Card IR sidecar unavailable (389 crosswalk signal lanes degraded).
card-data download failed; re-run `build-card-ir-crosswalk` with network access.
```

`deck-tune`, `deck-signals`, `cut-check` and the colour half of `mana-audit` then return
empty or zero fields: `focus.engine_pool: 0`, `template.card_draw: 0`, `swaps: []`,
all cut flags `false`, `color_sources` falling back to the type line. Those are **missing
data, not verdicts**. Record them as blocked and compute the structural numbers yourself.

## What to compute by hand

1. **Pip demand per colour.** Sum the coloured symbols in every nonland mana cost, using
   the front face for split cards. Compare against how many lands *can* produce each
   colour, not how many basic lands of that colour are printed.
2. **Land band.** For a 100-card commander deck the usual band is 35–37 lands; check the
   count of lands able to produce each required colour separately.
3. **Curve and top end.** Count nonlands per mana value; a deck whose only cards above 4
   mana are one or two cards cannot play its late-game cards.
4. **Body quality.** Count creatures with power 0 or 1 — in a copy or pump deck this is
   where the attack power comes from elsewhere.
5. **Answer inventory.** Search the oracle texts for `destroy target`, `exile target`,
   `Destroy all creatures`, `Return target`. If there is no match, the deck has no answers
   and that is the headline finding.

## Worked example

```bash
# oracle text of every nonland, one line per card
python3 - <<'EOF'
import json
deck = json.load(open("/work/deck.json"))
side = json.load(open("/work/deck.hydrated.json"))
by_name = {r["name"]: r for r in side["records"]}
for card in deck["commanders"] + deck["cards"]:
    r = by_name[card["name"]]
    if "Land" in r["type_line"]:
        continue
    faces = r.get("card_faces") or []
    text = r.get("oracle_text") or " // ".join(f.get("oracle_text", "") for f in faces)
    print(f"== {r['name']} [{r.get('mana_cost','')}] {r['type_line']} P/T {r.get('power')}/{r.get('toughness')}")
    print(text)
EOF

# answers inventory — grep -i, oracle text mixes "Destroy target" and "destroy target"
grep -ic "destroy target" /work/oracle_dump.txt   # 0 -> no targeted removal
grep -ic "exile target" /work/oracle_dump.txt
grep -ic "counter target" /work/oracle_dump.txt
```

Interpretation rule: report the numbers you computed and name the tool that could not
produce them. A finding such as "no removal in the deck" is only trustworthy if it came
from a grep over the deck's own oracle texts, not from an empty `cut-check` result.
