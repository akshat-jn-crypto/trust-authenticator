-- ============================================================
-- DIGILOCKER INTEGRATION — add-on to schema.sql
-- Run this in: Supabase Dashboard -> SQL Editor
-- Safe to run before credentials exist; nothing here activates
-- the flow by itself.
-- ============================================================

-- ---------- 1. OAuth session state (CSRF + PKCE) -------------
-- Written/read only by the server with the service-role key, so
-- RLS is enabled with no policies: clients can never touch it.
create table public.digilocker_sessions (
  state         uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  code_verifier text not null,
  created_at    timestamptz not null default now()
);

alter table public.digilocker_sessions enable row level security;

-- ---------- 2. Issuer-verification metadata ------------------

alter table public.documents
  add column verification_method text not null default 'simulated'
    check (verification_method in ('simulated', 'digilocker', 'kyc_api')),
  add column issuer         text,
  add column provider_ref   text,   -- DigiLocker document URI
  add column payload_sha256 text;

create unique index documents_provider_ref_idx
  on public.documents (provider_ref) where provider_ref is not null;

alter table public.profiles
  add column digilocker_verified boolean not null default false,
  add column digilocker_name     text;

-- ---------- 3. Public RPC now reports the trust tier ---------
-- issuer_verified = docs that arrived signed from DigiLocker.

drop function if exists public.get_trust_status(text);

create or replace function public.get_trust_status(p_username text)
returns table (
  category        public.doc_category,
  total           bigint,
  verified        bigint,
  issuer_verified bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select d.category,
         count(*)                                                  as total,
         count(*) filter (where d.status = 'verified')             as verified,
         count(*) filter (where d.status = 'verified'
                            and d.verification_method = 'digilocker') as issuer_verified
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where p.username = p_username
  group by d.category;
$$;

grant execute on function public.get_trust_status(text) to anon, authenticated;
