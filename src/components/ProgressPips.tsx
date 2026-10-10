import { TINT_BG } from '@/lib/types';

// Four squares: cleared levels are filled, the current level is outlined.
export default function ProgressPips({ cleared }: { cleared: number }) {
  const current = Math.min(cleared + 1, 4);
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${cleared} of 4 levels cleared`}>
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-5 w-5 ${
            n <= cleared ? TINT_BG[n] : n === current ? 'border-2 border-steel-900 bg-white' : 'bg-steel-200'
          }`}
        />
      ))}
    </span>
  );
}
