# Recipe nutrition

Recipe details calculate calories, protein, carbohydrate and fat per person from listed ingredient quantities. Household servings change shopping quantities, not per-person macros. These are **reference estimates**, not laboratory-verified dishes or claims about the user's actual products.

## Coverage and remaining work

The 2026-11-21 audit increases complete reference estimates from **159/402 to 360/402 (89.6%)**: 201 additional recipes, using 37 additional ingredient mappings (244/266 total IDs). **42 recipes remain incomplete, involving 22 ingredient IDs. This P0 is not fully closed.** `nutrition-coverage.json` lists every remaining ingredient, its blocking reason, and affected recipe IDs. Unknown values continue to return `totals: null`, never zero or a misleading subtotal.

Largest remaining groups: dried fenugreek leaves, ginger-garlic paste, dry mango powder, pure date syrup, drained canned black-eyed beans, and exact branded/regional preparations. Do not substitute fresh leaves for dried leaves, seeds for leaves, tapioca for sago, ordinary beef for camel, or an unmeasured bread piece for a known serving. Pure pomegranate molasses needs a measured ml-to-mass conversion; desalting fish requires species and post-soaking yield. Mixed salt/pepper and tamarind water need composition/dilution.

Research found conflicting dried-leaf values (some supplier tables resemble fresh leaves or fenugreek seeds), a ginger-garlic manufacturer table without a stated reference weight, liquid-label limits rather than exact numbers, and breads without measured piece sizes. Those did not justify silently setting missing nutrients to zero or guessing weights. A complete product label with all four macros and a reference weight/volume, or an explicitly specified recipe composition, is needed before marking these rows mapped.

## Sources

The audited canonical input is `nutrition-mapping.json`. Each new food includes its reference ID, source URL, retrieval date, reference quantities and assumptions. The deterministic browser copy is generated as `dist/nutrition-data.js`; its SHA-256 export identifies the exact mapping used in stored MongoDB nutrition snapshots.

- USDA FoodData Central SR Legacy (April 2018): energy 1008, protein 1003, carbohydrate by difference 1005, fat 1004, per 100 g edible portion. The original downloaded archive and checksum remain recorded under `source.legacyUSDA` (original retrieval 2026-11-18).
- ICMR–NIN Indian Food Composition Tables 2017, official PDF, Table 1: raw edible poha, ragi, chana dal, fresh curry/methi/radish leaves, ajwain, pointed gourd and jaggery. Record codes, raw values and the PDF checksum are retained. Energy is kJ / 4.184. Where reported, available carbohydrate plus total dietary fibre is used to approximate the USDA total-carbohydrate convention. Jaggery has no reported fibre and uses its reported carbohydrate.
- Public Health England CoFID 2021, official workbook: raw edible sea bream/sardines, raw bone-in loin lamb chops, and raw mussels with the published 0.32 edible proportion. Record codes and workbook checksum are retained. Do not apply a second bone deduction to the bone-in chop record.
- Named product labels: Amul paneer (Dudhsagar Dairy), Puck plain labneh, Essential garam masala and compounded asafoetida, Oatly No Sugars drink, Essential barley flakes, Bob's Red Mill dry TVP, Sadaf whole dried lime, Schwartz zaatar, Edlyn dry cracked freekeh and Al'Fez harissa paste. Norwegian Food Composition Table record 05.530 supplies dry millet flakes.

Product references are representative, not a promise that every brand or homemade version has those values. They do not change grocery products, ingredient labels, or allergen filters. For EU/Australian labels, fibre is added to label carbohydrate only when supplied. Otherwise the published carbohydrate is retained and the definition is recorded; carbohydrate values across sources are therefore not analytically identical. Energy is taken from the source, not reconstructed from macros. Label-rounded zeroes are preserved and explicitly distinguished from missing data. No `<` limit is silently converted to zero.

## Reference blends and portions

- Bzar: a reproducible 95 g reference blend adapted from the gram-based But First Chai recipe, with optional nutmeg and ginger omitted as permitted there. Cumin 15, coriander 10, fenugreek 24, fennel 15, black pepper 10, cinnamon 5, cardamom 5, red chilli 5 and turmeric 6 g. Component FDC IDs, weights and macros are stored. Turmeric is two USDA 3 g teaspoons; ground cinnamon/red pepper represent ground whole spices. This is a **calculated home-blend model**, not a verified retail bzar label. Different blends vary.
- Regag: one piece is modelled as one of the ten servings in Spinneys' plain regag recipe: 147 kcal, 4 g protein, 31 g carbohydrate, 1 g fat. It is represented directly as a source serving; no invented gram weight is introduced. Commercial pieces can differ.
- Whole dried lime: Sadaf's rounded label is 10 kcal, 0 g protein, 4 g carbohydrate, 0 g fat per lime (9 g). The whole measured lime is counted even when the method removes it; actual retained nutrients may be lower. This avoids inventing extraction yields or silently dropping the ingredient.
- Roti uses USDA commercially prepared whole-wheat roti with the published 43 g piece weight. It is not a flour-only estimate.
- Unspecified catalogue oil uses the same generic olive-oil reference/density as existing catalogue oil, with the assumption explicitly disclosed. All listed oil is counted.

The recipe UI links each actual source and shows its conversion and assumptions. Direct ml/serving references stay in their original units. Serving quantity, generic matches, moisture, discarded sauce and cooking losses can change results. Optional/unlisted additions and retention are not modelled.

## Build and validation

```
node phone-preview/scripts/build-nutrition.mjs
node phone-preview/scripts/audit-nutrition.mjs
node phone-preview/source/nutrition.test.mjs
npm run build:phone
```

`build:phone` regenerates and validates the browser mapping before bundling. CI runs the nutrition tests and `audit-nutrition.mjs --check` to reject stale coverage reports. Checks include gram/ml/source-serving scaling, raw versus cooked rice, paneer identity, shell yield, exact reference-blend summation, missing macros, invalid units, empty inputs and arithmetic overflow.

At server startup, matching owned catalogue documents receive updated **derived nutrition only**. The update requires exact ingredient IDs/amounts and definitions; source markers prevent personal recipe replacement. Recipe content, notes, user kitchens and edited ingredient lists are preserved. Mapping hashes make the refresh idempotent. The 18 legacy database recipes are outside the 402-item phone catalogue and audited separately by the import tests (420 documents total).
