# Masquerade V7 — Azure Edition

This package removes Supabase completely and uses Azure-native deployment patterns:

- Next.js on **Azure App Service (Linux)**
- **Azure Database for PostgreSQL Flexible Server** via the `pg` driver
- **Azure App Service Authentication (Easy Auth)** with Microsoft Entra
- Server-side answer/hint validation; correct answers are never sent in the clue payload
- Challenge links and crew join links included as beta functionality
- **Change My Perspective remains removed**

## 1. Azure PostgreSQL
Create an Azure Database for PostgreSQL Flexible Server and a database named `masquerade`.
Run:

```bash
psql "host=YOURSERVER.postgres.database.azure.com dbname=masquerade user=YOURUSER sslmode=require" -f azure/schema.sql
psql "host=YOURSERVER.postgres.database.azure.com dbname=masquerade user=YOURUSER sslmode=require" -f azure/seed.sql
```

`azure/seed.sql` publishes three games for the database server's `current_date`. Re-run only on a fresh test database because the puzzle seed is intentionally simple, not idempotent.

## 2. Local environment
Copy `.env.example` to `.env.local` and fill in the Azure PostgreSQL values.
For local-only auth testing set:

```text
DEV_AUTH_BYPASS=true
DEV_USER_EMAIL=you@example.com
```

Never enable `DEV_AUTH_BYPASS` in Azure production.

Then:

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## 3. Azure App Service
Use a Linux App Service with a supported Node.js runtime. The package contains `build` and `start` scripts. A startup command of `npm start` is acceptable, though Azure's production guidance also supports a custom/PM2 startup configuration.

Add these App Service environment variables:

```text
NEXT_PUBLIC_SITE_URL=https://YOUR-DEFAULT-DOMAIN.azurewebsites.net
AZURE_POSTGRES_HOST=YOURSERVER.postgres.database.azure.com
AZURE_POSTGRES_DATABASE=masquerade
AZURE_POSTGRES_USER=YOURUSER
AZURE_POSTGRES_PASSWORD=YOURPASSWORD
AZURE_POSTGRES_PORT=5432
ENTRA_CLIENT_ID=YOUR-APP-CLIENT-ID
ENTRA_TENANT_ID=YOUR-DIRECTORY-TENANT-ID
ADMIN_EMAIL=YOUR-EMAIL
DEV_AUTH_BYPASS=false
SCM_DO_BUILD_DURING_DEPLOYMENT=true
```

`ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` are retained as configuration metadata. Easy Auth itself validates identity before requests reach this app.

## 4. Enable App Service Authentication
In Azure Portal:

1. App Service → **Authentication**.
2. Add identity provider → **Microsoft**.
3. Select/create the Entra app registration you want to use.
4. For the beta, allow unauthenticated requests so `/login` can render; protected application pages redirect to `/login` themselves.
5. Save.
6. Open `/login` and use **SIGN IN / CREATE ACCOUNT**.

After successful authentication App Service adds `X-MS-CLIENT-PRINCIPAL`; `lib/auth.ts` decodes it and creates/updates the corresponding row in `users`.

## 5. GitHub deployment
Keep `package.json` at the GitHub repository root. Connect App Service → Deployment Center → GitHub → `main` branch. After the GitHub Action completes, restart the App Service and open the exact **Default domain** from App Service → Overview.

## 6. Security notes
- Answers and hints are queried only on server routes.
- `/api/answer`, `/api/hint`, and `/api/hints` resolve the expected current puzzle from the session server-side; the browser cannot choose an arbitrary puzzle ID.
- Scores are calculated server-side.
- Admin access requires the signed-in Easy Auth email to exactly match `ADMIN_EMAIL`.
- Before a public launch, move PostgreSQL password auth to Managed Identity/Entra DB auth, add rate limiting, and review invite-token lifecycle.

## 7. Beta multiplayer
- Finish a game, then use **Challenge** to create a friend challenge URL.
- Crew creation generates a `/join/<code>` invite URL.
- These flows are beta-grade and intended for a small friend test before notifications/realtime are added.
