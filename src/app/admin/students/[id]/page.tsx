import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin, fmtDate } from '@/lib/admin';
import ProgressPips from '@/components/ProgressPips';
import { TINT_BG, TINT_TEXT } from '@/lib/types';

type Progress = {
  mcq_best_score: number | null; cq_best_score: number | null; mcq_passed: boolean; cq_passed: boolean;
  mcq_attempts: number; cq_attempts: number; levels: { level_number: number };
};
type Attempt = {
  id: string; exam_type: 'mcq' | 'cq'; status: string; score: number | null; correct_count: number | null;
  total_questions: number; passed: boolean | null; started_at: string; levels: { level_number: number };
};

const pct = (v: number | null) => (v === null ? '–' : `${v}%`);

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();

  const [{ data: profile }, { data: progress }, { data: attempts }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, created_at').eq('id', id).single(),
    supabase.from('user_progress').select('*, levels(level_number)').eq('user_id', id),
    supabase.from('exam_attempts')
      .select('id, exam_type, status, score, correct_count, total_questions, passed, started_at, levels(level_number)')
      .eq('user_id', id).order('started_at', { ascending: false }).limit(50),
  ]);
  if (!profile) notFound();

  const byLevel = new Map<number, Progress>();
  ((progress ?? []) as Progress[]).forEach((p) => byLevel.set(p.levels.level_number, p));
  const cleared = [1, 2, 3, 4].filter((n) => byLevel.get(n)?.mcq_passed && byLevel.get(n)?.cq_passed).length;

  return (
    <>
      <Link href="/admin/students" className="text-sm font-medium text-steel-700 underline">Back to students</Link>
      <div className="mb-8 mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">{profile.full_name || 'Unnamed student'}</h1>
          <p className="text-steel-700">{profile.email} · joined {fmtDate(profile.created_at)}</p>
        </div>
        <ProgressPips cleared={cleared} />
      </div>

      <h2 className="mb-3 text-2xl font-bold">Level progress</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-steel-200 bg-steel-50 text-sm">
            <tr><th className="p-3">Level</th><th className="p-3">MCQ best</th><th className="p-3">CQ best</th><th className="p-3">Attempts (MCQ / CQ)</th><th className="p-3">State</th></tr>
          </thead>
          <tbody className="divide-y divide-steel-200">
            {[1, 2, 3, 4].map((n) => {
              const p = byLevel.get(n);
              const done = !!(p?.mcq_passed && p?.cq_passed);
              const open = n === 1 || !!(byLevel.get(n - 1)?.mcq_passed && byLevel.get(n - 1)?.cq_passed);
              return (
                <tr key={n}>
                  <td className="p-3"><span className={`inline-flex h-8 w-8 items-center justify-center font-display text-xl font-bold ${TINT_BG[n]} ${TINT_TEXT[n]}`}>{n}</span></td>
                  <td className="p-3 tabular-nums">{pct(p?.mcq_best_score ?? null)}{p?.mcq_passed && <span className="ml-1 text-ok">✓</span>}</td>
                  <td className="p-3 tabular-nums">{pct(p?.cq_best_score ?? null)}{p?.cq_passed && <span className="ml-1 text-ok">✓</span>}</td>
                  <td className="p-3 tabular-nums">{p?.mcq_attempts ?? 0} / {p?.cq_attempts ?? 0}</td>
                  <td className="p-3 text-sm">{done ? <span className="font-semibold text-ok">Cleared</span> : open ? 'In progress' : 'Locked'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-10 text-2xl font-bold">Recent exam attempts</h2>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-steel-200 bg-steel-50 text-sm">
            <tr><th className="p-3">Date</th><th className="p-3">Level</th><th className="p-3">Exam</th><th className="p-3">Score</th><th className="p-3">Result</th></tr>
          </thead>
          <tbody className="divide-y divide-steel-200">
            {((attempts ?? []) as unknown as Attempt[]).map((a) => (
              <tr key={a.id}>
                <td className="p-3 text-sm">{fmtDate(a.started_at)}</td>
                <td className="p-3">Level {a.levels.level_number}</td>
                <td className="p-3 uppercase">{a.exam_type}</td>
                <td className="p-3 tabular-nums">
                  {pct(a.score)}
                  {a.exam_type === 'mcq' && a.correct_count !== null && <span className="ml-2 text-sm text-steel-700">({a.correct_count}/{a.total_questions})</span>}
                </td>
                <td className="p-3 text-sm">
                  {a.status === 'in_progress' ? 'Not submitted'
                    : a.status === 'awaiting_evaluation' ? 'Awaiting self-marking'
                    : a.passed ? <span className="font-semibold text-ok">Passed</span> : <span className="font-semibold text-bad">Not passed</span>}
                </td>
              </tr>
            ))}
            {(attempts ?? []).length === 0 && <tr><td colSpan={5} className="p-6 text-steel-700">This student hasn’t taken an exam yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
