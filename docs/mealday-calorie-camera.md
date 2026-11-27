# Mealday camera and calorie tracking

The centre Camera control and the `/#calories` deep link open the daily food log. Scan a meal → Take photo opens the OS photo picker, requesting the rear-facing camera on mobile. Actual picker behavior depends on the browser and phone. Choosing a file or cancelling does not upload anything. The tracker offers a photo preview, manually entered calories, and a serving-scaled estimate for Mealday recipes with complete mapped nutrition. Entries are editable, separated by local day and user or guest on this browser, and are not sent to cloud backup. Photos are not saved with entries. No calorie target or dieting advice is added.

## Phone flow

Camera framing screen → photo review with Retake → estimating screen with Cancel → estimated range or recovery screen → confirm editable portion, meal type and calories → daily food log. Manual and Mealday recipe choices bypass the AI stages and use the same confirm screen. The food log lets the user pick a local date and edit or remove entries. Provider-off and no-match states remain usable without any automatic estimate.

## Cloudflare Workers AI private pilot

Saving `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` alone does not turn on scanning. The owner first reviews and accepts the [Meta model license and use policy](https://developers.cloudflare.com/workers-ai/models/llama-3.2-11b-vision-instruct/) through Cloudflare’s documented one-time account flow. Mealday never accepts terms or retries on the owner’s behalf. Stay on [Workers Free](https://developers.cloudflare.com/workers-ai/platform/pricing/) for the no-overage pilot. Use a single designated, email-verified Mealday account and food-only test photos.

After approval and for the test only, set `MEALDAY_PHOTO_PROVIDER=cloudflare`, `MEALDAY_PHOTO_PILOT_EMAIL` to the pilot’s actual Mealday login address, and `MEALDAY_PHOTO_DAILY_LIMIT=5` (Cloudflare enforces a maximum of 20 app attempts per day; the existing three-attempt per account cap still applies). Keep the Cloudflare token server-side with only Workers AI permissions. If any requirement is missing or the account does not match, the Cloudflare pilot is unavailable. A provider quota error stops the attempt and offers manual or recipe logging; it never falls back to OpenAI or retries automatically. Set the app cap back to 0 to disable. Actual Cloudflare usage is subject to the account’s existing plan and quota; the app cap is not a billing guarantee on a Paid account.

The pilot sends the JPEG only after **Estimate with AI** explicitly says it will be sent to Cloudflare Workers AI. It keeps results editable and avoids storing the photo itself. Test one known-portion and one nonfood image; verify the remaining quota, consent screen, and accuracy before any expansion. The automated tests simulate Cloudflare and incur no real usage.

## Optional OpenAI estimate

Disabled by default. To enable separately, configure a server-only `MEALDAY_PHOTO_OPENAI_KEY` and `MEALDAY_PHOTO_DAILY_LIMIT` (integer 1–1000; default 0). This is an optional paid provider and needs an authorized project. The endpoint requires a valid Mealday session and same-origin POST. The Mongo-backed cap counts up to three attempts per user per UTC day and no more than the configured total. Attempts count even on provider failure. Users explicitly click **Estimate with AI** after seeing the disclosure. The browser resizes and re-encodes a JPEG before sending it. Mealday does not persist the image or raw result. The OpenAI request sets `store:false`; provider data handling is governed by the project settings and OpenAI terms. The reply is a rough portion-based range, not a measured nutrition fact. Only user-confirmed, editable values enter the local log.

References: [OpenAI image inputs](https://platform.openai.com/docs/guides/images-vision) and [Responses API](https://platform.openai.com/docs/api-reference/responses/create).

Tests use local synthetic sessions and simulated OpenAI responses; they incur no real charges. An actual phone camera and a production OpenAI project have not been tested here.
