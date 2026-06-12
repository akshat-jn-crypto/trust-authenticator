// Trust Score = percentage of uploaded documents that are verified.
export default function TrustScoreBar({
  verified,
  total,
}: {
  verified: number;
  total: number;
}) {
  const score = total === 0 ? 0 : Math.round((verified / total) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">Trust Score</span>
        <span className="text-sm font-semibold text-slate-900">
          {score}%
          <span className="ml-1 font-normal text-slate-400">
            ({verified}/{total} verified)
          </span>
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score === 100 ? 'bg-emerald-500' : 'bg-brand-600'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
