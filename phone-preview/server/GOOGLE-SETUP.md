# Google-only sign-in

Mealday now uses Google Identity Services for sign-in and signup. Account data remains in MongoDB Atlas. The email-delivery system has been removed. Old recovery URLs redirect to login, and old recovery APIs return 410. Existing signed-in sessions remain valid. Password authentication is available only through an explicit test/development constructor option, never enabled by the production server.

## Activate

1. Open Google Cloud Console → Google Auth Platform. Select/create a Mealday project and configure its Branding and Audience (External). In Testing mode add the Google accounts that will test the app.
2. Create an OAuth client with application type **Web application**.
3. Add **Authorized JavaScript origin** `https://mealday.onrender.com` (no path). This uses the Google Identity Services popup credential flow, not a server authorization-code callback. No redirect URI or client secret is used by Mealday.
4. Set `GOOGLE_CLIENT_ID` in Render → mealday → Environment to the web client's ID, and deploy. The ID is public. Do not put client secrets or private keys in the frontend.
5. The obsolete email-delivery environment variables can be removed from Render; the app no longer reads them.
6. Test Google sign-in/signup with your own account, restore saved meals in a second browser, then check deletion only using a disposable test account.

## Identity and recovery

The server validates Google token signature, audience, issuer, expiry, verified email, and a browser-bound single-use nonce. Nonce hashes expire in MongoDB. The Google subject is the stable identity; Mealday does not store Google passwords, access tokens or refresh tokens.

An existing account with the same email is linked automatically only when Google is authoritative for the address (Gmail or a Google Workspace `hd` claim). Linking retains the existing Mealday user ID and kitchen, revokes old sessions, and removes the old password/recovery credentials. A third-party email with an existing Mealday account is not silently linked; it returns a clear conflict and preserves the data for a separate migration. Google verification of a third-party email alone is not proof of its current ownership.

For Google accounts, deletion requires a fresh Google confirmation tied to the same Mealday account and the typed DELETE confirmation. Existing password sessions can still confirm deletion with their password until they sign out or switch to Google.

## Validation

Unit and HTTP tests cover token-claim rejection, nonce binding/replay/expiry, origin rejection, Google signup/login, and same-account reauthentication for deletion. The real disposable MongoDB suite covers account linking, preserved kitchen data, subject conflicts and deletion races. Phone browser tests mock only Google's external SDK/token verifier and exercise the actual Mealday UI and API. Real Google sign-in must be smoke-tested after setting the actual client ID.
