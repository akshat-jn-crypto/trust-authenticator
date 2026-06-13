-- ============================================================
-- CLAIMS / DETAILS — add-on to schema.sql (+ digilocker.sql)
-- Run in: Supabase Dashboard -> SQL Editor
--
-- Adds owner-entered, shareable "claims" to each document (e.g.
-- Institution / Year / Qualification) that appear on the public
-- Trust Link, WITHOUT ever exposing the document file itself.
-- ============================================================

-- ---------- 1. details column -------------------------------
alter table public.documents
  add column if not exists details jsonb not null default '{}'::jsonb;

-- ---------- 2. let owners edit ONLY their details -----------
-- Owners can update their own rows, but a trigger (below) stops
-- them from touching verification fields, so nobody can mark
-- their own document "verified" by hand.
drop policy if exists "Owners can update their own document details" on public.documents;
create policy "Owners can update their own document details"
  on public.documents for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create or replace function public.protect_document_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When an authenticated, non-admin user updates a row (i.e. the
  -- owner editing details), force all verification fields back to
  -- their previous values. Cron / service-role updates run with no
  -- auth.uid(), so they are unaffected.
  if auth.uid() is not null and not public.is_admin() then
    new.status              := old.status;
    new.verification_method := old.verification_method;
    new.issuer              := old.issuer;
    new.provider_ref        := old.provider_ref;
    new.payload_sha256      := old.payload_sha256;
    new.reviewer_note       := old.reviewer_note;
    new.reviewed_at         := old.reviewed_at;
    new.owner_id            := old.owner_id;
    new.file_path           := old.file_path;
  end if;
  return new;
end;
$$;

drop trigger if exists documents_protect_verification on public.documents;
create trigger documents_protect_verification
  before update on public.documents
  for each row execute function public.protect_document_verification();

-- ---------- 3. public claims RPC ----------------------------
-- Returns shareable claims for VERIFIED documents only. Never
-- returns file_path / file_name, so the document stays private.
create or replace function public.get_public_claims(p_username text)
returns table (
  category            public.doc_category,
  doc_type            text,
  details             jsonb,
  verification_method text,
  issuer              text
)
language sql
security definer
set search_path = public
stable
as $$
  select d.category, d.doc_type, d.details, d.verification_method, d.issuer
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where p.username = p_username
    and d.status = 'verified'
    and d.details <> '{}'::jsonb
  order by d.category, d.doc_type;
$$;

grant execute on function public.get_public_claims(text) to anon, authenticated;
