-- ============================================================
-- AUTOMATED VERIFICATION — add-on to schema.sql
-- Run this in: Supabase Dashboard -> SQL Editor
--
-- Replaces manual admin review for the happy path: a pg_cron
-- job checks pending documents every minute and verifies them
-- automatically. The admin panel still works as an override
-- (reject / reset beats automation, since it only touches
-- documents that are still 'pending').
-- ============================================================

create extension if not exists pg_cron;

-- The checks are deliberately simple (this simulates a real
-- verification pipeline): file type must be on the allow-list,
-- the file must live in the owner's storage folder, and the
-- document gets a ~1 minute "review window" so the Pending ->
-- Verified flow is visible in the UI.
create or replace function public.auto_verify_documents()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Fail anything that doesn't pass basic integrity checks.
  update public.documents
  set status        = 'rejected',
      reviewer_note = 'Automated check failed: unsupported file type or invalid storage path.',
      reviewed_at   = now()
  where status = 'pending'
    and (
      lower(file_name) !~ '\.(pdf|jpg|jpeg|png|webp)$'
      or split_part(file_path, '/', 1) <> owner_id::text
    );

  -- Verify everything else once its review window has passed.
  update public.documents
  set status        = 'verified',
      reviewer_note = 'Auto-verified: format and integrity checks passed.',
      reviewed_at   = now()
  where status = 'pending'
    and created_at < now() - interval '1 minute';
end;
$$;

-- Run every minute. Re-running this statement just updates the
-- existing job, so the file is safe to execute more than once.
select cron.schedule(
  'auto-verify-documents',
  '* * * * *',
  $$ select public.auto_verify_documents(); $$
);

-- To pause automation later (back to manual admin review):
--   select cron.unschedule('auto-verify-documents');
