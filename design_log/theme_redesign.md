# Theme Redesign — Alien Collector Exhibition

## Concept
Player is an exotic alien collector competing in a judged exhibition against rival collectors. No combat — score = collection appraisal value / ranking. Creatures are deliberately ugly/strange aliens played with complete sincerity. Ironic beauty pageant energy.

## Species (= alien biology type)
| New Name | Old Name | Vibe |
|----------|----------|------|
| Plasmic | Warrior | Liquid/gas beings, no fixed shape |
| Sporal | Mage | Fungal, bioluminescent, releases clouds |
| Chitinous | Hunter | Insectoid, too many limbs, clicking |
| Crystalline | Beast | Mineral-based, ancient, faintly hum |
| Abyssal | Demon | Deep-space adapted, wrong number of eyes |

## Classes (= dominant emotion)
| New Name | Old Name | Synergy effect |
|----------|----------|----------------|
| Shy | Knight | flat/class (+8/+16) |
| Livid | Assassin | mult/class (×1.12/×1.28) |
| Giddy | Ranger | flat/class (+6/+14) |
| Sullen | Priest | mult/all (×1.02/×1.05) |
| Pompous | Berserker | mult/class (×1.13/×1.30) |

## Creature Names (to fill in)
20 aliens across 5 species, 3 tiers. Names should be funny, alien-sounding, and feel like a creature someone would actually collect.

### Plasmic (was Warrior — 5 cards: 2×T1, 2×T2, 1×T3)
- T1: Blorpax, Slurvin
- T2: Gloopir, Murborg
- T3: Fluxnob

### Sporal (was Mage — 4 cards: 1×T1, 2×T2, 1×T3)
- T1: Sporvik
- T2: Puffzak, Molborg
- T3: Sprangus

### Chitinous (was Hunter — 4 cards: 2×T1, 1×T2, 1×T3)
- T1: Skraxle, Vexborg
- T2: Clattorb
- T3: Scrithnab

### Crystalline (was Beast — 4 cards: 2×T1, 1×T2, 1×T3)
- T1: Krombax, Sharzak
- T2: Lithvorn
- T3: Geodorb

### Abyssal (was Demon — 3 cards: 1×T1, 1×T2, 1×T3)
- T1: Vorzak
- T2: Blinxorp
- T3: Squorble

## System Renames
- Items → Accessories (attached to/detached from aliens)
- Augments → Collector Upgrades (keep mechanical structure)
- Score label → Appraisal / Exhibition Points
- Opponents → Rival Collectors
- Combine 3 → Rare Specimen (upgraded tier)

## Next action — Item & Augment Rename

Cards/species/classes are done. Remaining: rename items and augments to fit the alien collector theme.

### Items (src/items.js — ITEM_DEFS)
Currently LoL-named combat gear. Should feel like *accessories a collector attaches to an alien specimen*. The mechanic (axis effect) stays identical — only names and descriptions change.

| Current name | Axis | Mechanical effect | Rename direction |
|---|---|---|---|
| Claymore | 1 | +40 base score | Display stand / exhibition prop |
| Recurve Bow | 3-mod | doubles per-round scaling | Growth serum / nurture tonic |
| Giant's Belt | 4 | ×2/1.5/1.2 by star tier | Rarity certificate / authenticity tag |
| Warmog's Armor | 2-mod | doubles conditional flat bonus | Stimulant pod / behavior enhancer |
| Zeke's Herald | 8 | +15% score to all others | Pheromone diffuser / presence emitter |
| Hextech Gunblade | 7 | +2g per round | Auction listing / market tag |
| Last Whisper | 6-mod | round-timing triggers 2 rounds early | Early bloom serum / stimulant drip |
| Guinsoo's Rageblade | 3 | +20/round on board | Acclimatisation log / familiarity tag |
| Spear of Shojin | 5 | counts as random species each round | Camouflage gland / mimic tag |
| Emblem of [Species] | 5 | +1 to named species count | Species certification / taxonomy badge |
| Crest of [Class] | 5-class | +1 to named class count | Mood tag / emotional registry |

### Augments (src/augments.js — AUGMENT_DEFS)
Currently combat-framed (Heroic Resolve, Iron Will, etc.). Should feel like *collector perks, research upgrades, or exhibition strategies*.

| Current id | Current name | Axis | Rename direction |
|---|---|---|---|
| HeroicResolve | Heroic Resolve | 1 | Something like "Premium Enclosure" or "Prestige Display" |
| IronWill | Iron Will | 2 | "Conditioning Protocol" or "Behavioral Study" |
| TimeDilation | Time Dilation | 3 | "Long-Term Residency" or "Acclimatisation Program" |
| ExponentialGrowth | Exponential Growth | 4 | Keep or rename to "Rapid Development" |
| Shapeshifter | Shapeshifter | 5 | "Species Reclassification" or "Taxonomy Override" |
| EarlyBird | Early Bird | 6 | "Pre-Show Conditioning" or "Early Bloomer" |
| MidasTouch | Midas Touch | 7 | "Market Savant" or "Auction Insider" |
| HiveMind | Hive Mind | 5/8 | "Collective Resonance" or "Swarm Instinct" |
| Overflow | Overflow | structural | "Extended Enclosure" or "Expanded Collection" |
| Tycoon | Tycoon | economy | Keep or "Collector's Eye" |
| Varietal | Varietal | diversity | "Diverse Portfolio" or keep |
| CrossTraining | Cross-Training | diversity | "Cross-Pollination" or "Emotional Overlap" |

### Files to update
- `src/items.js` — ITEM_DEFS names, descriptions, and generated Emblem/Crest strings
- `src/augments.js` — AUGMENT_DEFS names and descriptions
- `web/app.js` — any hardcoded item/augment name strings (itemAbbrev, tooltips)
- `src/sim.js` — augment id strings like 'HeroicResolve', 'IronWill' etc. if ids change (safe to keep internal ids stable and only rename display names)

**Note:** Keep augment/item *ids* (e.g. `HeroicResolve`) stable in the code — only rename `name` and `description` display fields. This avoids touching the many id-based lookups throughout sim.js, game.js, board.js.
