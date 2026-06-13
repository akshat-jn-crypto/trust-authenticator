import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  CATEGORIES,
  type DocumentRow,
  type Profile,
  type ShareLink,
} from '@/lib/types';

// A SCOPED share link. Read entirely server-side with the service
// role; only what the link's config permits is rendered. The file
// is never inlined — it's served (when allowed) via /s/<slug>/doc/<id>.
export default async function ShareLinkPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: link } = await admin
    .from('share_links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle<ShareLink>();
  if (!link) notFound();

  const { data: owner } = await admin
    .from('profiles')
    .select('full_name, username, avatar_url, digilocker_verified')
    .eq('id', link.owner_id)
    .maybeSingle<Profile>();
  if (!owner) notFound();

  const docConfigs = link.config?.documents ?? {};
  const docIds = Object.keys(docConfigs);

  let docs: DocumentRow[] = [];
  if (docIds.length > 0) {
    const { data } = await admin
      .from('documents')
      .select('*')
      .in('id', docIds)
      .returns<DocumentRow[]>();
    docs = data ?? [];
  }

  function tierBadge(doc: DocumentRow, field: string) {
    if (doc.verification_method === 'digilocker') {
      return (
        <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white">
          ✓ DigiLocker verified
        </span>
      );
    }
    const matched =
      doc.details_check?.overall === 'match' ||
      doc.details_check?.fields?.[field]?.matches === true;
    if (matched) {
      return (
        <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white">
          ✓ Matches uploaded document
        </span>
      );
    }
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-inset ring-slate-300">
        Self-declared
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {owner.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={owner.avatar_url}
              alt={owner.full_name}
              className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-100"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-xl font-bold text-white">
              {owner.full_name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="flex items-center gap-1.5 text-xl font-bold text-slate-900">
              {owner.full_name}
              {owner.digilocker_verified && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                  Govt-verified ID
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-400">Shared selection: {link.name}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {docs.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-400 shadow-sm">
            This link doesn&apos;t share any details.
          </p>
        )}
        {docs.map((doc) => {
          const cfg = docConfigs[doc.id];
          const visibleFields = (cfg?.fields ?? []).filter(
            (f) => doc.details?.[f]
          );
          return (
            <div
              key={doc.id}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-medium text-slate-900">
                  {doc.doc_type}
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    {CATEGORIES[doc.category].label}
                  </span>
                </p>
                {cfg?.show_document && (
                  <a
                    href={`/s/${slug}/doc/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-slate-50"
                  >
                    View document
                  </a>
                )}
              </div>

              {visibleFields.length > 0 ? (
                <dl className="space-y-1.5">
                  {visibleFields.map((field) => (
                    <div
                      key={field}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm"
                    >
                      <dt className="text-slate-400">{field}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {doc.details?.[field]}
                        </span>
                        {tierBadge(doc, field)}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-slate-400">
                  {cfg?.show_document
                    ? 'Document shared (no individual details selected).'
                    : 'No details selected.'}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        This is a private link created by {owner.full_name}. Only the selected
        information is shown.
      </p>
    </div>
  );
}
