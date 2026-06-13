import type { DocStatus, VerificationMethod } from '@/lib/types';

// A "verified" document means different things depending on how it
// was checked. Only issuer-signed (DigiLocker) documents earn the
// strong green "Verified" label; format-only checks are clearly
// marked "Auto-checked" so the badge never over-claims.
export default function StatusBadge({
  status,
  method,
}: {
  status: DocStatus;
  method?: VerificationMethod;
}) {
  let style: string;
  let label: string;
  let title: string | undefined;

  if (status === 'pending') {
    style = 'bg-amber-50 text-amber-700 ring-amber-600/20';
    label = '⏳ Pending';
  } else if (status === 'rejected') {
    style = 'bg-red-50 text-red-700 ring-red-600/20';
    label = '✕ Rejected';
  } else if (method === 'digilocker') {
    style = 'bg-emerald-600 text-white ring-emerald-700';
    label = '✓ Verified';
    title = 'Digitally signed by the issuing authority (via DigiLocker)';
  } else {
    // simulated / format-only check
    style = 'bg-slate-100 text-slate-600 ring-slate-300';
    label = 'Auto-checked';
    title = 'Format and integrity checks passed — not authenticity-verified';
  }

  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {label}
    </span>
  );
}
