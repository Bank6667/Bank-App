alter table public.demo_accounts
  add column if not exists support_phone text,
  add column if not exists support_email text,
  add column if not exists website_url text;
