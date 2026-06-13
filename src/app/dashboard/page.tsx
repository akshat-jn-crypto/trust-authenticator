import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import UploadComponent from '@/components/UploadComponent';
import DigiLockerFetchButton from '@/components/DigiLockerFetchButton';
import DocumentList from '@/components/DocumentList';
import TrustScoreBar from '@/components/TrustScoreBar';
import CopyLinkButton from '@/components/CopyLinkButton';
import SetPasswordCard from '@/components/SetPasswordCard';
import ShareLinkManager from '@/components/ShareLinkManager';
import {
  CATEGORIES,
  CATEGORY_ORDER,
  type DocumentRow,
  type Profile,
} from '@/lib/types';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect('/onboarding');

  const { data: documents } = await supabase
    .from('documents')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
    .returns<DocumentRow[]>();

  const docs = documents ?? [];
  const verifiedCount = docs.filter((d) => d.status === 'verified').length;
  const issuerVerifiedCount = docs.filter(
    (d) => d.status === 'verified' && d.verification_method === 'digilocker'
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-lg font-bold text-white">
              {profile.full_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
              {profile.full_name}
              {profile.digilocker_verified && (
                <span
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20"
                  title="Identity verified via DigiLocker"
                >
                  Govt-verified ID
                </span>
              )}
            </h1>
            <Link
              href={`/u/${profile.username}`}
              className="text-sm text-brand-700 hover:underline"
            >
              /u/{profile.username}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyLinkButton username={profile.username} />
          {profile.is_admin && (
            <Link
              href="/admin"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {/* Trust score */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <TrustScoreBar
          verified={verifiedCount}
          issuerVerified={issuerVerifiedCount}
          total={docs.length}
        />
      </div>

      {/* Scoped share links */}
      <div className="mt-8">
        <ShareLinkManager documents={docs} />
      </div>

      {/* Vault sections */}
      <div className="mt-8 space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const categoryDocs = docs.filter((d) => d.category === category);
          return (
            <section
              key={category}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-3">
                <h2 className="font-semibold text-slate-900">
                  {CATEGORIES[category].label}
                </h2>
                <p className="text-sm text-slate-500">
                  {CATEGORIES[category].description}
                </p>
              </div>
              <DocumentList documents={categoryDocs} />
              {CATEGORIES[category].digilocker ? (
                <div className="mt-3 space-y-2">
                  <DigiLockerFetchButton
                    fetchable={CATEGORIES[category].digilocker}
                  />
                  <p className="text-center text-xs text-slate-400">
                    or upload manually
                  </p>
                  <UploadComponent category={category} />
                </div>
              ) : (
                <div className="mt-3">
                  <UploadComponent category={category} />
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Account settings */}
      <div className="mt-8">
        <SetPasswordCard />
      </div>
    </div>
  );
}
