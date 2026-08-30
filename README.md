# Masquerade V7

Masquerade V7 is the first multiplayer-ready architecture. It preserves the V6 game philosophy while removing **Change My Perspective** completely.

## Included

- Next.js application structure
- Supabase authentication with email magic links
- Daily Masquerade model
- Clever / Devious / Fiendish difficulty
- Five-puzzle daily runs
- Final Mask support
- Exactly three escalating hints
- One-word answer philosophy
- Numeric/spelled-number answer support
- Server API for answer checking and scoring
- Persistent active sessions + Continue Game
- Quit Game
- Hint-based scoring + First Try + Final Mask bonuses
- Pure Solve tracking
- Non-repeating witty wrong-answer coaching
- Spoiler-free results structure
- Friend challenge data model and creation UI
- Morning Crew data model and creation UI
- Stats/profile screens
- Admin Puzzle Studio starter
- Supabase SQL schema + seed file
- RLS starter policies

## Security architecture

`puzzles_private` contains answers and all hints and has no player-facing read policy. Answer checking and hint retrieval use a **server-only Supabase service-role client** in `lib/supabase/admin.ts`. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

## Local setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Run `supabase/seed.sql`.
4. Populate at least 5 approved puzzles for each difficulty.
5. Create today's `daily_games` records and `daily_game_puzzles` links.
6. Copy `.env.example` to `.env.local`.
7. Fill:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
   - `ADMIN_EMAIL`
8. Install dependencies:
   `npm install`
9. Start:
   `npm run dev`
10. Open `http://localhost:3000`

## Production deployment

Recommended:
- GitHub repository
- Supabase production project
- Vercel deployment
- Custom domain
- Supabase Auth redirect URL set to your deployed domain
- HTTPS only
- RLS reviewed before beta
- Service-role key stored only as a server secret
- Never expose answers in client bundles

## Next engineering tasks before public beta

1. Add challenge acceptance route and comparison screen.
3. Add crew invite/join route.
4. Add actual Web Share API client component.
5. Add admin Daily Game scheduler.
6. Add puzzle QA metadata: ambiguity, Aha strength, hint leakage, knowledge dependency.
7. Add analytics events.
8. Add semantic/AI wrong-answer coach server-side.
9. Add notification system.
10. Add PWA manifest/icons/service worker.
