# Saved recipe filtering

Saved recipes now apply the library's name search, cuisine and diet together. Queries trim whitespace and ignore case. Diet values use the same category mapping as /api/recipes. The filter returns a new array and never edits stored favourites.

Saved searches run locally. Switching tabs invalidates older requests and loads All recipes against the current filters, avoiding stale catalogue results. Saved results never show catalogue pagination. Empty favourites and zero matching favourites have separate messages; Clear filters restores the full saved list without deleting anything.

Validation: node source/recipe-filters.test.mjs checks 100 combinations against the complete 402-recipe catalogue API, plus empty/subset preservation and resetting. Browser QA saved three recipes across three cuisines/diets, verified combined case-insensitive search, 0-of-3 no-match messaging, Clear filters restoring 3-of-3, and switching to All and back with the current search retained.
