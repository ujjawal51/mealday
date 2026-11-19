# Cooking history independent of plans

Cooking events now live under `mealday.cooking-history.v1` in on-device local storage, independently of `mealday.android.v1` (the plan/profile key). Cooked badges and recipe state derive from this history. Successful plan generation no longer clears cooked marks. Swaps, pantry quotes and preference rebuilds also leave the history key alone.

On first load, old `state.cooked` IDs migrate once. Matching names are recovered from the current plan/favourites when possible, or when the recipe is opened later. Older marks carry an unknown date, never a fabricated migration timestamp. The legacy property is removed only after writing the new history succeeds. A valid empty history is authoritative and cannot reimport undone/reset marks.

Mark as cooked logs a dated event. Log another cook adds another occurrence of an already cooked recipe. Explicitly toggling the cooked mark off withdraws active marks for that recipe; undone records are retained internally and excluded from visible counts. Rebuilding never performs this undo. Settings → Cooking history shows dated active records and recipe links; legacy entries say Date not recorded.

Full Reset this kitchen explicitly includes cooking history in its confirmation and clears both keys' in-memory contents. Rebuild, Reset saved meals, recipe notes and ratings do not clear it. History remains local to this browser/device; clearing browser/app storage removes it. Storage write failures show a warning instead of claiming durable success.

Validation: module tests cover unique legacy migration, unknown dates, multiple cooking occurrences, immutable updates, storage reload, explicit undo without reimport, empty/reset history and malformed records. Browser QA marked a current meal, rebuilt, confirmed the Cooked badge, logged another occurrence, changed preferences to generate a different two-meal plan, reloaded, and confirmed both history entries and the old recipe's cooked state survived.
