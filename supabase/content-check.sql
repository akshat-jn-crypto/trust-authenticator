-- ============================================================
-- CONTENT CHECK — add-on to schema.sql + claims.sql
-- Run in: Supabase Dashboard -> SQL Editor
--
-- Stores the result of the AI "do the typed details match the
-- document?" check. Written ONLY by the server (service role);
-- the protection trigger blocks owners from forging a match.
-- ============================================================

-- Result shape (jsonb):
--   { "overall": "match" | "mismatch" | "partial",
--     "fields": { "<Field>": { "matches": bool, "found": text|null } },
--     "note": text, "model": text, "checked_at": timestamptz }
alter table public.documents
  add column if not exists details_check jsonb;

-- Guard details_check the same way verification fields are guarded:
-- an authenticated non-admin (the owner) cannot set it; only the
-- server (no auth.uid()) or an admin can.
create or replace function public.protect_document_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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
    new.details_check       := old.details_check;
  end if;
  return new;
end;
$$;

-- Surface the check result on the public Trust Link.
-- DROP first: CREATE OR REPLACE cannot add a column to the return
-- table of an existing function (Postgres errors), so we replace it.
drop function if exists public.get_public_claims(text);

create or replace function public.get_public_claims(p_username text)
returns table (
  category            public.doc_category,
  doc_type            text,
  details             jsonb,
  verification_method text,
  issuer              text,
  details_check       jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select d.category, d.doc_type, d.details, d.verification_method,
         d.issuer, d.details_check
  from public.documents d
  join public.profiles p on p.id = d.owner_id
  where p.username = p_username
    and d.status = 'verified'
    and d.details <> '{}'::jsonb
  order by d.category, d.doc_type;
$$;

grant execute on function public.get_public_claims(text) to anon, authenticated;
