// Trust Score is weighted by verification strength: issuer-signed
// (DigiLocker) documents count fully, auto-checked documents count
// at half. A 100% score therefore requires real issuer verification,
// so the bar can't be maxed out by uploading any well-formed file.
const AUTO_CHECK_WEIGHT = 0.5;

export default function TrustScoreBar({
  verified,
  issuerVerified = 0,
  total,
}: {
  verified: number;
  issuerVerified?: number;
  total: number;
}) {
  const autoChecked = Math.max(verified - issuerVerified, 0);
  const weighted = issuerVerified + autoChecked * AUTO_CHECK_WEIGHT;
  const score = total === 0 ? 0 : Math.round((weighted / total) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">Trust Score</span>
        <span className="text-sm font-semibold text-slate-900">
          {score}%
          <span className="ml-1 font-normal text-slate-400">
            ({issuerVerified} issuer-verified, {autoChecked} auto-checked)
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
