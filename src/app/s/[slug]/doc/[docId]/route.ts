import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ShareLink } from '@/lib/types';

// Serves a document file for a share link — ONLY if that link's config
// marks the document as viewable. Redirects to a short-lived signed URL.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; docId: string }> }
) {
  const { slug, docId } = await params;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from('share_links')
    .select('owner_id, config')
    .eq('slug', slug)
    .maybeSingle<Pick<ShareLink, 'owner_id' | 'config'>>();
  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  const docCfg = link.config?.documents?.[docId];
  if (!docCfg?.show_document) {
    return NextResponse.json(
      { error: 'This document is not shared on this link.' },
      { status: 403 }
    );
  }

  const { data: doc } = await admin
    .from('documents')
    .select('file_path, owner_id')
    .eq('id', docId)
    .maybeSingle<{ file_path: string; owner_id: string }>();
  // Guard against a config referencing someone else's document.
  if (!doc || doc.owner_id !== link.owner_id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from('documents')
    .createSignedUrl(doc.file_path, 120);
  if (error || !signed) {
    console.error('Signed URL failed:', error);
    return NextResponse.json(
      { error: 'Could not open the document.' },
      { status: 500 }
    );
  }

  return NextResponse.redirect(signed.signedUrl);
}
