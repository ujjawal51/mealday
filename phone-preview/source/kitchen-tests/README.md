# Mealday kitchen validation

No physical cook tests have been submitted. Desk review, a complete macro estimate, a generated photo, a star rating and a user's cooking-history entry do not verify a recipe. The checked catalogue has 402 recipes; the earlier 375 count is stale.

## Run an actual test

1. Run `npm run audit:kitchen`. `coverage.json` lists every recipe, current version fingerprint, structural blockers and desk-review status. Resolve blockers before cooking. Start with recipes without desk review, then high-use dishes and recipes with soaking, fermentation or multiple components. This is a review order, not proof that any dish works.
2. Generate a blank record: `node phone-preview/scripts/audit-kitchen-tests.mjs --template RECIPE_ID > /tmp/mealday-cook.json`. Null fields are deliberately incomplete; do not submit invented measurements.
3. Open the current recipe in Mealday. Choose and record the household serving count. Follow the listed ingredient quantities, ingredient states and steps, using the available equipment. Record brand/ingredient substitutions and any added water, changed seasoning, skipped ingredient or changed technique in observations. If changes were needed for the dish to work, set `quantitiesWork` or `methodWorks` to false and correct the source recipe before retesting.
4. Weigh finished edible yield in grams and record the actual number of servings. Use a timer to measure preparation, cooking and additional waiting/resting/soaking separately, without double-counting parallel work. `timeWorks` records whether the advertised total allowed completion; explain actual and advertised times in observations. Record flavour, texture, doneness, portion adequacy and a subjective taste score from 1 to 5. Do not infer safe doneness from taste; follow the recipe's safety instructions.
5. Save original photos or a written measurement sheet from that actual cook under `evidence/`. Remove personal details before committing. Set `evidence` to the relative file path and compute `evidenceSha256` with `sha256sum` on that file. Evidence hashes check file integrity; they cannot establish that a person really cooked the dish. The responsible reviewer must check the submitted evidence and measurements.
6. Append the completed object to `records.json`; use a unique test ID, tester identifier and ISO cook timestamp. Run `npm run audit:kitchen` and `npm run test:kitchen`. A failed but correctly recorded test remains useful evidence. Never change a failure to a pass to obtain a badge.
7. Repeat on a separate cooking occasion. Two distinct successful records with distinct evidence, all three checks true and taste scores at least 3 are the minimum for this internal kitchen-tested status. This is a small reproducibility check, not professional certification or a guarantee of taste, food safety or nutrition. A later failed test returns the recipe to pending until two successful repeat tests follow.

## Recipe revisions

The fingerprint includes ingredient definitions and quantities, method, name, timing, equipment and quantity notes. Any change invalidates earlier tests for the current version. Historical evidence stays on record. Do not rewrite a historical fingerprint to make an old test match edited instructions.

The app explicitly displays kitchen testing pending and timing estimates. Personal ratings and notes remain private user feedback and never promote global recipe quality. A tested status in this audit is maintained by reviewed source records; the current app continues to show pending until a public evidence-backed status flow is introduced.

## Limits

Automated checks cover ingredient IDs, units, positive finite amounts, complete method structure and internally consistent time phases. They cannot determine seasoning, ingredient coverage in free-text methods, realistic heat settings, portion adequacy, actual duration or taste. Physical testing remains a launch blocker until genuine records are completed. Do not mark the P0 closed based on this audit alone.
