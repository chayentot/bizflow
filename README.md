# BizFlow Starter

A portfolio-ready multi-tenant business operations MVP built with Next.js and Supabase.

## Features
- Email/password authentication
- Secure company workspace setup
- Dashboard metrics
- Task CRUD and completion
- Customer CRUD
- Income and expense tracking
- PostgreSQL Row Level Security
- Responsive layout

## Setup
1. Install Node.js 20.9 or newer.
2. Create a Supabase project.
3. Open Supabase SQL Editor and run `supabase/schema.sql`.
4. Copy `.env.example` to `.env.local` and add your project URL and publishable key. Older projects may label this the anon key.
5. In Supabase Authentication URL Configuration, set the Site URL to `http://localhost:3000` while developing and add `http://localhost:3000/auth/callback` as a redirect URL.
6. Run:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Email confirmation
For the fastest local test, disable email confirmation temporarily in Supabase Authentication settings. For production, keep confirmation enabled and configure your production Site URL and redirect URLs.

## Deploy
Push the repository to GitHub, import it into Vercel, and add both environment variables to the Vercel project.

## Suggested next portfolio upgrades
- Team invitations and role management
- Edit forms and confirmation dialogs
- Monthly charts
- Invoice generation
- Receipt uploads with Supabase Storage
- Search, filters, pagination, and audit logs
- Automated tests
