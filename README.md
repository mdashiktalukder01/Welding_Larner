# Welding Learner

Next.js 15 (App Router) + Tailwind + Supabase.

## Setup
1. Create a Supabase project and run `supabase/migrations/001…004` in order (SQL editor or `supabase db push`).
2. In Supabase > Authentication > Providers > Email, turn off "Confirm email" for local testing
   (or keep it on and add `http://localhost:3000/auth/callback` to the redirect URLs).
3. `cp .env.example .env.local` and fill in the project URL and anon key.
4. `npm install && npm run dev`
5. Register in the app, then promote yourself with the snippet at the bottom of `003_seed.sql`.

## Routes
- `/login`, `/register`
- `/dashboard` – four levels, locked/unlocked from `get_dashboard()`
- `/levels/[n]` – level hub
- `/levels/[n]/study` – accordion Q&A
- `/levels/[n]/exam/mcq` and `/exam/cq` – exams (all scoring is done in SQL RPCs)

## Admin panel (`/admin`, admins only)
- **Overview** – pool size per level and question type, student and attempt totals
- **Questions** – add / edit / delete MCQ and CQ, filter by level, search, hide from exams
- **CSV import** – validated in the browser, then inserted atomically; duplicates are skipped
- **Students** – progress, scores and attempt history per student
