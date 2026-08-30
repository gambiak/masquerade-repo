# Deploy this package to Azure App Service

## A. Database
1. Azure Portal → Azure Database for PostgreSQL Flexible Server → your server.
2. Confirm a database named `masquerade` exists.
3. Run `azure/schema.sql` against that database.
4. Run `azure/seed.sql` once on a fresh beta database. It creates today's three difficulty games.

## B. App Service
1. Use **Linux** App Service and a Node.js runtime compatible with Next.js 15.
2. Put this project's files at the root of your GitHub repository (the same folder as `package.json`).
3. App Service → Deployment Center → GitHub → select repository + `main`.
4. App Service → Environment variables → add:
   - `NEXT_PUBLIC_SITE_URL=https://<exact-default-domain>`
   - `AZURE_POSTGRES_HOST=<server>.postgres.database.azure.com`
   - `AZURE_POSTGRES_DATABASE=masquerade`
   - `AZURE_POSTGRES_USER=<postgres-login>`
   - `AZURE_POSTGRES_PASSWORD=<postgres-password>`
   - `AZURE_POSTGRES_PORT=5432`
   - `ADMIN_EMAIL=<your-login-email>`
   - `ENTRA_CLIENT_ID=<app-registration-client-id>`
   - `ENTRA_TENANT_ID=<directory-tenant-id>`
   - `DEV_AUTH_BYPASS=false`
   - `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
5. App Service startup command: `npm start`.
6. Save and restart.

## C. Authentication (Easy Auth)
1. App Service → Authentication → Add identity provider → Microsoft.
2. Select/create the app registration associated with your Entra tenant.
3. For this beta package, choose **Allow unauthenticated access** so the public home/login pages can render. The game routes check authentication themselves.
4. Save.
5. Visit `https://<default-domain>/login`; the button goes to `/.auth/login/aad` and returns to Masquerade after authentication.

## D. First verification
1. Visit `/` — you should see Masquerade, not Azure's placeholder page.
2. Visit `/login` and sign in.
3. After sign-in, the first request creates a row in `users` using the Easy Auth identity.
4. Start today's game.
5. Complete one puzzle and verify rows appear in `game_sessions`, `puzzle_results`, and `puzzle_attempts`.
6. Finish all five and open `/results/latest`.

## E. Invite a friend
1. Finish today's game.
2. Open `/challenge` and enter your friend's email.
3. Share the generated `/c/<code>` URL.
4. Friend signs in, accepts, and gets the same `daily_game_id`.
5. Create a crew from `/crew`; share `/join/<code>`.

## Troubleshooting
- Azure says **Your web app is running and waiting for your content**: Deployment Center/GitHub Actions did not deploy this project to the App Service yet.
- `500` after sign-in: check App Service Log Stream; most likely PostgreSQL env/networking/schema.
- `No daily game published`: run `azure/seed.sql`, or insert/publish a `daily_games` row for `current_date`.
- Login button loops/fails: App Service → Authentication provider/app registration is not configured correctly.
