# Mealday

A responsive meal-planning web app with one active route at a time. Approved white-green visual design.

## Working flows

- Twelve-step profile setup, validation, editing and a sequential building animation
- Sixteen structured recipes with ingredient quantities per person and individual cooking steps
- Recipe matching by diet, excluded ingredients, appliance availability and cooking time
- Weekly dinner slots determined by chosen days, recipe swaps and cooking completion
- Shopping quantities aggregated from the actual meal plan, rounded to full packs
- Quantity-based pantry deductions, shopping checklist, progress and copied lists
- Saved recipes, star ratings, start/pause/reset timer
- Browser-local persistence for profile, plan, pantry, favourites, ticks and ratings

## Development

1. Ensure MongoDB is running locally (`mongodb://127.0.0.1:27017`).
2. Configure `.env` (defaults to local MongoDB):
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB=mealday
   APP_ORIGIN=http://localhost:3000
   HOST=127.0.0.1
   PORT=3000
   NODE_ENV=development
   ```
3. Run `npm install`
4. Run `npm start` to start the app with MongoDB connected at `http://127.0.0.1:3000`.
   Or run `npm run build` to build static production bundles into `dist/`.

## Limits

Prices are local catalogue estimates, not live retailer prices. Recipe images are representative. The planner selects from a curated catalogue, not an AI service. It reports budget overruns rather than guaranteeing every target is feasible. No grocery ordering, payments or cloud account synchronisation is connected. Dietary exclusions check listed ingredients, not cross-contact.
