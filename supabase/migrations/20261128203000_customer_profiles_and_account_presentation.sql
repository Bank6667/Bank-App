alter table public.profiles
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists country_name text,
  add column if not exists country_code text;

alter table public.demo_accounts
  add column if not exists country_name text not null default 'Nigeria',
  add column if not exists country_code text not null default 'NG',
  add column if not exists account_number text,
  add column if not exists account_type text not null default 'Everyday Account',
  add column if not exists account_status text not null default 'Active',
  add column if not exists branch_name text,
  add column if not exists branch_address text,
  add column if not exists cardholder_name text,
  add column if not exists card_last4 text,
  add column if not exists card_expiry text,
  add column if not exists card_status text not null default 'Inactive',
  add column if not exists card_image_url text,
  add column if not exists bank_banner_url text;

update public.demo_accounts
set country_name = coalesce(nullif(country_name, ''), 'Nigeria'),
    country_code = upper(coalesce(nullif(country_code, ''), 'NG')),
    account_type = coalesce(nullif(account_type, ''), 'Everyday Account'),
    account_status = coalesce(nullif(account_status, ''), 'Active'),
    card_status = coalesce(nullif(card_status, ''), 'Inactive')
where country_name is null or country_name = ''
   or country_code is null or country_code = ''
   or account_type is null or account_type = ''
   or account_status is null or account_status = ''
   or card_status is null or card_status = '';

create unique index if not exists demo_accounts_account_number_unique
  on public.demo_accounts (account_number)
  where account_number is not null and account_number <> '';

alter table public.demo_accounts
  add constraint demo_accounts_currency_code_format
  check (currency_code ~ '^[A-Z]{3}$') not valid;
alter table public.demo_accounts validate constraint demo_accounts_currency_code_format;

alter table public.demo_accounts
  add constraint demo_accounts_country_code_format
  check (country_code ~ '^[A-Z]{2}$') not valid;
alter table public.demo_accounts validate constraint demo_accounts_country_code_format;

comment on column public.demo_accounts.account_number is 'Fictional simulator account identifier only; not a real bank account number.';
comment on column public.demo_accounts.card_last4 is 'Last four display digits for a fictional simulator card; never store a full payment card number.';
comment on column public.demo_accounts.currency_code is 'ISO 4217 display currency for simulated values; changing it does not convert the stored balance.';
