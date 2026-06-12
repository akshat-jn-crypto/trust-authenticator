'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/StatusBadge';
import type { DocumentRow } from '@/lib/types';

// Owner's view of their uploaded documents: open via short-lived
// signed URL (bucket is private), or delete.
export default function DocumentList({ documents }: { documents: DocumentRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleView(doc: DocumentRow) {
    setBusyId(doc.id);
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.file_path, 60); // valid for 60 seconds
    setBusyId(null);
    if (error || !data) {
      alert('Could not open document.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function handleDelete(doc: DocumentRow) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    const supabase = createClient();
    await supabase.storage.from('documents').remove([doc.file_path]);
    await supabase.from('documents').delete().eq('id', doc.id);
    setBusyId(null);
    router.refresh();
  }

  if (documents.length === 0) {
    return (
      <p className="py-2 text-sm text-slate-400">No documents uploaded yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {documents.map((doc) => (
        <li
          key={doc.id}
          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {doc.doc_type}
            </p>
            <p className="truncate text-xs text-slate-400">{doc.file_name}</p>
            {doc.status === 'rejected' && doc.reviewer_note && (
              <p className="mt-0.5 text-xs text-red-600">
                Reason: {doc.reviewer_note}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <StatusBadge status={doc.status} />
            <button
              onClick={() => handleView(doc)}
              disabled={busyId === doc.id}
              className="text-sm font-medium text-brand-700 hover:underline disabled:opacity-50"
            >
              View
            </button>
            <button
              onClick={() => handleDelete(doc)}
              disabled={busyId === doc.id}
              className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
