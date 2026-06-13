import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  checkDetailsAgainstDocument,
  isContentCheckConfigured,
} from '@/lib/verification/content-check';
import type { DocumentRow } from '@/lib/types';

// Runs the AI auto-check: reads the owner's document and compares it
// against the claims they typed. Server-only — the result is written
// with the service-role client so a user can't forge a "match".
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isContentCheckConfigured()) {
    return NextResponse.json(
      { error: 'Auto-check is not configured (no GEMENI_API_KEY).' },
      { status: 501 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const { docId } = await request.json().catch(() => ({ docId: null }));
  if (!docId) {
    return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
  }

  // Fetch the document via the user's session, so RLS confirms ownership.
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .maybeSingle<DocumentRow>();
  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const claimed = doc.details ?? {};
  if (Object.keys(claimed).length === 0) {
    return NextResponse.json(
      { error: 'Add some details before running the check.' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Download the private file using the OWNER's session — storage RLS
  // allows owners to read their own folder (the same path "View" uses).
  // The newer sb_secret_ key isn't honoured as a privileged role by the
  // Storage API, so the service-role client can't be used for this read.
  const { data: blob, error: dlError } = await supabase.storage
    .from('documents')
    .download(doc.file_path);
  if (dlError || !blob) {
    console.error('Storage download failed:', dlError, 'path:', doc.file_path);
    return NextResponse.json(
      { error: `Could not read the document: ${dlError?.message ?? 'empty response'}` },
      { status: 500 }
    );
  }

  let result;
  try {
    result = await checkDetailsAgainstDocument(
      await blob.arrayBuffer(),
      doc.file_name,
      claimed
    );
  } catch (e) {
    console.error('Content check failed:', e);
    return NextResponse.json(
      { error: `Verification failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }

  // Persist the result (service role bypasses the owner-write guard).
  const { data: updated, error: upErr } = await admin
    .from('documents')
    .update({ details_check: result })
    .eq('id', doc.id)
    .select('id');
  if (upErr) {
    console.error('details_check write failed:', upErr);
    return NextResponse.json(
      { error: `Check ran but could not be saved: ${upErr.message}` },
      { status: 500 }
    );
  }
  if (!updated || updated.length === 0) {
    // 0 rows changed with no error = the service-role client isn't
    // privileged (likely the publishable key is in SUPABASE_SERVICE_ROLE_KEY).
    return NextResponse.json(
      {
        error:
          'Check ran but the result could not be saved — the SUPABASE_SERVICE_ROLE_KEY appears to be the publishable key, not the secret key.',
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ result });
}
