# Mealday

## Run the latest UI

From the repository root, `npm start` now runs the current phone UI and MongoDB backend from `phone-preview`. It serves that UI and all 402 bundled recipe photos from the correct module-relative folder, regardless of the working directory. Stop the running server with Ctrl+C, run `git pull`, then `npm start`, and reload http://localhost:3000 with Ctrl+Shift+R. Keep your root .env. The old React app can still be started explicitly with `npm run start:legacy`; it is not the default.

Existing original-app users can sign in with their previous password. Existing original `accounts` snapshots and browser storage are preserved; they are not automatically converted to the phone UI kitchen format. The 18 imported original recipes have explicit missing-photo placeholders; they do not yet have matching dish photos.

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

The standalone [`phone-preview/`](phone-preview/) app contains the latest phone layout, full bundled recipe catalogue and photos, ratings and recommendations, saved meals and filters, cooking history, timer, and MongoDB email/password account and backup server. The original application remains in the repository and can be run with `npm run start:legacy`.

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

A separate MongoDB database (`mealday_phone_preview`) remains an option for an isolated standalone setup. The default root start uses the root .env and supports original user password hashes and the original sessions token index without deleting old data. Root-app `users`, `accounts` and `plan_history` records are not automatically migrated. Existing browser data is not deleted; import guest kitchen only after signing in. Google login, email verification/password reset, and online backend hosting remain pending. Publishing the static preview does not activate MongoDB sync.

The bundled JavaScript in `phone-preview/dist/` is ready to serve. `phone-preview/source/` retains the available source and tests; `source/api.ts` is a reference snapshot whose original domain-module inputs are not all present in this folder, so it is not a separate supported catalogue rebuild entrypoint. No .env, node_modules, credentials, or database exports are included.

## Import recipes into your connected MongoDB

After `git pull`, run `npm run recipes:import` from the repository root to import all 402 phone-preview recipes into the database configured in the root .env. Existing recipes with the same id are preserved; repeat runs add only missing recipes. In Compass refresh the `recipes` collection after the command reports success. `phone-preview` backend startup also imports missing recipes automatically into its configured database. Images remain bundled files; database documents include photo paths, recipe steps, ingredient quantities and nutrition completeness/source.

### Remaining original recipes

The importer now includes 18 original repository recipes in addition to the 402 phone recipes, for 420 unique IDs. Run `git pull` then `npm run recipes:import` again in your connected project. An existing 402-record catalogue should report inserted=18, existing=402, present=420. The 18 original recipes currently have explicit missing-photo placeholders; no matching images or verified nutrition values are invented.

## Login and signup forms

Open `/login.html` or `/signup.html` on the current app origin. Welcome and Settings link to the forms. Signup confirms the password and enforces 12 characters; password visibility is optional. Account-service availability is checked before credentials can be entered. Forms submit only to the same-origin MongoDB backend; they do not save passwords in browser storage. Static preview publication displays the forms but cannot create accounts until the online Node/MongoDB backend is hosted. Existing sessions show a Continue to Mealday link. Sign-out remains in Settings.
