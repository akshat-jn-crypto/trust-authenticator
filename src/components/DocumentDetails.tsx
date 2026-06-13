'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { claimFieldsFor, type DocumentRow } from '@/lib/types';

// Owner-side editor for the shareable claims on one document.
// These appear on the public Trust Link; the file never does.
export default function DocumentDetails({ doc }: { doc: DocumentRow }) {
  const router = useRouter();
  const fields = claimFieldsFor(doc.doc_type);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(doc.details ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = Object.values(doc.details ?? {}).filter(Boolean).length;

  async function save() {
    setSaving(true);
    setError(null);
    // Drop empty fields so the public RPC (details <> '{}') hides
    // documents with no claims.
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim()) clean[k] = v.trim();
    }
    const supabase = createClient();
    const { error } = await supabase
      .from('documents')
      .update({ details: clean })
      .eq('id', doc.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-brand-700 hover:underline"
      >
        {filled > 0 ? `Edit details (${filled})` : 'Add details to share'}
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs text-slate-500">
        Shown on your public Trust Link. Do not enter ID numbers or other
        secrets — only shareable facts.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <label key={field} className="block">
            <span className="text-xs font-medium text-slate-600">{field}</span>
            <input
              value={values[field] ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field]: e.target.value }))
              }
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save details'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
