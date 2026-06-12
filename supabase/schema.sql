-- ============================================================
-- TRUST AUTHENTICATOR — Supabase schema
-- Run this whole file in: Supabase Dashboard -> SQL Editor
-- ============================================================

-- ---------- 1. ENUMS ----------------------------------------

create type public.doc_category as enum (
  'professional',  -- joining letters, salary slips, ITR
  'identity',      -- birth certificate, government IDs
  'education',     -- 10th/12th marksheets, degrees
  'property'       -- rent agreements, property deeds
);

create type public.doc_status as enum ('pending', 'verified', 'rejected');

-- ---------- 2. PROFILES -------------------------------------
-- One row per auth user. Publicly readable (powers the Trust
-- Link page) so never store sensitive data here.

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique not null
             check (username ~ '^[a-z0-9_]{3,30}$'),
  full_name  text not null,
  bio        text,
  avatar_url text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3. DOCUMENTS ------------------------------------
-- Metadata only. The file itself lives in the private
-- 'documents' Storage bucket at the path in file_path.

create table public.documents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles (id) on delete cascade,
  category      public.doc_category not null,
  doc_type      text not null,            -- e.g. 'Salary Slip', 'Aadhaar Card'
  file_path     text not null,            -- storage object path: <owner_id>/<uuid>-<name>
  file_name     text not null,            -- original file name for display
  status        public.doc_status not null default 'pending',
  reviewer_note text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index documents_owner_idx    on public.documents (owner_id);
create index documents_category_idx on public.documents (owner_id, category);

-- ---------- 4. HELPERS --------------------------------------

-- security definer so RLS policies on documents can check the
-- caller's admin flag without recursing into profiles' own RLS.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- 5. ROW LEVEL SECURITY ---------------------------

alter table public.profiles  enable row level security;
alter table public.documents enable row level security;

-- PROFILES: readable by anyone (Trust Link page), writable only by owner.
create policy "Profiles are publicly readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid()));

-- DOCUMENTS: owner has full access; admins can review.
-- No anon policy at all -> raw document rows are never public.
create policy "Owners can view their own documents"
  on public.documents for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Owners can add documents"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = owner_id and status = 'pending');

create policy "Owners can delete their own documents"
  on public.documents for delete
  to authenticated
  using (auth.uid() = owner_id);

create policy "Admins can view all documents"
  on public.documents for select
  to authenticated
  using (public.is_admin());

create policy "Admins can update document status"
  on public.documents for update
  to authenticated
  using (public.is_admin());

-- ---------- 6. PUBLIC TRUST STATUS RPC ----------------------
-- The Trust Link page calls this. SECURITY DEFINER lets it
-- aggregate over documents the anon role cannot read directly,
-- and it returns ONLY counts per category — never file paths,
-- names, or any document content.

create or replace function public.get_trust_status(p_username text)
returns table (
  category public.doc_category,
  total    bigint,
  verified bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select d.category,
         count(*)                                    as total,
         count(*) filter (where d.status = 'verified') as verified
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where p.username = p_username
  group by d.category;
$$;

grant execute on function public.get_trust_status(text) to anon, authenticated;

-- ---------- 7. STORAGE BUCKETS + POLICIES -------------------

-- Private bucket for sensitive documents (10 MB cap, docs/images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
);

-- Public bucket for profile pictures (2 MB cap)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Documents: files live under a folder named after the owner's
-- user id, e.g. "9f3c.../passport.pdf". Only that user (or an
-- admin, for review) can touch them.
create policy "Users manage files in their own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read files in their own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete files in their own folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins can read all documents for review"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and public.is_admin());

-- Avatars: world-readable, user writes only their own folder.
create policy "Avatars are publicly readable"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

create policy "Users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- 8. MAKE YOURSELF ADMIN (run after signing up) ----
-- update public.profiles set is_admin = true where username = 'your_username';
