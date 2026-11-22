# Central published recipe catalogue

The Render app reads MongoDB `recipes` through `GET /api/catalogue` before each recipe operation. That validated snapshot supplies library search, saved-recipe lookups, details, meal generation, substitutions and grocery quotes. The planner still runs on the device, using live data. A database edit requires no frontend rebuild, GitHub push or Render restart.

## Public endpoints

- `GET /api/catalogue`: schemaVersion 1, content revision, published recipes and their public ingredient definitions. ETag / If-None-Match returns 304 when content has not changed. There is no server cache of catalogue content.
- `GET /api/recipes?q=...&cuisine=...&diet=...&offset=0`: public summaries, 18 per page, count and next offset.
- `GET /api/recipe/RECIPE_ID`: current public recipe detail; unpublished/deleted recipes return 404.

These endpoints are read-only. No anonymous recipe write route is exposed. Database credentials remain on Render; private account information and arbitrary document properties are never sent. Direct database editing must use an authorized Atlas account. An editor dashboard is a separate feature.

## Publish and edit

Existing records have canonical cooking fields under `data`; top-level `name` and `cuisine` are import mirrors. Edit `data.name`, `data.items`, `data.steps`, `data.time`, `data.mealTypes`, `data.appliances`, `data.diet` and `data.cuisine`. Keep `id` and `data.id` identical and stable so favourites, history, ratings and notes continue to reference the same recipe.

`data.items` is an array of `[ingredientId, amountPerPerson]`, with positive quantities. `ingredients[ingredientId]` must include name, unit, positive pack size, nonnegative price, category, kind and known allergens. Shared ingredient IDs must use consistent definitions across recipes; update shared definitions together or use a new ingredient ID for a different product. Mismatches fail closed and show an offline notice, rather than silently applying the wrong identity to another recipe. Nutrition references require review after ingredient identity or unit changes; missing references do not become zeros.

For timings, either omit `data.timing` and use total elapsed `data.time`, or supply nonnegative integer prepMinutes, cookMinutes and waitMinutes whose sum equals data.time. Total time must be 1–1440 minutes. Times remain estimates. Meal types: breakfast, lunch, dinner; appliances: Hob, Oven, Microwave, Air fryer. Allowed diets: vegan, vegetarian, fish, meat. Cuisines: Emirati, Arab, South Asian, Turkish, UAE mix. A method needs at least two nonempty steps. `data.imageUrl` supports a local static path or HTTPS image URL; missing or unsafe URLs use a neutral placeholder.

Set `published:true` and use a non-draft reviewStatus to publish. Invalid records are withheld and counted in server logs. Set `published:false` to hide a recipe. Empty published catalogues stay empty; the app does not silently restore bundled recipes in online mode. Hard deletion also removes the record. Startup seeds only a new empty installation, records an initial-import marker and preserves subsequent deletions. The explicit `recipes:import` maintenance command can intentionally restore missing baseline records; do not run it to publish normal edits.

## When users see changes

Changes appear on the next library load/search, recipe opening, plan, swap or quote. Returning focus to the recipe library revalidates it. There is no background push stream: a recipe already open on screen keeps its displayed instructions until reopened or refreshed. A changed recipe uses its stable ID; private notes, ratings and cook events are untouched. Saved summaries refresh when their list opens, and unavailable references remain saved with a disabled label. Previously saved plan summaries remain historical snapshots; quote/rebuild checks current availability and constraints before shopping.

Every operation revalidates with an ETag. Concurrent refreshes share a request. The last validated snapshot is cached for up to seven days for offline use. Without one, the packaged 402-recipe baseline is an explicitly labelled offline fallback. Offline content can be stale and cannot guarantee that a recently unpublished recipe has disappeared; reconnect and retry live recipes before relying on the latest data. Successful revalidation restores live mode.

The initial phone entry remains below 200 KB and loads neither the planner nor the catalogue until needed. This is a small-catalogue snapshot design (maximum 2,000 published records), not an unbounded feed. The existing database baseline has 420 recipes, including 18 legacy recipes; those without artwork keep the neutral image placeholder. Nutrition and kitchen-test CI audits describe the packaged baseline, not proof that later database edits have been nutritionally reviewed or kitchen tested.

## Validation

Unit/API tests cover public-field projection, publication filtering, ETags, insertion, editing, unpublishing, deletion, offline caching and recovery. The actual compiled planner is exercised with a live-only recipe, quantities and method edits, quotes and swaps, and an empty snapshot. The disposable MongoDB integration tests real edits and deletion persistence across reconnect. Phone browser tests add/edit/unpublish a server-side record after the app has loaded and verify its title, ingredient quantity and photo. No test writes to the production database.
