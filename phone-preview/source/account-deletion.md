# Account deletion

Settings → Delete my account immediately sends a same-origin DELETE /api/account request using the existing signed-in session and CSRF token. There is no confirmation dialog, typed DELETE field, password prompt, or Google reauthentication. A brief loading label prevents duplicate clicks; failure leaves the account and its local cache intact and shows a toast. Guests are asked to sign in without sending a deletion request.

The server derives the owner exclusively from the validated session, rejects cross-site/origin/CSRF failures, and keeps the existing per-user rate limit and atomic auth-version guard. The MongoDB transaction removes that user, their kitchen and all sessions; other users and public recipes are unaffected. Successful deletion clears that account’s cache in this browser and restores the separate guest kitchen. Exported backups and offline copies on other devices remain separate.

This intentionally makes an authenticated click irreversible without a second confirmation. Automated checks use isolated test users only.

After successful deletion, the UI explicitly navigates to #welcome even if the restored guest kitchen already has a plan.
