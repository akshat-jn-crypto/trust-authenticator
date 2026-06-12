'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import { CATEGORIES, type DocStatus, type DocumentRow } from '@/lib/types';

// Admin-side verification toggle (simulated verification logic).
export default function AdminReviewRow({
  doc,
  ownerName,
}: {
  doc: DocumentRow;
  ownerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setStatus(status: DocStatus) {
    setBusy(true);
    const supabase = createClient();

    const reviewer_note =
      status === 'rejected'
        ? prompt('Reason for rejection (shown to the user):') ?? null
        : null;

    await supabase
      .from('documents')
      .update({ status, reviewer_note, reviewed_at: new Date().toISOString() })
      .eq('id', doc.id);

    setBusy(false);
    router.refresh();
  }

  async function viewFile() {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60);
    if (data) window.open(data.signedUrl, '_blank', 'noopener');
  }

  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="px-3 py-3 font-medium text-slate-800">{ownerName}</td>
      <td className="px-3 py-3 text-slate-600">
        {CATEGORIES[doc.category].label}
      </td>
      <td className="px-3 py-3 text-slate-600">{doc.doc_type}</td>
      <td className="px-3 py-3">
        <StatusBadge status={doc.status} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={viewFile}
            className="font-medium text-brand-700 hover:underline"
          >
            View
          </button>
          <button
            onClick={() => setStatus('verified')}
            disabled={busy || doc.status === 'verified'}
            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            Verify
          </button>
          <button
            onClick={() => setStatus('rejected')}
            disabled={busy || doc.status === 'rejected'}
            className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={() => setStatus('pending')}
            disabled={busy || doc.status === 'pending'}
            className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </td>
    </tr>
  );
}
