import Link from 'next/link';
import { requireUnlockedLevel } from '@/lib/level';
import ScoreBar from '@/components/ScoreBar';
import { DashboardLevel, PASS_MARK, TINT_BG, TINT_TEXT } from '@/lib/types';

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const { n, supabase } = await requireUnlockedLevel(level);

  const { data } = await supabase.rpc('get_dashboard');
  const lv = ((data ?? []) as DashboardLevel[]).find((l) => l.level_number === n);

  const { count } = await supabase
    .from('study_materials')
    .select('id, levels!inner(level_number)', { count: 'exact', head: true })
    .eq('levels.level_number', n)
    .eq('is_published', true);

  const next = n < 4 ? n + 1 : null;

  return (
    <>
      <Link href="/dashboard" className="text-sm font-medium text-steel-700 underline">Back to levels</Link>
      <div className="mt-3 flex items-stretch">
        <div className={`flex w-20 items-center justify-center font-display text-6xl font-bold ${TINT_BG[n]} ${TINT_TEXT[n]}`}>{n}</div>
        <div className="panel flex-1 border-l-0 p-5">
          <h1 className="text-3xl font-bold">{lv?.title ?? `Level ${n}`}</h1>
          {lv?.description && <p className="mt-1 text-steel-700">{lv.description}</p>}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-2xl font-bold">Study material</h2>
            <p className="text-steel-700">{count ?? 0} questions with full answers. Read these before the exams.</p>
          </div>
          <Link href={`/levels/${n}/study`} className="btn-primary">Open study notes</Link>
        </section>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">MCQ exam</h2>
              <p className="text-steel-700">50 random questions. Answer order is shuffled on every attempt. Scored instantly.</p>
            </div>
            <Link href={`/levels/${n}/exam/mcq`} className="btn-primary">Take MCQ exam</Link>
          </div>
          <div className="mt-4"><ScoreBar label="Best MCQ score" score={lv?.mcq_best_score ?? null} passed={!!lv?.mcq_passed} /></div>
        </section>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">CQ exam</h2>
              <p className="text-steel-700">50 random short-answer questions. After submitting, compare your answers with the model answers and score yourself.</p>
            </div>
            <Link href={`/levels/${n}/exam/cq`} className="btn-primary">Take CQ exam</Link>
          </div>
          <div className="mt-4"><ScoreBar label="Best CQ score" score={lv?.cq_best_score ?? null} passed={!!lv?.cq_passed} /></div>
        </section>

        {next && (
          <p className="text-sm text-steel-700">
            Score {PASS_MARK}% or more on both exams to unlock Level {next}.
          </p>
        )}
      </div>
    </>
  );
}
