import type { DocStatus } from '@/lib/types';

const STYLES: Record<DocStatus, string> = {
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rejected: 'bg-red-50 text-red-700 ring-red-600/20',
};

const LABELS: Record<DocStatus, string> = {
  verified: '✓ Verified',
  pending: '⏳ Pending',
  rejected: '✕ Rejected',
};

export default function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
