'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { claimFieldsFor, type DetailsCheck, type DocumentRow } from '@/lib/types';

// Owner-side editor for the shareable claims on one document.
// These appear on the public Trust Link; the file never does.
export default function DocumentDetails({ doc }: { doc: DocumentRow }) {
  const router = useRouter();
  const fields = claimFieldsFor(doc.doc_type);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(doc.details ?? {});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filled = Object.values(doc.details ?? {}).filter(Boolean).length;
  const check = doc.details_check ?? null;
  // DigiLocker docs are already issuer-verified — no AI check needed.
  const showCheck = doc.verification_method !== 'digilocker';

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
    // Kick off the AI auto-check against the document.
    if (Object.keys(clean).length > 0) await runCheck();
    router.refresh();
  }

  async function runCheck() {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch('/api/check-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          res.status === 501
            ? 'Auto-check isn’t enabled on this deployment yet.'
            : body.error ?? 'Could not run the document check.'
        );
      }
    } catch {
      setError('Could not reach the verification service.');
    }
    setChecking(false);
    router.refresh();
  }

  function checkBadge(c: DetailsCheck) {
    if (c.overall === 'match')
      return <span className="text-xs font-medium text-emerald-700">✓ Matches document</span>;
    if (c.overall === 'partial')
      return <span className="text-xs font-medium text-amber-700">⚠ Partially matches</span>;
    if (c.overall === 'unreadable')
      return <span className="text-xs font-medium text-slate-500">Document unreadable</span>;
    return <span className="text-xs font-medium text-red-600">✕ Doesn’t match document</span>;
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium text-brand-700 hover:underline"
        >
          {filled > 0 ? `Edit details (${filled})` : 'Add details to share'}
        </button>
        {showCheck && filled > 0 && (
          <>
            {checking ? (
              <span className="text-xs text-slate-400">Checking against document…</span>
            ) : check ? (
              checkBadge(check)
            ) : (
              <span className="text-xs text-slate-400">Not checked yet</span>
            )}
            {!checking && (
              <button
                onClick={runCheck}
                className="text-xs font-medium text-slate-500 hover:underline"
              >
                {check ? 'Re-check' : 'Check against document'}
              </button>
            )}
          </>
        )}
        {check?.note && !checking && (
          <span className="w-full text-xs text-slate-400">{check.note}</span>
        )}
        {error && <span className="w-full text-xs text-red-600">{error}</span>}
      </div>
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
