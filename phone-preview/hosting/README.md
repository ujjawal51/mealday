# Cloud login and backup deployment

The public UI and Node account API must share an origin. Setting a MongoDB URI on a static Site cannot activate cloud backup. MongoDB credentials must remain server-side.

## Deploy the existing Node application

The root `render.yaml` builds `phone-preview/Dockerfile`. It serves the same current phone UI, account forms and `/api/kitchen` routes. No second database or external auth service is introduced.

1. Create/select a MongoDB Atlas cluster and an application database user restricted to `mealday`. Allow the chosen backend's outbound addresses in Atlas network access. Keep a local database backup before any migration; deploying does not migrate the PC database automatically.
2. Deploy the repository using Render's Blueprint. Set `MONGODB_URI` in Render's secret environment settings. Do not put it in client code, GitHub or chat. `MONGODB_DB` defaults to `mealday`.
3. `RENDER_EXTERNAL_URL` supplies the HTTPS app origin automatically. Production binds to `0.0.0.0` and respects the host's `PORT`. `APP_ORIGIN` overrides the visitor-facing origin when a custom domain or gateway is used. Development still binds to localhost by default.
4. Check `/api/health`. A successful check pings MongoDB; a failed database check returns 503 without exposing credentials.
5. Open the deployed service URL. Register/sign in, explicitly import the guest kitchen in Settings, and verify the backup status. Sign into the same account from another browser/device and check a note, saved recipe and cooking-history entry. Changing an account must not reveal another account's kitchen.

The Blueprint selects Render's free compute plan; its availability and limits are controlled by Render. Free services may sleep and take longer to wake. Select always-on compute only with the owner's cost approval. No deployment is considered live until a reachable service and real database have passed the smoke checks.

## Keep the existing Sites URL

`site-gateway.mjs` is a dependency-free Worker ESM gateway, ready for the existing Site once the Node service is available. It forwards UI and account requests to that fixed HTTPS backend, so the browser keeps using one origin and first-party HttpOnly session cookies. It does not connect directly to MongoDB.

1. Generate a random server-to-server `MEALDAY_PROXY_SECRET` (at least 32 characters). Save the same value as a secret on the Node service and the Site. Never send this value to a browser.
2. Set Node `APP_ORIGIN` to the exact existing Sites origin. The service then requires the proxy key for all requests except its GET readiness check. Direct service-page login is no longer the supported entry point.
3. Configure Site runtime `MEALDAY_BACKEND_URL` with the actual HTTPS Node service origin and `MEALDAY_PROXY_SECRET` as a secret. These values are not committed or baked into the frontend.
4. In the selected Site checkout, preserve the exact `.openai/hosting.json` project ID, remove its `static` declaration, and build this gateway as `dist/server/index.js` with a default `fetch` export. Use the Sites source/package/publish workflow. Preserve the Site's current audience.
5. Verify the existing Site's `/api/account`, real login, `/api/kitchen` save/load and logout. A missing configuration or upstream outage must return 503 and never claim that data is synced.

The gateway whitelists request headers and forwards only Mealday's host-only session cookie. It does not transmit Sites identity cookies, platform bearer tokens or identity headers to the Node host. It pins the backend origin, refuses redirects, and does not cache account responses. Only the authenticated gateway can supply a client IP for the backend's login limiter.

The gateway is intentionally not activated in a static deployment before the backend exists. An unconfigured Worker would replace a working guest app with an unavailable service.

## Data and validation

Ratings, favourites, notes, cooking history, preferences, pantry and current plan are already included in the kitchen snapshot. Cross-device saves use revision checks; conflicts retain the local copy and require a version choice. Existing browser data is not erased by deploying this setup.

`npm run test:phone` includes deployment configuration, the real Node HTTP API behind the gateway, secure cookies, two independent client sessions, account isolation, logout, stale-revision rejection, platform-cookie stripping and database readiness failure. These tests use an explicit test store. They do not establish a real Atlas connection.

Once a reachable test Atlas database is configured, run `MONGODB_TEST_URI=... node phone-preview/server/mongo.integration.mjs` in a private terminal. The test creates a uniquely named test database and leaves it for inspection. Follow it with actual two-device smoke checks before calling cloud backup fixed.
