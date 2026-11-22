# Store price observations and the live-pricing blocker

No supermarket API credentials, product feed or genuine price records were supplied. There is no live retailer connection in this change. Production records start empty. The P1 for verified live basket prices remains open. Existing catalogue prices still drive planning and its budget estimate; selecting a store does not turn those estimates into store prices.

The shopping screen now separates generic catalogue estimates from dated, reviewed product-price records. It shows product links, usable packs to buy, per-pack price, observation time (UAE time), expiry, source, location and reported stock when records exist. No record means no retailer timestamp and no recorded subtotal. Missing, expired, mismatched or unavailable products cannot be silently priced at zero or filled from generic estimates in the recorded subtotal. Extra essentials, delivery fees, substitutions, current delivery availability and the checkout total are excluded.

## Read-only quote API

`POST /api/store-prices`, same-origin JSON:

```json
{"shop":"Carrefour","city":"Dubai","locationId":"","items":[{"key":"rice","need":750,"unit":"g"}]}
```

`need` is the amount still needed after pantry deductions, not the generic catalogue pack count. Maximum 100 unique ingredient lines. The server resolves current ingredient identities from the central recipe catalogue only when real observations exist. Store, city and location are exact matches. Multiple locations require an explicit selection; prices from different branches are never combined into one complete subtotal.

The response includes per-line status, original check/expiry times, available location choices, matched count, `knownSubtotal`, and `recordedSubtotal` only when every requested line has an eligible record. `checkoutVerified` is always false. `calculatedAt` is when the arithmetic ran, not a retailer price-check timestamp. Refreshing the quote never updates an observation's check time.

Quotes use integer micro-units for pack rounding and integer fils for money. A 750 g need with an eligible 500 g pack requires two packs even if the catalogue assumed a 1 kg pack. The pack's usable quantity must match the ingredient state: a tin's net weight does not establish its drained edible quantity. Meat cuts, cooked versus raw weights and bread piece sizes require reviewed matching; no fuzzy or automatic product substitutions are accepted.

Observed in-stock status is historical. If available pack quantity is unknown, the UI says quantity is not confirmed. Reported out-of-stock, unknown availability or insufficient packs blocks that product's contribution to a complete recorded subtotal. Eligible records must be reviewed, include VAT in an AED price, and retain their original expiry, capped at 24 hours from observation. This conservative age cap is a product rule for dated records; it does not establish that the price or stock remains live for 24 hours.

## Recording genuine observations without retailer API access

An authorized operator can manually check a retailer product page for an explicit location, record the evidence and review the exact ingredient match. This is manual work, not an automatic API integration. Do not import demonstration fixtures, search-result snippets or guessed availability as real observations. A receipt can support a historical product price but cannot by itself establish current in-stock availability.

The MongoDB collection is `store_price_records`. No public create/edit endpoint is exposed. Keep credentials in server secrets. The command below uses the existing privately configured MongoDB environment; it does not need a supermarket API key:

```sh
node --env-file-if-exists=.env phone-preview/server/import-store-prices.mjs --signature rice
node --env-file-if-exists=.env phone-preview/server/import-store-prices.mjs --file reviewed-observations.json --dry-run
node --env-file-if-exists=.env phone-preview/server/import-store-prices.mjs --file reviewed-observations.json
```

The signature command prints the current ingredient definition and fingerprint. Use the canonical ingredient key shown in the grocery basket. Fingerprints include ingredient name, unit, kind and allergens; later identity edits invalidate the old match. Fingerprints detect changes but do not replace a person's product/ingredient review.

Import an array of objects with these fields. No fabricated example prices or dates are provided:

| Field | Required content |
| --- | --- |
| `shop`, `city` | One of the app's named supermarkets and UAE cities |
| `locationId`, `locationName` | Stable branch/delivery-area identifier and a user-readable label |
| `ingredientId`, `ingredientSignature` | Exact canonical ingredient and its current fingerprint |
| `productId`, `productName`, `productUrl` | Actual SKU, product name and public HTTPS product URL |
| `packQuantity`, `unit` | Positive usable quantity per purchased pack, in the ingredient's exact unit |
| `packLabel`, `quantityBasis` | Labelled pack and explanation of raw/drained/edible quantity |
| `price`, `currency`, `taxIncluded` | Actual pack price to two decimals, AED, VAT included (`true`) |
| `availability`, `stockPacks` | `in-stock`, `out-of-stock` or `unknown`; pack quantity can be null/omitted if unknown |
| `checkedAt`, `validUntil` | Original source observation and expiry as ISO timestamps; expiry within 24 hours |
| `source` | `type` (`retailer-page`, `receipt`, `partner-feed`), `name`, public HTTPS `url` |
| `review` | `approved:true`, actual reviewer identifier in `by`, and review timestamp `at` |

Only import public, non-personal source links; never expose private receipt URLs, names, addresses or tokens. A `partner-feed` source label does not configure or validate a partner connection. A real adapter still needs an authorized contract, documentation, product mapping and delivery-location support.

The importer validates the whole input before writes and rejects duplicate matches. It keeps one current observation per store/city/location/SKU/ingredient, skips older observations and guards against replacing a concurrently updated observation. This is not an automatic polling service. A reviewer must record new observations before expiry. The app reads the database on refresh; there is no dummy production data, silent scraping or search-index price presented as a live checkout price.

## Checks and remaining work

Unit tests cover usable pack arithmetic, money precision, source/identity validation, stale/future records, missing VAT, stock, scopes, latest SKU observations and protected read-only requests. A disposable MongoDB test exercises exact shop/city lookup. Phone browser tests use isolated synthetic fixtures to verify no-record, complete recorded, partial stock, failed refresh and phone layout states; those fixtures are never deployed as retailer records.

To close the live-price P1, obtain an authorized retailer/aggregator feed, implement its documented adapter, verify delivery-area stock and full basket coverage, connect refresh/expiry handling and verify checkout/fees through the provider. Until then the app must keep its estimate and recorded-observation labels.
