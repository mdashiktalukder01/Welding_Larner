import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { TINT_BG, TINT_TEXT } from '@/lib/types';

const EXAM_SIZE = 50;

export default async function AdminHome() {
  const { supabase } = await requireAdmin();

  const count = async (table: 'questions_mcq' | 'questions_cq', n: number) => {
    const { count } = await supabase
      .from(table).select('id, levels!inner(level_number)', { count: 'exact', head: true })
      .eq('levels.level_number', n).eq('is_active', true);
    return count ?? 0;
  };

  const pools = await Promise.all([1, 2, 3, 4].map(async (n) => ({ n, mcq: await count('questions_mcq', n), cq: await count('questions_cq', n) })));
  const { count: students } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student');
  const { count: attempts } = await supabase.from('exam_attempts').select('id', { count: 'exact', head: true });

  return (
    <>
      <h1 className="text-4xl font-bold">Admin overview</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="panel p-5"><p className="font-display text-5xl font-bold tabular-nums">{students ?? 0}</p><p className="text-steel-700">registered students</p></div>
        <div className="panel p-5"><p className="font-display text-5xl font-bold tabular-nums">{attempts ?? 0}</p><p className="text-steel-700">exam attempts so far</p></div>
      </div>

      <h2 className="mb-1 mt-10 text-2xl font-bold">Question pool</h2>
      <p className="mb-4 max-w-2xl text-steel-700">
        Each exam draws {EXAM_SIZE} random questions per type. Aim for 200 or more of each so retakes stay varied.
        Only active questions count.
      </p>
      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-steel-200 bg-steel-50 text-sm">
            <tr><th className="p-3">Level</th><th className="p-3">MCQ</th><th className="p-3">CQ</th><th className="p-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-steel-200">
            {pools.map(({ n, mcq, cq }) => {
              const short = Math.max(EXAM_SIZE - mcq, EXAM_SIZE - cq, 0);
              return (
                <tr key={n}>
                  <td className="p-3"><span className={`inline-flex h-8 w-8 items-center justify-center font-display text-xl font-bold ${TINT_BG[n]} ${TINT_TEXT[n]}`}>{n}</span></td>
                  <td className="p-3 tabular-nums">{mcq}</td>
                  <td className="p-3 tabular-nums">{cq}</td>
                  <td className="p-3 text-sm">
                    {short > 0
                      ? <span className="font-semibold text-bad">Needs more: exams will have fewer than {EXAM_SIZE} questions</span>
                      : mcq < 200 || cq < 200
                        ? <span className="text-steel-700">Ready. Below the 200 target</span>
                        : <span className="font-semibold text-ok">✓ Full pool</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/questions" className="btn-primary">Manage questions</Link>
        <Link href="/admin/import" className="btn-quiet">Import a CSV</Link>
        <Link href="/admin/students" className="btn-quiet">View students</Link>
      </div>
    </>
  );
}
