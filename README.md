# Finance Experience — simulator starter

A responsive, fictional finance-interface simulator. It is not a bank, does not hold funds, and does not initiate payments. The persistent simulator notice is intentional and cannot be removed from customer-facing screens.

## Stack
- React + TypeScript + Vite
- Supabase Auth + Postgres (schema included)
- Vercel deployment

## Run locally
1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase project URL and publishable/anon key.
4. Run `npm install` then `npm run dev`.

The app can render a local preview without Supabase configured. Sign-in and database features require Supabase.

## Supabase setup
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Authentication, create your first administrator user.
4. In SQL Editor, promote that user's profile:
   `update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';`
5. Deploy the Edge Function:
   `supabase functions deploy create-customer`
6. Set the Edge Function secret `SUPABASE_SERVICE_ROLE_KEY` in Supabase Functions secrets. Never put this key in Vite variables or GitHub.
7. Configure Auth Site URL and redirect URLs to include your Vercel domain.

## GitHub + Vercel
1. Create a **private** GitHub repository and upload the contents of this folder (not the enclosing folder).
2. In Vercel choose Add New → Project → Import the repository.
3. Framework preset: Vite; Build command: `npm run build`; Output directory: `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel Environment Variables, then deploy.
5. Redeploy after changing environment variables.

## Current scope
This starter provides a working responsive shell, sign-in, admin/customer views, demo customer creation through a server-side Edge Function, demo ledger data model, and persistent disclosure. The admin interface is a foundation; brand uploads, granular balance/ledger editing, and production-grade support inbox workflows are follow-on implementation tasks.

## Safety
Use fictional names, sample values, and test-only credentials. Never ask customers for real banking passwords, card details, OTPs, or PINs. Transfers are simulated locally and are not submitted to any payment network. Keep the simulator disclosure visible.
