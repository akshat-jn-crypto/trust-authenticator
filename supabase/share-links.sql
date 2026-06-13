-- ============================================================
-- SHARE LINKS — add-on to schema.sql + claims.sql + content-check.sql
-- Run in: Supabase Dashboard -> SQL Editor
--
-- Lets an owner create MANY scoped links to their profile. Each
-- link picks which documents/fields are visible, and per document
-- whether the underlying file may be viewed. Public pages read
-- these server-side with the service role (anon never reads the
-- table directly), so the config is the access boundary.
-- ============================================================

create table public.share_links (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  slug       text unique not null,          -- random, unguessable; in the URL /s/<slug>
  name       text not null,                 -- e.g. "For HDFC Bank"
  -- config shape:
  -- { "documents": { "<documentId>": { "show_document": bool, "fields": ["Employer", ...] } } }
  config     jsonb not null default '{"documents":{}}'::jsonb,
  created_at timestamptz not null default now()
);

create index share_links_owner_idx on public.share_links (owner_id);

alter table public.share_links enable row level security;

-- Owner manages their own links. No anon/public policy — the public
-- /s/<slug> page reads via the service role and enforces the config.
create policy "Owners manage their own share links"
  on public.share_links for all
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
