import Link from 'next/link';
import { CATEGORIES, CATEGORY_ORDER } from '@/lib/types';

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-700">
          Privacy-first verification
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          One link that proves you,
          <br /> without exposing you.
        </h1>
        <p className="mt-5 text-lg text-slate-600">
          Upload your documents once. Share a single Trust Link with banks,
          employers and landlords that shows <em>what is verified</em> — never
          the documents themselves.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/login"
            className="rounded-md bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-600"
          >
            Create your Trust Link
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Open my vault
          </Link>
        </div>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORY_ORDER.map((key) => (
          <div
            key={key}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h3 className="font-semibold text-slate-900">
              {CATEGORIES[key].label}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {CATEGORIES[key].description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
