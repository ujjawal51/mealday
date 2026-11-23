# LuLu UAE product prices through ReefAPI

Render → mealday → Environment: set private REEF_API_KEY. No key is bundled, stored in the browser, logged, or returned by the API. REEF_DAILY_CREDITS optionally sets a whole-service UTC daily request-credit cap (default 20, maximum 1000, 0 disables paid calls). MongoDB price_api_usage persists reservations across restarts and atomically limits concurrent requests. A reservation is conservative and is not refunded on failure. It is not a billing balance or a provider-enforced spending limit; this integration never buys credits or tops up the account.

In Groceries, select LuLu. Each ingredient gets Find LuLu price. Signed-in users explicitly search, inspect candidates and select an exact product. Searching costs up to 2 provider credits and rechecking the chosen product up to 1; equivalent requests share a five-minute cache and preserve the original provider timestamp. No background catalogue crawling or automatic paid search runs on page load.

API:
- GET /api/lulu/status: configuration metadata only, never tests whether the key works.
- POST /api/lulu/search: {query}, authenticated session + same-origin JSON + CSRF.
- POST /api/lulu/product: {productId,need,unit}, same protection.
- Maximum 10 requests per minute per signed-in account; maximum two concurrent upstream calls.
- Fixed https://api.reefapi.com/luluhypermarket/v1/{search,product}; country ae, language en. No redirects, arbitrary target URL or user-selected credentials.
- Fifteen-second upstream timeout, 1 MiB response cap. Only live AED/ae envelopes with recent provider fetched_at are accepted. Public output uses an allowlist and retailer links are restricted to gcc.luluhypermarket.com/en-ae/.

Scope: the documented API supports country, not a delivery-area selector. These are LuLu UAE online reference prices, not verified Dubai-area stock, an express/minutes delivery quote, physical store price or final checkout total. Do not write these observations into the city-specific reviewed-price collection. Existing generic estimates and reviewed records remain separate.

The picker never automatically equates generic carrots with Australian carrots. It shows each candidate's exact title, pack and price. A chosen product is re-fetched by provider product_id before showing a selected subtotal. Plain g/kg, ml/l and piece counts can produce whole-pack totals, after subtracting the pantry amount. Ambiguous multipacks, bunches, incompatible units, reported unavailable/unknown stock, insufficient stock and order-limit violations cannot produce a selected line total. Ingredients explicitly labelled drained/cooked/edible/desalted are excluded from package-based totals because their usable quantity needs separate review. Extra essentials are not included.

Selected choices are transient in-memory references, cleared on account, store, city or basket changes, expiry and failed rechecks; they are not saved as reviewed ingredient mappings. Original provider timestamps and a five-minute validity limit are shown. Authentication, quota, outage or malformed data produce a clear error; no guessed price is substituted.

Tests use synthetic supplier responses and isolated users only. CI runs API/parser tests, atomic MongoDB quota tests and an actual phone browser picker test. Deployment smoke checks the exact served widget plus configuration status without spending provider credits. A successful real authenticated lookup in the live app is still required to confirm the user's key and upstream response shape.

Provider documentation: https://reefapi.com/docs/luluhypermarket and https://api.reefapi.com/openapi/luluhypermarket.json

Selected pack totals are displayed as the primary grocery-row price labelled LuLu UAE. The generic estimate is secondary and its no-match message is hidden while a usable selection is active. The grocery header sums selected pack prices plus unmatched catalogue estimates and explicitly labels mixed totals. Fully selected baskets show a LuLu UAE online subtotal. Expiry and failed rechecks restore the original row and total.
