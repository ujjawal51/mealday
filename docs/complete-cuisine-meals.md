# Complete cuisine-based meal suggestions

Lunch/dinner suggestions use a main, a starch component, a protein component and a vegetable component. These are menu-assembly checks, not a claim of nutritional adequacy or physical kitchen testing. Breakfast-only recipes keep their original preparation.

- South Asian: ready-to-eat roti for missing starch; red lentil dal when a protein component is missing. Legacy Arabic-bread pairings use measured roti instead.
- Emirati: rice, with regag for thareed; existing pita pairings use regag. A missing protein component can use a quick dango-inspired chickpea side. This explicitly says inspired, not an authenticated traditional preparation.
- Arab: Arabic pita when starch is missing, with cumin chickpeas when protein is missing.
- Turkish/UAE mix: rice and a chickpea side when those components are missing.
- Add 80 g cucumber per person only when the recipe lacks an existing vegetable component. Never add duplicate rice/bread to an already complete dish. A cereal staple threshold is 25 g, or one bread piece; the vegetable component check is 80 g. Besan/gram flour is not treated as a cereal staple.

Each added component has real ingredient quantities, ready-made bread instructions or cooking steps and conservative total elapsed time. Household scaling, shopping packs, estimated cost, nutrition, time, equipment, diets, allergies and styles use the complete combination. If required ingredient definitions are unavailable, a partial meal is withheld from lunch/dinner planning instead of inventing packs/prices.

`prepareCompleteMeals` is shared by the live MongoDB public catalogue and the offline/client API. Public metadata preserves component names and assembly version. Source records are never overwritten, IDs remain stable, and public snapshots/revisions reflect the prepared view. Exact identifiable Mealday v1 sides can be adapted; modified source instructions are preserved. Edited v2 contents are rechecked rather than trusting stale complete flags.

Plan cards and opened recipes list the included components. Photos remain labelled as main-dish illustrations. Calculated macros remain estimates; missing nutrition references remain visible.

Cultural context used for the pairing policy:
- Visit Dubai describes dango as spiced chickpeas and regag as thin crispy bread: https://www.visitdubai.com/en/articles/emirati-food-in-dubai
- Dubai government describes machboos as spiced rice with meat or fish and lists local breads: https://www.dubai.ae/web/dubai.ae/living/sports-culture/food-in-dubai

Validation includes cuisine-specific assembly, idempotence, no duplicate staples, source immutability, live metadata roundtrip, per-household grocery quantities, and rejection when added bread/time/cost violates selected filters. Mobile tests rebuild Desi, Emirati and Arab plans through the live catalogue and check components, recipes and groceries.
