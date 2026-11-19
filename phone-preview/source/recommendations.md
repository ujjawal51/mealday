# Personalised meal suggestions

The browser recommendation wrapper in `dist/recommendations.js` ranks plans and swaps using saved feedback. Four and five star ratings boost recipes; one and two star ratings reduce their preference. Saved recipes receive a smaller boost. Recent cooked meals (up to 30 days), the current plan, and dated recent plans receive repeat penalties. Unknown legacy cooking dates are not treated as recent.

Feedback applies on the next rebuild or when opening swap suggestions. Manual swaps keep the user’s selected recipe. Ratings and history remain local to the browser; this is deterministic ranking, without a remote learning service.

The original catalogue planner validates every candidate and replacement. Budget, basket pricing, pantry, servings, cuisine, diet, allergies, appliances, time and distinct recipes remain enforced. Feedback is a preference, not an exclusion: constrained plans may retain recent or lower-rated recipes. With no usable feedback the original planner response is preserved. If optimisation fails the validated original plan is returned with an unavailable status.

Plan history is bounded to eight entries. Signal payloads and candidate exploration are bounded. Cooking history uses the existing independent cooking history store and is not cleared by rebuild.

Verification: `node source/recommendations.test.mjs` exercises the actual bundled catalogue API: cold start equivalence, high/low ratings, recent meal rotation, swap ranking, malformed signals, constrained profiles, basket re-quotation and budget validation.
