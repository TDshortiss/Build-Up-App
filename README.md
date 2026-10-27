# Build Up Training App

**Build Up** is an installable web app (PWA) that asks each user about their goal and builds a custom training plan:

- **Rehab**: 16 common sports injuries, each with a 4-stage protocol, a pain guide and progress checks that decide when you move on.
- **Off-season**: periodized Foundation → Strength → Power → Peak plans timed to the user's season start, for 17 sports.
- **In-season**: short maintenance sessions that keep hard work away from game days.
- **General**: muscle, strength or fitness plans.

Plans adapt to equipment (full gym, home, bodyweight), 1–6 days a week, session length, experience and age group. Any injury the user reports adds a rehab block to each session and swaps out exercises that would aggravate it until they pass that stage's progress check.

The original single-user ski program lives in [`fall-line/`](fall-line/index.html) and is deployed alongside the app at `/fall-line/`.

## How it works

| Folder | What's in it |
| --- | --- |
| `src/data/` | Content: exercise library, sports, injuries with rehab stages, pain guide |
| `src/engine/` | The rules-based plan generator (`generate.ts`), session templates, and view-time injury resolution (`resolve.ts`) |
| `src/state/` | Local state (works offline), Supabase auth and cloud sync |
| `src/screens/` | Welcome/auth, onboarding, Today, Plan, Rehab, Exercises, Me, legal pages |
| `supabase/schema.sql` | Database tables, row-level security, account deletion |

The generator saves the "healthy" plan. Each time a session is shown, exercises are checked against the user's current rehab stage and swapped if needed, so the plan opens back up automatically as they progress.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # generator tests across every sport, goal, equipment and schedule
```

Without Supabase settings the app runs in **device-only mode** (no login, data saved in the browser). That's handy for development.

## Going live

### 1. Create the Supabase project (accounts + sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), run it.
3. **Authentication → URL Configuration**: set **Site URL** to `https://tdshortiss.github.io/Build-Up-App/` and add the same URL under **Redirect URLs**.
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key.

The anon key is designed to be public; row-level security means each user can only read and write their own data.

### 2. Add the settings to GitHub

Repo **Settings → Secrets and variables → Actions**, add these as repository **Variables** (repository Secrets work too):

- `VITE_SUPABASE_URL`: the Project URL
- `VITE_SUPABASE_ANON_KEY`: the anon public key
- `VITE_SUPPORT_EMAIL` (optional): shown in the Terms and Privacy pages

### 3. Turn on GitHub Pages

Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Every push to `main` then tests, builds and deploys to `https://tdshortiss.github.io/Build-Up-App/`.

For local development against Supabase, copy `.env.example` to `.env.local` and fill it in.

## Before charging money or going to the app stores

- Have the Terms and Privacy pages (`src/screens/Legal.tsx`) reviewed.
- The `accounts.tier` column is ready for a payment webhook to set `pro`; nothing in the client can change it.
- Supabase's built-in email sender is rate-limited; add a custom SMTP provider (Authentication → Emails) before promoting the app widely.
- The app can be wrapped for iOS and Android with Capacitor without rewriting it.
