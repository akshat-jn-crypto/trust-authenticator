import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  DigiLockerProvider,
  generateCodeVerifier,
} from '@/lib/verification/digilocker';

// Step 1 of DigiLocker linking: store CSRF state + PKCE verifier,
// then send the signed-in user to the Meri Pehchaan consent screen.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const provider = new DigiLockerProvider();
  if (!provider.isConfigured()) {
    return NextResponse.json(
      {
        error: 'DigiLocker verification is not yet active.',
        detail:
          'This deployment has no DigiLocker partner credentials. See docs/VERIFICATION-ROADMAP.md for the activation checklist.',
      },
      { status: 501 }
    );
  }

  const admin = createAdminClient();
  const codeVerifier = generateCodeVerifier();
  const { data: session, error } = await admin
    .from('digilocker_sessions')
    .insert({ user_id: user.id, code_verifier: codeVerifier })
    .select('state')
    .single();

  if (error || !session) {
    return NextResponse.json(
      { error: 'Could not start DigiLocker session. Did you run supabase/digilocker.sql?' },
      { status: 500 }
    );
  }

  return NextResponse.redirect(
    await provider.buildAuthorizeUrl(session.state, codeVerifier)
  );
}
