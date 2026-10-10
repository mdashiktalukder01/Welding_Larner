import { PASS_MARK } from '@/lib/types';

export default function ScoreBar({
  label, score, passed,
}: { label: string; score: number | null; passed: boolean }) {
  const pct = score ?? 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-steel-700">
          {score === null ? 'Not taken yet' : `Best ${pct}%`}
          {passed && <span className="ml-2 font-semibold text-ok">✓ Passed</span>}
        </span>
      </div>
      <div
        className="relative h-2 bg-steel-200"
        role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${label} best score`}
      >
        <div className={`h-full ${passed ? 'bg-ok' : 'bg-steel-500'}`} style={{ width: `${pct}%` }} />
        <div
          className="absolute -inset-y-1 w-0.5 bg-steel-900"
          style={{ left: `${PASS_MARK}%` }}
          title={`${PASS_MARK}% pass mark`}
        />
      </div>
    </div>
  );
}
