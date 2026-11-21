# Account email setup

The account backend now supports password reset and email verification using the Resend HTTPS API. No API keys are stored in Git or browser bundles.

## Activate on Render

1. In Resend, verify a domain you own and configure its DNS records. Create a sending-only API key restricted to that domain.
2. In the Render mealday service, open Environment and set:
   - RESEND_API_KEY: the private sending-only key
   - MAIL_FROM: Mealday <accounts@your-verified-domain>
3. Save and deploy. GET /api/account will expose emailRecovery: true (never the key).
4. Test signup with your own mailbox. New accounts receive a verification email and must verify before login. The confirmation page requires a button press; opening links in email scanners does not consume tokens.
5. Test Forgot password. Open the email, set a new 12–128 character password, and confirm the old password and existing sessions no longer work. Existing kitchen data must remain.
6. Reopen each used link to confirm it cannot be reused.

Without both settings, existing login/signup keeps working, but email endpoints return 503 and recovery pages explain that email delivery is unavailable. Existing accounts are not automatically locked out; they can request verification from the login page.

## Security and behavior

- Opaque 256-bit tokens: hashes stored in MongoDB, raw tokens only sent by email.
- Password reset: 30 minute expiry. Email verification: 24 hour expiry. New links replace older links after a 60 second per-account cooldown.
- Single-use consumption is atomic in MongoDB. Password reset increments the user's session version and removes all stored sessions. Passwords use the existing salted scrypt hashing.
- Links use the server-configured app origin and URL fragments; browsers remove the fragment before submission. No tokens in query strings, analytics or console logs.
- Anonymous requests return the same message for eligible and nonexistent addresses. Origin checks, IP request limits and database cooldowns limit abuse. Delivery timing can vary; this is not a claim of constant-time responses.
- Resend credentials remain server-side. Provider failures are sanitized, and failed delivery invalidates the corresponding token.
- Existing legacy password hashes are replaced only after a successful reset.
- The app's user data remains in MongoDB Atlas; Resend is used only to deliver account emails.

## Validation

The Phone account checks workflow runs server regression tests and the real MongoDB integration suite against a disposable database. It does not send real emails. A real mailbox delivery test is still required after configuring Resend.
