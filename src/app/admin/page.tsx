import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminReviewRow from '@/components/AdminReviewRow';
import type { DocumentRow } from '@/lib/types';

type DocWithOwner = DocumentRow & {
  profiles: { full_name: string; username: string } | null;
};

// Verification queue. RLS double-checks every action server-side,
// so this page gate is UX, not the security boundary.
export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) redirect('/dashboard');

  const { data: documents } = await supabase
    .from('documents')
    .select('*, profiles!documents_owner_id_fkey(full_name, username)')
    .order('created_at', { ascending: true })
    .returns<DocWithOwner[]>();

  const docs = documents ?? [];
  const pending = docs.filter((d) => d.status === 'pending');
  const reviewed = docs.filter((d) => d.status !== 'pending');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Verification queue</h1>
      <p className="mt-1 text-sm text-slate-500">
        {pending.length} document{pending.length !== 1 && 's'} awaiting review
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Document</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[...pending, ...reviewed].map((doc) => (
              <AdminReviewRow
                key={doc.id}
                doc={doc}
                ownerName={doc.profiles?.full_name ?? 'Unknown'}
              />
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">
                  Nothing to review yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
