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
      { error: 'Auto-check is not configured (no OPENAI_API_KEY).' },
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

  // Download the private file.
  const { data: blob, error: dlError } = await admin.storage
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
      { error: 'The verification service could not process this document.' },
      { status: 502 }
    );
  }

  // Persist the result (service role bypasses the owner-write guard).
  await admin.from('documents').update({ details_check: result }).eq('id', doc.id);

  return NextResponse.json({ result });
}
