import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TrustScoreBar from '@/components/TrustScoreBar';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  type Profile,
  type TrustStatusRow,
} from '@/lib/types';

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
          const verified = Number(row?.verified ?? 0);
          const total = Number(row?.total ?? 0);
          const issuerVerified = Number(row?.issuer_verified ?? 0);
          const isVerified = verified > 0;

          return (
            <div
              key={category}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {CATEGORIES[category].label}
                </p>
                <p className="text-xs text-slate-400">
                  {total === 0
                    ? 'No documents submitted'
                    : issuerVerified > 0
                      ? `${issuerVerified} of ${total} issuer-verified`
                      : `${verified} of ${total} auto-checked`}
                </p>
              </div>

              {isVerified ? (
                issuerVerified > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-sm font-semibold text-white ring-1 ring-inset ring-emerald-700"
                    title="Contains documents digitally signed by the issuing authority (via DigiLocker)"
                  >
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
                  <span
                    className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300"
                    title="Format and integrity checks passed — not authenticity-verified"
                  >
                    Auto-checked
                  </span>
                )
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-500">
                  {total === 0 ? 'Not provided' : 'Under review'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Trust-tier legend — keeps the badges honest */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="mb-2 font-semibold text-slate-700">What these badges mean</p>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 font-semibold text-white">
            ✓ Issuer-verified
          </span>
          <span>
            Document was fetched digitally signed from the issuing authority via
            DigiLocker. Cannot be forged.
          </span>
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 ring-1 ring-inset ring-slate-300">
            Auto-checked
          </span>
          <span>
            User-uploaded file that passed format and integrity checks only.
            Its authenticity has <strong>not</strong> been confirmed with the
            issuer.
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Original documents are never shown on this page.
      </p>
    </div>
  );
}
