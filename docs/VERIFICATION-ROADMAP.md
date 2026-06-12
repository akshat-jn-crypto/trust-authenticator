# Verification Roadmap: from simulation to issuer-verified

## Trust tiers

| Tier | What it proves | Status |
|---|---|---|
| 1. Integrity (current) | A well-formed file was uploaded to the right place | **Live** — `pg_cron` job in `supabase/automation.sql` |
| 2. AI plausibility | Document *looks* genuine and matches the profile name | Designed, not built (needs Anthropic API key) |
| 3. Issuer verification | The issuing authority confirms the document is real | **This document** — stubbed, inactive |

Only tier 3 is true authenticity: the document (or its data) comes signed
from the source, so there is nothing for the user to forge.

## Option A — DigiLocker (government documents)

DigiLocker is the Government of India's document wallet. Issuers (CBSE,
Income Tax Dept., universities, RTOs) push digitally-signed documents
directly into a citizen's locker. A partner app can, with the user's
consent, fetch those **issued** documents — which are authentic by
construction. (Files the user self-uploaded to their DigiLocker drive are
NOT verified and must be ignored.)

**Covers our categories:** Education (CBSE/state-board marksheets, many
university degrees), Identity (eAadhaar, PAN-linked data, driving licence),
Professional (ITR acknowledgements via Income Tax Dept.). Property records
vary by state (some land-record issuers are on board).

### Onboarding (the blocking step)

1. Register as a Requester organisation on the DigiLocker Partners portal
   (partners.digilocker.gov.in) / API Setu. Requires organisation identity,
   a signed agreement, and approval — individuals/hobby projects are not
   eligible, which is why this integration ships inactive.
2. On approval you receive `client_id` / `client_secret` and sandbox access.

### Flow (OAuth 2.0 authorization code)

```
Dashboard: user clicks "Verify via DigiLocker" on a category
  → GET /api/digilocker/start            (our app, stubbed)
  → redirect to DigiLocker authorize URL  (user logs in + consents)
  → DigiLocker redirects to /api/digilocker/callback?code=…&state=…
  → server exchanges code for access_token
  → server lists the user's ISSUED documents, lets them pick / auto-matches
  → server fetches the signed document + metadata (XML includes issuer ID)
  → server stores: issuer, doc URI, SHA-256 of payload, verified_at
  → documents row status = 'verified', method = 'digilocker'
```

Endpoint names and request shapes change between API versions — confirm
against the current API Setu specification at integration time. The stubs
in `src/lib/verification/digilocker.ts` mark every such point with TODO.

### What we store (privacy-by-design)

- Issuer code, document type, DigiLocker document URI, payload hash,
  consent timestamp. **Never** the Aadhaar number; never the raw eAadhaar
  XML. India's DPDP Act applies — collect the minimum, log consent.

## Option B — Commercial KYC APIs (faster, paid)

IDfy, Signzy, Karza, HyperVerge and similar vendors offer REST APIs with
much lighter onboarding (KYB + prepaid credits, typically ₹2–15 per call):
PAN name-match, Aadhaar OKYC, bank-account penny-drop, DL/Voter-ID lookup.
Good fit when DigiLocker partner approval is out of reach. Same provider
interface; implement `KycApiProvider` alongside the DigiLocker one.

## Data model changes (run when activating)

```sql
alter table public.documents
  add column verification_method text not null default 'simulated'
    check (verification_method in ('simulated','digilocker','kyc_api')),
  add column issuer text,
  add column provider_ref text,          -- DigiLocker URI / vendor txn id
  add column payload_sha256 text;

-- Surface the tier publicly so badges can say "Issuer-verified":
-- extend get_trust_status to return max(verification_method) per category.
```

## UX changes when live

- Category cards gain a "Verify via DigiLocker" button next to upload.
- Public badge gets two tiers: grey-green "Auto-verified" vs solid green
  "Issuer-verified ✓" — issuer-verified categories weigh more in the
  Trust Score (suggested: 2× weight).

## Activation checklist

1. Obtain credentials (Option A or B).
2. Run the SQL above; update `get_trust_status`.
3. Set env vars on Vercel: `VERIFICATION_PROVIDER=digilocker`,
   `DIGILOCKER_CLIENT_ID`, `DIGILOCKER_CLIENT_SECRET`,
   `DIGILOCKER_REDIRECT_URI=https://trust-authenticator.vercel.app/api/digilocker/callback`,
   plus `SUPABASE_SERVICE_ROLE_KEY` (server-only; the callback must update
   document status, which owner RLS forbids).
4. Replace the TODOs in `src/lib/verification/digilocker.ts` against the
   current API spec; test in DigiLocker sandbox; deploy.
5. Optionally `select cron.unschedule('auto-verify-documents');` to retire
   the simulation, or keep it as the fallback for Property docs.
