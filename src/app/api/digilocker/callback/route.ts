import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DigiLockerProvider,
  DOCTYPE_MAP,
  sha256Hex,
} from '@/lib/verification/digilocker';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

// Step 2 of DigiLocker linking. After user consent, DigiLocker
// redirects here with ?code&state. We then:
//   1. validate state (CSRF) and burn it
//   2. exchange code for an access token (PKCE)
//   3. mark the profile identity as DigiLocker-verified
//   4. pull issued (issuer-signed) documents into the vault,
//      already 'verified' with method='digilocker'
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dashboard = (q: string) =>
    NextResponse.redirect(`${url.origin}/dashboard?digilocker=${q}`);

  const provider = new DigiLockerProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: 'DigiLocker verification is not yet active.' },
      { status: 501 }
    );
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return dashboard('error');

  const admin = createAdminClient();

  // 1. CSRF check: state must exist, be fresh, and is single-use.
  const { data: session } = await admin
    .from('digilocker_sessions')
    .select('user_id, code_verifier, created_at')
    .eq('state', state)
    .maybeSingle();
  if (!session) return dashboard('error');
  await admin.from('digilocker_sessions').delete().eq('state', state);
  if (Date.now() - new Date(session.created_at).getTime() > STATE_MAX_AGE_MS) {
    return dashboard('expired');
  }

  try {
    // 2. Code -> token.
    const { access_token } = await provider.exchangeCodeForToken(
      code,
      session.code_verifier
    );

    // 3. Government-verified identity onto the profile.
    const verifiedName = await provider.getUserName(access_token);
    await admin
      .from('profiles')
      .update({ digilocker_verified: true, digilocker_name: verifiedName })
      .eq('id', session.user_id);

    // 4. Pull issued documents we have vault slots for.
    const issued = await provider.listIssuedDocuments(access_token);
    let imported = 0;

    for (const doc of issued) {
      const slot = DOCTYPE_MAP[doc.type];
      if (!slot) continue;

      // Idempotent: skip documents already imported.
      const { data: existing } = await admin
        .from('documents')
        .select('id')
        .eq('provider_ref', doc.uri)
        .maybeSingle();
      if (existing) continue;

      const pdf = await provider.fetchDocumentPdf(access_token, doc.uri);
      const filePath = `${session.user_id}/digilocker-${crypto.randomUUID()}.pdf`;

      const { error: uploadError } = await admin.storage
        .from('documents')
        .upload(filePath, pdf, { contentType: 'application/pdf' });
      if (uploadError) continue;

      const { error: insertError } = await admin.from('documents').insert({
        owner_id: session.user_id,
        category: slot.category,
        doc_type: slot.docType,
        file_path: filePath,
        file_name: `${doc.name}.pdf`,
        status: 'verified',
        verification_method: 'digilocker',
        issuer: doc.issuer,
        provider_ref: doc.uri,
        payload_sha256: await sha256Hex(pdf),
        reviewer_note: `Issuer-signed document fetched from DigiLocker (${doc.issuer}).`,
        reviewed_at: new Date().toISOString(),
      });
      if (!insertError) imported++;
    }

    return dashboard(`success&imported=${imported}`);
  } catch (e) {
    console.error('DigiLocker callback failed:', e);
    return dashboard('error');
  }
}
