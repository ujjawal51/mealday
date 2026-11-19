# Mealday: MongoDB accounts and kitchen backup

Clerk has been removed from the runtime, dependencies, frontend and configuration. Mealday's Node backend handles email/password registration, login and logout. MongoDB stores accounts, hashed session identifiers and kitchen snapshots. No third-party authentication service is required for this flow.

## Run on your PC

1. Install Node.js 22+ and start MongoDB Community Server. Compass alone is not a database server.
2. Copy `.env.example` to `.env` if one does not already exist. Preserve existing MongoDB settings. Old CLERK_* variables are no longer used and may be removed locally.
3. Set `MONGODB_URI`, `MONGODB_DB` and `APP_ORIGIN` (default `http://localhost:3000`). Never paste a database password in chat or commit `.env`.
4. Run `npm ci`, then `npm start` and open the configured APP_ORIGIN.
5. Settings > Backup & sync > Cloud backup & login opens the email/password form. To register in development, select Create a new account. Passwords must contain 12–128 characters.
6. After signing in, choose Import guest kitchen to merge existing device data. Signing out restores the guest kitchen.

Development allows registration by default. In production set an HTTPS APP_ORIGIN and explicitly set ALLOW_REGISTRATION=true to permit registration. Otherwise only existing accounts may sign in. Use a reachable, authenticated MongoDB server with restricted network access. Do not expose an unauthenticated local database port publicly. The Dockerfile serves the backend and frontend on the same origin.

## Security and ownership

Passwords are salted and hashed with Node scrypt. Raw passwords and raw session secrets are not stored in MongoDB. Each sign-in rotates the current session; the random cookie is HttpOnly, SameSite=Strict, and Secure with a __Host- prefix in production. Sessions expire after seven days and have a MongoDB TTL index; queries also reject expired sessions before the TTL cleanup runs. Logout deletes the server session and expires its cookie.

The verified server session selects the kitchen owner. Client-supplied user IDs cannot select another user's backup. Write requests require the configured Origin, JSON and a session CSRF token. Login and registration are rate limited per direct connection IP. If deployed behind a reverse proxy, add shared gateway rate limiting; this server deliberately does not trust arbitrary forwarded IP headers.

Recipes and images remain bundled with the app. Account snapshots contain ratings, saved recipes, notes, cooking history, preferences, pantry, plans and grocery checkmarks. This change does not migrate the recipe catalogue into database collections.

## Sync and migration

Guest import deduplicates saved meals and cooking events by ID. The account profile/current plan and account journal entries win duplicate conflicts. Autosave uses atomic revision checks; conflicting devices must choose a full local or remote snapshot. Offline account copies remain on their device for retry. No local storage keys or existing kitchens are deleted by the authentication change.

Accounts previously created through an external authentication provider are not automatically linked by email. To migrate any such data, authenticate its owner and explicitly export/import it. Never reassign a kitchen just because an email matches.

## Current hosting limits

The existing Sites URL serves a static frontend. It cannot execute this Node server or connect directly to MongoDB. It now displays a connection-required message instead of an external login widget. Login and cloud backup become available only when this project is served by the Node backend connected to MongoDB. Static publication alone does not activate cloud sync.

Google sign-in is not configured in this MongoDB-only version. It requires a separate Google OAuth implementation and Google Cloud OAuth credentials. Email verification, password reset/delivery, account deletion and production email deliverability are also pending; email/password registration does not claim a verified email identity. Existing external-service dashboard resources were not deleted.

## Validation

`npm test` exercises HTTP registration/login/logout, password hashing, session rotation/expiry, cookie security, account isolation, CSRF/Origin checks, rate limiting, revision conflicts, guest import and offline/account-switch recovery. Tests use an explicitly test-only in-memory store; production uses the official MongoDB driver with no memory fallback.

The real MongoDB integration test cannot run in this editing environment because starting mongod was rejected by an environment filesystem restriction. On your PC, set MONGODB_TEST_URI and run `node server/mongo.integration.mjs`; this creates a randomly named test database and does not delete it automatically.
