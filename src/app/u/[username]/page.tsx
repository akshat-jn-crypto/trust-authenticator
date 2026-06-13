import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TrustScoreBar from '@/components/TrustScoreBar';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  type DocCategory,
  type Profile,
  type PublicClaim,
  type TrustStatusRow,
} from '@/lib/types';

type FactTier = 'digilocker' | 'matched' | 'self';
const TIER_RANK: Record<FactTier, number> = { self: 1, matched: 2, digilocker: 3 };

interface Fact {
  key: string;
  value: string;
  tier: FactTier;
}

// Collapse a category's per-document claims into ONE entry per unique
// fact, tagged with the strongest verification source backing it.
// (The same "Employer: Axis Bank" stated on two documents shows once,
// at the highest trust level any of them reached.)
function dedupeCategoryFacts(claims: PublicClaim[]): Fact[] {
  const byFact = new Map<string, Fact>();
  for (const claim of claims) {
    const issuer = claim.verification_method === 'digilocker';
    const overallMatch = claim.details_check?.overall === 'match';
    for (const [key, value] of Object.entries(claim.details ?? {})) {
      if (!value) continue;
      let tier: FactTier = 'self';
      if (issuer) tier = 'digilocker';
      else if (overallMatch || claim.details_check?.fields?.[key]?.matches === true)
        tier = 'matched';
      const id = `${key.trim().toLowerCase()}=${value.trim().toLowerCase()}`;
      const prev = byFact.get(id);
      if (!prev || TIER_RANK[tier] > TIER_RANK[prev.tier]) {
        byFact.set(id, { key, value, tier });
      }
    }
  }
  return [...byFact.values()];
}

function FactBadge({ tier }: { tier: FactTier }) {
  if (tier === 'digilocker') {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white"
        title="Fetched digitally signed from the issuing authority via DigiLocker"
      >
        ✓ DigiLocker verified
      </span>
    );
  }
  if (tier === 'matched') {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white"
        title="An automated check confirmed this matches the uploaded document"
      >
        ✓ Matches uploaded document
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-300"
      title="Stated by the profile owner; not verified"
    >
      Self-declared
    </span>
  );
}

// THE TRUST LINK — public page, works for anonymous visitors.
// It only ever sees aggregate counts from the get_trust_status RPC;
// document rows and files are unreachable from here by RLS.
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle<Profile>();

  if (!profile) notFound();

  const { data } = await supabase.rpc('get_trust_status', {
    p_username: profile.username,
  });
  const trustRows = (data ?? []) as TrustStatusRow[];

  const { data: claimData } = await supabase.rpc('get_public_claims', {
    p_username: profile.username,
  });
  const claims = (claimData ?? []) as PublicClaim[];
  const claimsByCategory = new Map<DocCategory, PublicClaim[]>();
  for (const c of claims) {
    const list = claimsByCategory.get(c.category) ?? [];
    list.push(c);
    claimsByCategory.set(c.category, list);
  }

  const byCategory = new Map(trustRows.map((r) => [r.category, r]));
  const totals = trustRows.reduce(
    (acc, r) => ({
      total: acc.total + Number(r.total),
      verified: acc.verified + Number(r.verified),
      issuerVerified: acc.issuerVerified + Number(r.issuer_verified ?? 0),
    }),
    { total: 0, verified: 0, issuerVerified: 0 }
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {/* Identity card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt={profile.full_name}
            className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-slate-100"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-700 text-2xl font-bold text-white">
            {profile.full_name.charAt(0)}
          </div>
        )}
        <h1 className="mt-4 flex items-center justify-center gap-1.5 text-2xl font-bold text-slate-900">
          {profile.full_name}
          {profile.digilocker_verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20"
              title="Identity verified via DigiLocker (Government of India)"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M10 1.944A11.954 11.954 0 0 1 2.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0 1 10 1.944ZM11 14a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm0-7a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V7Z"
                  clipRule="evenodd"
                />
              </svg>
              Govt-verified ID
            </span>
          )}
        </h1>
        <p className="text-sm text-slate-400">@{profile.username}</p>
        {profile.bio && (
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            {profile.bio}
          </p>
        )}

        <div className="mt-6 text-left">
          <TrustScoreBar
            verified={totals.verified}
            issuerVerified={totals.issuerVerified}
            total={totals.total}
          />
        </div>
      </div>

      {/* Verification checklist */}
      <div className="mt-6 space-y-3">
        {CATEGORY_ORDER.map((category) => {
          const row = byCategory.get(category);
          const total = Number(row?.total ?? 0);
          const issuerVerified = Number(row?.issuer_verified ?? 0);

          const categoryClaims = claimsByCategory.get(category) ?? [];
          const facts = dedupeCategoryFacts(categoryClaims);

          return (
            <div
              key={category}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {CATEGORIES[category].label}
                  </p>
                  <p className="text-xs text-slate-400">
                    {total === 0
                      ? 'No documents submitted'
                      : `${total} document${total > 1 ? 's' : ''} on file`}
                  </p>
                </div>

                {total === 0 ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                    Not provided
                  </span>
                ) : issuerVerified > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white ring-1 ring-inset ring-emerald-700">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Issuer-verified
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                    {facts.length > 0 ? 'See details' : 'On file'}
                  </span>
                )}
              </div>

              {/* Unique facts — each shown once, with what backs it.
                  The document file itself is never exposed here. */}
              {facts.length > 0 && (
                <dl className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {facts.map((fact, i) => (
                    <div
                      key={i}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                    >
                      <dt className="text-slate-400">{fact.key}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{fact.value}</span>
                        <FactBadge tier={fact.tier} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust-tier legend — keeps the badges honest */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="mb-2 font-semibold text-slate-700">What each label means</p>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">
            ✓ DigiLocker verified
          </span>
          <span>
            Fetched digitally signed from the issuing authority via DigiLocker —
            genuine and tamper-proof.
          </span>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-teal-600 px-2 py-0.5 font-semibold text-white">
            ✓ Matches uploaded document
          </span>
          <span>
            An automated check read the user&apos;s uploaded document and
            confirmed this detail appears in it. The document&apos;s authenticity
            is <strong>not</strong> issuer-verified.
          </span>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 ring-1 ring-inset ring-slate-300">
            Self-declared
          </span>
          <span>
            Stated by the profile owner; not checked against any document.
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Original documents are never shown on this page.
      </p>
    </div>
  );
}
