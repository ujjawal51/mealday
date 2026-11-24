# Recipe filter matching

The phone planner applies diet and ingredient exclusions, total elapsed cooking time, available appliances, cuisine, selected days/meals, household portions and whole-pack estimated budget. Generated plans, quotes, swaps and personalized ranking share eligibility checks. A saved/rated recipe cannot bypass them. Failed rebuilds preserve the saved plan.

Selected meal styles are an OR group, intersected with every other constraint. Empty styles impose no style restriction. Source tags alone are not trusted:

| Style | Planning rule |
| --- | --- |
| Speedy | Total elapsed time at most 30 minutes |
| Everyday | At most 60 minutes and 15 listed ingredients |
| Family | Rice, pasta, potato, bread, wraps, noodles, roti or couscous; at most 45 minutes |
| Comfort | A heated dish with a staple or lentil, bean or chickpea component |
| Fresh | At least 150 g of listed vegetables per serving and at most 600 calculated kcal |
| Protein | At least 25 g of calculated protein per serving |

Fresh and Protein require complete ingredient nutrition references. These are explicit recipe-selection heuristics using calculated estimates, not medical suitability or kitchen-test claims. The Preferences screen explains the rules. The plan's badge identifies a matched selected style.

Style eligibility is computed from the active catalogue, cached per revision and invalidated on a live catalogue change. The internal `mealStyleRecipeIds` field is derived by the API; caller-provided lists are ignored. Missing matches return a no-match error rather than relaxing other filters.

City/store still select the shopping context; unavailable retailer inventory and unverified live prices are not inferred. Acquisition questions such as discovery channel do not alter recipe eligibility.
