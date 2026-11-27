# Mealday camera and calorie tracking

The centre Camera control opens the OS photo picker, requesting the rear-facing camera on mobile. Actual picker behavior depends on the browser and phone. Choosing a file or cancelling does not upload anything. The tracker offers a photo preview, manually entered calories, and a serving-scaled estimate for Mealday recipes with complete mapped nutrition. Entries are editable, separated by local day and user or guest on this browser, and are not sent to cloud backup. Photos are not saved with entries. No calorie target or dieting advice is added.

## Optional AI estimate

Disabled by default. To enable separately, configure a server-only `MEALDAY_PHOTO_OPENAI_KEY` and `MEALDAY_PHOTO_DAILY_LIMIT` (integer 1–1000; default 0). This is an optional paid provider and needs an authorized project. The endpoint requires a valid Mealday session and same-origin POST. The Mongo-backed cap counts up to three attempts per user per UTC day and no more than the configured total. Attempts count even on provider failure. Users explicitly click **Estimate with AI** after seeing the disclosure. The browser resizes and re-encodes a JPEG before sending it. Mealday does not persist the image or raw result. The OpenAI request sets `store:false`; provider data handling is governed by the project settings and OpenAI terms. The reply is a rough portion-based range, not a measured nutrition fact. Only user-confirmed, editable values enter the local log.

References: [OpenAI image inputs](https://platform.openai.com/docs/guides/images-vision) and [Responses API](https://platform.openai.com/docs/api-reference/responses/create).

Tests use local synthetic sessions and simulated OpenAI responses; they incur no real charges. An actual phone camera and a production OpenAI project have not been tested here.
