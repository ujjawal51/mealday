# Recipe filter and image audit

Recipe-related preferences apply to Plan, Rebuild, Quote, Swap and personalized ranking. No feasible match returns an explicit error and preserves the saved plan.

| Input | Applied behavior |
| --- | --- |
| Diet | Ingredient kinds plus recipe category; includes eggless vegetarian |
| Ingredient exclusions | Declared allergens and dairy/egg/fish/shellfish kind guards |
| Cuisine | Selected cuisine(s); UAE mix explicitly permits all cuisines |
| Cooking time | Whole-meal elapsed time including added components |
| Appliances | Required preparation equipment; a raw cucumber side does not require Hob |
| Meal styles | Any selected style plus all other constraints; Fresh/Protein need complete nutrition |
| Days and meals | Exact selected day/meal slots with distinct dish families |
| Servings | Scale every ingredient and component |
| Budget | Whole-pack estimated grocery cost must fit |
| Pantry | Deduct canonical amounts before pack calculations |
| City/store | Shopping context validation and retailer lookup selection, without invented inventory/prices |
| Profile/acquisition questions | Onboarding context, not inferred medical or nutrient requirements |

Cereal/all-purpose flour already supplies the staple for a paratha. Substantial potato mains outside South Asian cuisine do not need extra rice. Starchy potatoes do not also fulfill the separate vegetable component. Duplicate ingredient IDs are combined without losing total quantities. `required` is the full household quantity; `need` is the remainder after pantry deductions.

## Images

18 previously missing meals now have individual AI-generated illustrations at `phone-preview/dist/recipes/<id>.webp`. Existing 402 images remain intact. The source manifest records final paths, dimensions, byte counts and SHA-256 hashes. Shared generation prompt: square editorial food illustration, realistic home cooking, off-white ceramic on pale warm stone, soft daylight; actual recipe ingredients only; no text, branding, watermark, or unlisted garnish. The dish-specific subjects are the recipe IDs/names, with final sides shown where present. The final air-potato image includes cucumber and no extra rice.

The public catalogue replaces only absent/known placeholder paths, preserves custom photos, and never rewrites source MongoDB documents. Old saved meals can use the established filename convention. Generated illustrations are identified on the opened recipe screen. The eager client no longer carries the entire photo map.

Checks cover all 420 assets including 174 South Asian recipes, all 18 new hashes, placeholder resolution, custom photo preservation, omitted allergen tags, cereal/potato/cold-side equipment regressions, pantry and household budgeting, and the full existing filter matrix. Browser tests open every newly illustrated meal through a live catalogue fixture. Deployment checks verify the 18 published file hashes and absence of placeholder paths. Physical cooking tests, laboratory nutrition validation and verified retailer prices remain separate.
