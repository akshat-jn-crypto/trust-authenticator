'use client';

import { useState } from 'react';

// Primary action for DigiLocker-eligible categories: starts the
// OAuth consent flow so documents arrive issuer-signed instead of
// being uploaded. Probes the start route first so that while the
// integration is pending partner approval (501), users get a
// friendly message instead of raw JSON.
export default function DigiLockerFetchButton({
  fetchable,
}: {
  fetchable: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch('/api/digilocker/start', { redirect: 'manual' });
      if (res.type === 'opaqueredirect' || res.ok) {
        // Route is live — hand the browser over to the consent flow.
        window.location.href = '/api/digilocker/start';
        return;
      }
      if (res.status === 501) {
        setMessage(
          'DigiLocker connection is awaiting government partner approval. Until it goes live, please upload this document manually below — it will still be verified automatically.'
        );
      } else if (res.status === 401) {
        setMessage('Your session expired — please sign in again.');
      } else {
        setMessage('Something went wrong — please try again.');
      }
    } catch {
      setMessage('Network error — please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="rounded-lg border border-brand-600/30 bg-brand-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand-900">
            Fetch directly from DigiLocker
          </p>
          <p className="text-xs text-slate-500">
            {fetchable} — issuer-signed, verified instantly, no upload needed.
          </p>
        </div>
        <button
          onClick={connect}
          disabled={busy}
          className="shrink-0 rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? 'Connecting…' : 'Connect DigiLocker'}
        </button>
      </div>
      {message && (
        <p className="mt-2 rounded-md bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          {message}
        </p>
      )}
    </div>
  );
}
