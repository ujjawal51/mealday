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

## Latest phone app and MongoDB accounts

The standalone [`phone-preview/`](phone-preview/) app contains the latest phone layout, full bundled recipe catalogue and photos, ratings and recommendations, saved meals and filters, cooking history, timer, and MongoDB email/password account and backup server. The original application remains at the repository root.

To run the standalone version:

```powershell
cd phone-preview
# Copy only if .env does not already exist:
Copy-Item .env.example .env
# Edit .env: use MONGODB_DB=mealday_phone_preview for this standalone app.
npm ci
npm start
```

Requires Node.js 22+ and a running MongoDB server. Stop any other app using port 3000 first. Open http://localhost:3000 and see [account setup and current limits](phone-preview/server/README.md).

Use a separate MongoDB database (`mealday_phone_preview`) when running this version alongside the original root app: their user and session schemas differ. Root-app `users`, `accounts` and `plan_history` records are not automatically migrated. Existing browser data is not deleted; import guest kitchen only after signing in. Google login, email verification/password reset, and online backend hosting remain pending. Publishing the static preview does not activate MongoDB sync.

The bundled JavaScript in `phone-preview/dist/` is ready to serve. `phone-preview/source/` retains the available source and tests; `source/api.ts` is a reference snapshot whose original domain-module inputs are not all present in this folder, so it is not a separate supported catalogue rebuild entrypoint. No .env, node_modules, credentials, or database exports are included.
