import type { DocCategory } from '@/lib/types';
import type {
  VerificationInput,
  VerificationProvider,
  VerificationVerdict,
} from './provider';

// ============================================================
// DigiLocker — Meri Pehchaan OAuth (login/consent layer) +
// Requester API (document access layer).
//
// Implemented against: Meri Pehchaan API spec v2.3 (Sep 2023)
// and Requester API spec v1.12 (Oct 2023). Endpoint paths are
// overridable via DIGILOCKER_BASE_URL so the same code runs
// against sandbox and production.
//
// Activates when these env vars exist (Vercel + .env.local):
//   VERIFICATION_PROVIDER=digilocker
//   DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET
//   DIGILOCKER_REDIRECT_URI, SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const BASE =
  process.env.DIGILOCKER_BASE_URL ?? 'https://digilocker.meripehchaan.gov.in';

// DigiLocker issued-document type codes -> our vault slots.
// TODO(sandbox): confirm exact codes against the Requester spec
// appendix; these are the commonly documented ones.
export const DOCTYPE_MAP: Record<
  string,
  { category: DocCategory; docType: string }
> = {
  ADHAR: { category: 'identity', docType: 'Aadhaar Card' },
  PANCR: { category: 'identity', docType: 'PAN Card' },
  DRVLC: { category: 'identity', docType: 'Driving Licence' },
  SSCER: { category: 'education', docType: '10th Marksheet' },
  HSCER: { category: 'education', docType: '12th Marksheet' },
  DEGCR: { category: 'education', docType: 'College Degree' },
  ITRAC: { category: 'professional', docType: 'ITR' },
};

export interface IssuedDocument {
  name: string;
  type: string; // doctype code, e.g. 'ADHAR'
  uri: string; // DigiLocker document URI (stable id)
  issuer: string;
  issuerid: string;
  date: string;
}

// PKCE helpers (Meri Pehchaan v2.3 requires S256).
export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64Url(bytes);
}

export async function codeChallengeS256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  );
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export class DigiLockerProvider implements VerificationProvider {
  readonly method = 'digilocker' as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.DIGILOCKER_CLIENT_ID &&
        process.env.DIGILOCKER_CLIENT_SECRET &&
        process.env.DIGILOCKER_REDIRECT_URI &&
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  /** Step 1: Meri Pehchaan consent URL (login + document scopes). */
  async buildAuthorizeUrl(state: string, codeVerifier: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.DIGILOCKER_CLIENT_ID!,
      redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
      state,
      code_challenge: await codeChallengeS256(codeVerifier),
      code_challenge_method: 'S256',
      // TODO(sandbox): confirm scope names for issued-docs access
      // in the Requester spec (e.g. 'files.issueddocs avs_parent').
      scope: 'openid files.issueddocs',
    });
    return `${BASE}/public/oauth2/1/authorize?${params}`;
  }

  /** Step 2: exchange the callback code for an access token. */
  async exchangeCodeForToken(
    code: string,
    codeVerifier: string
  ): Promise<{ access_token: string; id_token?: string }> {
    const res = await fetch(`${BASE}/public/oauth2/1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.DIGILOCKER_CLIENT_ID!,
        client_secret: process.env.DIGILOCKER_CLIENT_SECRET!,
        redirect_uri: process.env.DIGILOCKER_REDIRECT_URI!,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) {
      throw new Error(`DigiLocker token exchange failed: ${res.status}`);
    }
    return res.json();
  }

  /** Verified identity of the consenting user (Meri Pehchaan). */
  async getUserName(accessToken: string): Promise<string | null> {
    const res = await fetch(`${BASE}/public/oauth2/1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.name ?? null;
  }

  /** Step 3: list ISSUED documents (issuer-signed; drive uploads excluded). */
  async listIssuedDocuments(accessToken: string): Promise<IssuedDocument[]> {
    const res = await fetch(`${BASE}/public/oauth2/2/files/issued`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`DigiLocker issued-files list failed: ${res.status}`);
    }
    const data = await res.json();
    return (data.items ?? []) as IssuedDocument[];
  }

  /** Step 4: fetch the signed PDF for an issued document. */
  async fetchDocumentPdf(accessToken: string, uri: string): Promise<ArrayBuffer> {
    const res = await fetch(
      `${BASE}/public/oauth2/1/file/${encodeURIComponent(uri)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      throw new Error(`DigiLocker file fetch failed: ${res.status}`);
    }
    return res.arrayBuffer();
  }

  // Single-file verification isn't how DigiLocker works; documents
  // arrive through the consent flow above (see /api/digilocker/*).
  async verifyDocument(_input: VerificationInput): Promise<VerificationVerdict> {
    return {
      status: 'pending',
      method: this.method,
      note: this.isConfigured()
        ? 'Awaiting DigiLocker consent — user must connect their locker.'
        : 'DigiLocker is not configured; manual upload with automated checks applies.',
    };
  }
}
