'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'password' | 'magic';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation disabled — straight in.
        router.replace('/onboarding');
      } else {
        setNotice(
          `Account created. Check ${email} to confirm your address, then sign in.`
        );
        setIsSignUp(false);
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(
        error.message.includes('Invalid login')
          ? 'Wrong email or password. If you signed up with a magic link, use that tab and set a password from your dashboard first.'
          : error.message
      );
    } else {
      router.replace('/dashboard');
      router.refresh();
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setNotice(`Check your inbox — a sign-in link is on its way to ${email}.`);
  }

  const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600';

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <h1 className="text-2xl font-bold text-slate-900">
        {mode === 'password' && isSignUp ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Access your document vault and Trust Link.
      </p>

      {/* Mode toggle */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
        <button
          onClick={() => {
            setMode('password');
            setError(null);
            setNotice(null);
          }}
          className={`rounded-md py-1.5 ${
            mode === 'password'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500'
          }`}
        >
          Password
        </button>
        <button
          onClick={() => {
            setMode('magic');
            setError(null);
            setNotice(null);
          }}
          className={`rounded-md py-1.5 ${
            mode === 'magic' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
          }`}
        >
          Magic link
        </button>
      </div>

      {notice ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          {notice}
        </div>
      ) : mode === 'password' ? (
        <form onSubmit={handlePassword} className="mt-6 space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          <input
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? 'Choose a password (min 8 chars)' : 'Password'}
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading
              ? 'Please wait…'
              : isSignUp
                ? 'Create account'
                : 'Sign in'}
          </button>
          <p className="text-center text-sm text-slate-500">
            {isSignUp ? 'Already have an account?' : 'New here?'}{' '}
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="font-medium text-brand-700 hover:underline"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="mt-6 space-y-4">
          <p className="text-sm text-slate-500">
            We&apos;ll email you a secure link — no password needed.
          </p>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>
      )}
    </div>
  );
}
