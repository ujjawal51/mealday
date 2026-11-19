# Cooking timer lifecycle

The cooking timer is owned by the browser session, independently of recipe step rendering. Step navigation, finishing the guide, changing recipe tabs and leaving the recipe do not clear its deadline. The recipe screen displays the running timer and its recipe name; a running timer cannot be restarted accidentally. Cancel explicitly clears it.

Countdown uses an absolute deadline, so delayed/background interval callbacks catch up. Expiry sends one in-page toast. This is an in-page session timer: page reload/closure resets it, and operating-system suspension may delay notification until the browser resumes. It does not schedule native background alarms.

`node source/cooking-timer.test.mjs` checks continuity, duplicate start protection, delayed ticks, one completion, cancellation and restart. Browser QA verified Next, Previous, Ingredients/Instructions navigation and Cancel.
