# Careem Quik: local grocery basket trial

**Nothing in this integration fetches live prices, verifies a real delivery address, sends data to Careem, or places an order.** Mealday only enables it in local development, with an explicit loopback MCP endpoint and a loopback app origin. Production routes remain disabled even if the sandbox variable is set.

The prototype opens from Mealday’s **Shopping** screen, preserves the separate LuLu pricing flow, and uses the recipe basket’s remaining amounts after pantry deductions. It excludes manually added extras. In the trial, select a synthetic area, review exact fixture SKUs, see units, calculated quantities, and provider fixture pack prices, and approve creating a simulated basket. The response shows provider-supplied fixture subtotal, fees, total and ETA only when Careem’s fixture basket matches every selected SKU and quantity. This is a simulation, not an availability guarantee or quote for a real store. It does not guess pack sizes or conversions such as bread slices to grams, automatically choose substitutions, or quote a partial or changed basket.

## Run locally with Careem's scenarios

1. Download and unzip Careem’s [fixture Markdown package](https://builders.careem.com/docs/sandbox/).
2. Run the limited local adapter included here, or point Mealday to a local Careem sandbox implementation:  
   `node phone-preview/server/quik-fixture-runner.mjs /path/to/careem-mcp-sandbox/spec`
3. Run Mealday locally with its usual MongoDB config and `CAREEM_QUIK_SANDBOX_URL=http://127.0.0.1:8787/mcp`. Use a loopback app origin (e.g. `http://localhost:3000`). The trial action appears in the Shopping screen.
4. The official successful fixture is for only two 1 L milk packs, one 12-pack of eggs, and one 500 g loaf. The browser test supplies the corresponding milk (1,250 ml needed), eggs (6), and bread (350 g) requirements. The official simulator has fixed outcomes, so other baskets will often encounter missing matches or be refused at quote verification. The canonical planner commonly measures bread in slices; Mealday leaves that unmatched to the fixture's gram pack rather than inventing a conversion. London is a synthetic no-coverage test. No credentials, precise address, or payment input is accepted.

Tests:

```sh
node --test phone-preview/server/quik-sandbox.test.mjs
CAREEM_FIXTURE_SPEC=/path/to/careem-mcp-sandbox/spec node --test phone-preview/server/quik-sandbox.test.mjs
CAREEM_FIXTURE_SPEC=/path/to/careem-mcp-sandbox/spec node phone-preview/server/quik-sandbox.browser.mjs
```

The local runner reads only the four required tools/scenarios, checks input field names, and exercises the streamable MCP response path. It is not a complete implementation of the full Careem simulator and does not ship the fixture archive. Use existing project Playwright setup, or pass `CHROMIUM_PATH` to an installed Chromium executable for the browser test.

## Production prerequisites (not enabled)

- Obtain Careem’s written scope approval and public client ID for the grocery search, basket, and proposed checkout journey. The [production request form](https://builders.careem.com/request-access/) is manually reviewed. Neither the request nor an OAuth callback is implemented by this branch.
- Implement end-user [OAuth authorization code + PKCE](https://builders.careem.com/docs/authentication/), securely bind grants to Mealday users, register implemented callback URL(s) with Careem, and prove an approved address-scoped pilot.
- Before updating a live cart, obtain explicit consent, resolve unknown product and allergy/suitability cases without assumptions, reconcile existing items, and test stale prices, quote expiry, availability, changed quantities, and authenticated retries.
- Live checkout is a separate reviewed step, requiring final confirmation of the quote, delivery location and payment, durable idempotency/reconciliation, and a clear order outcome. Do not merely flip a sandbox flag to build an order.
