'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// Lets an existing user (e.g. one created via magic link, which has
// no password) set or change a password for future password logins.
export default function SetPasswordCard() {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) setError(error.message);
    else {
      setDone(true);
      setPassword('');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        Set a password for password login →
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">Set a password</h3>
      <p className="mt-1 text-sm text-slate-500">
        Enables signing in with email + password instead of a magic link.
      </p>
      {done ? (
        <p className="mt-3 text-sm text-emerald-700">
          ✓ Password set. You can now use the Password tab on the sign-in page.
        </p>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            autoComplete="new-password"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
