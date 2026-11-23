# Illustrated shopping checklist

The grocery page uses a compact white checklist card with local decorative ingredient images, category counts, exact pack quantities, recipe/pantry/remaining quantities and per-line price provenance. All / To buy / Bought filters are transient; purchased checks use the existing synchronized state.checked and extraGroceries fields. Reset clears only bought checks for the current list and extras, preserving the plan, pantry, saved meals, notes and history.

Share uses the platform share sheet, then clipboard, then a copyable dialog. Shared text includes all groceries and extras, bought marks, selected fresh LuLu pack prices with source time, recorded prices or explicit catalogue estimates. No external messages are sent automatically.

LuLu selections continue to control primary prices and pack labels. The total and full price records appear below the checklist. No new price API call is made by filtering or ticking an item. Images are ingredient illustrations, not actual retailer product photos.

Ingredient images: Google Noto Emoji 3D, bundled locally with LICENSE and NOTICE under dist/ingredients. Unknown ingredients use a basket illustration; failed image requests fall back locally.

Browser regression checks cover progress, filters, reset, image availability, native share and clipboard failure fallback, preservation of notes and plan contents, and 320px/390px horizontal fit. Existing supplier browser checks cover price selection, expiry and recheck failures.
