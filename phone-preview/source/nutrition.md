# Recipe nutrition

Recipe detail pages calculate calories, protein, carbohydrate by difference and fat per person from listed recipe ingredient quantities. Household servings change the displayed ingredient shopping quantity, not these per-person values.

Data source: USDA FoodData Central SR Legacy, April 2018 release, downloaded 18 November 2026 from https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip. The source ZIP checksum is stored in nutrition-mapping.json. Nutrient IDs: energy 1008 (kcal), protein 1003 (g), carbohydrate 1005 (g), fat 1004 (g), each per 100 g edible portion.

`nutrition-mapping.json` is the audited source mapping, including food descriptions, exact FDC IDs, extracted macro values, unit conversions and explicit generic-match notes. Its compact browser version is `dist/nutrition-data.js`. Do not substitute similarly named foods without reviewing dry/cooked state, edible portion and composition. Ingredient reference data is sourced; recipe totals remain estimates, not laboratory-verified dishes.

Calculation: sum ingredient amount × grams per input unit × USDA per-100-g nutrient / 100, then round only at display. Gram quantities use factor 1. Eggs, pita, wraps and bread slices use named USDA edible portions. Lemon uses USDA lemon juice yield. Liquid densities use USDA household measure mass divided by US customary volume (tablespoon 14.78676478125 ml; cup 236.5882365 ml). Portion assumptions are disclosed on the recipe page.

All listed oil is included. Cooking losses, discarded sauce, nutrient retention and optional/unlisted ingredients are not modelled. Generic dairy, meat cuts and grain varieties are disclosed in source details; branded products can differ.

Coverage: 207 / 266 catalogue ingredient IDs mapped. 159 / 402 recipes have complete ingredient coverage. See nutrition-coverage.json for exact missing ingredients per recipe. The 243 incomplete recipes show unavailable totals, not a misleading subtotal or zero. Regional blends, product-specific breads/dairy, non-edible shell/bone weights, unidentified oils and unsupported foods require additional verified data. No substitutions such as cottage cheese for paneer or tapioca for sago are allowed.

To add coverage, obtain a complete official food record or manufacturer's product label, verify all four nutrient values and the reference weight/unit, preserve its URL and assumptions, and rerun the catalogue audit. Never infer missing nutrients from zero or invent a recipe total.

Validation: `node source/nutrition.test.mjs`. Checks complete catalogue coverage, numeric values, raw/cooked rice distinctions, USDA egg and oil conversions, and refusal of unknown IDs, missing nutrients, unit mismatches or invalid quantities.
