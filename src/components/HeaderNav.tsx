'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

// Auth-aware header navigation. `authed` is resolved server-side in
// the root layout so the first paint is already correct (no flash).
export default function HeaderNav({ authed }: { authed: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  if (!authed) {
    return (
      <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
        <Link href="/login" className="hover:text-brand-700">
          Sign in
        </Link>
        <Link
          href="/login"
          className="rounded-md bg-brand-700 px-3 py-1.5 text-white hover:bg-brand-600"
        >
          Get started
        </Link>
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
      <Link href="/dashboard" className="hover:text-brand-700">
        Vault
      </Link>
      <button
        onClick={signOut}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50"
      >
        Sign out
      </button>
    </nav>
  );
}
