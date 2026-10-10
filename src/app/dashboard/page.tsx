import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import ScoreBar from '@/components/ScoreBar';
import { DashboardLevel, PASS_MARK, TINT_BG, TINT_TEXT } from '@/lib/types';

export default async function Dashboard() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_dashboard');
  const levels = (data ?? []) as DashboardLevel[];

  return (
    <>
      <h1 className="text-4xl font-bold">Your levels</h1>
      <p className="mb-8 mt-1 text-steel-700">
        Pass both the MCQ and CQ exam with {PASS_MARK}% or more to unlock the next level.
      </p>

      {error && (
        <p role="alert" className="mb-6 border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">
          Couldn’t load your levels: {error.message}. Check that the database migrations have been applied.
        </p>
      )}

      <ol className="space-y-4">
        {levels.map((lv) => {
          const n = lv.level_number;
          const locked = !lv.is_unlocked;
          return (
            <li key={n} className={`panel flex flex-col sm:flex-row ${locked ? 'bg-steel-50' : ''}`}>
              <div
                className={`flex shrink-0 items-center justify-center py-4 font-display text-6xl font-bold sm:w-28 ${
                  locked ? 'bg-steel-300 text-steel-500' : `${TINT_BG[n]} ${TINT_TEXT[n]}`
                }`}
                aria-hidden
              >
                {locked ? '🔒' : n}
              </div>
              <div className="flex-1 p-5">
                <h2 className="text-2xl font-bold">
                  {lv.title}
                  {locked && <span className="sr-only"> (locked)</span>}
                </h2>
                {locked ? (
                  <p className="mt-2 text-steel-700">
                    Locked. Pass both the MCQ and CQ exam of Level {n - 1} with {PASS_MARK}% or more to open it.
                  </p>
                ) : (
                  <>
                    {lv.description && <p className="mt-1 text-steel-700">{lv.description}</p>}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <ScoreBar label="MCQ exam" score={lv.mcq_best_score} passed={lv.mcq_passed} />
                      <ScoreBar label="CQ exam" score={lv.cq_best_score} passed={lv.cq_passed} />
                    </div>
                    <Link href={`/levels/${n}`} className="btn-primary mt-5">
                      {lv.mcq_best_score === null && lv.cq_best_score === null ? 'Start level' : 'Open level'}
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
