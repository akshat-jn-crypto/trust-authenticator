import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { createClient } from '@/lib/supabase/server';
import HeaderNav from '@/components/HeaderNav';

export const metadata: Metadata = {
  title: 'Trust Authenticator',
  description:
    'One verified link for your identity, education, professional and property documents.',
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold text-brand-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-700 text-sm font-bold text-white">
                T
              </span>
              Trust Authenticator
            </Link>
            <HeaderNav authed={!!user} />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
          Trust Authenticator — your documents stay private. Only verification
          status is ever shared.
        </footer>
      </body>
    </html>
  );
}
