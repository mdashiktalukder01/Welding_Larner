import Link from 'next/link';
import { requireAdmin, fmtDate } from '@/lib/admin';
import ProgressPips from '@/components/ProgressPips';

type Student = {
  id: string; full_name: string | null; email: string | null; created_at: string;
  levels_cleared: number; total_attempts: number; last_active: string | null;
};

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc('admin_student_overview');

  const needle = q.trim().toLowerCase();
  const students = ((data ?? []) as Student[])
    .filter((s) => !needle || `${s.full_name ?? ''} ${s.email ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.last_active ?? '').localeCompare(a.last_active ?? ''));

  return (
    <>
      <h1 className="text-4xl font-bold">Students</h1>
      <form className="mb-4 mt-4 flex max-w-md gap-2" role="search">
        <input name="q" defaultValue={q} className="field" type="search" placeholder="Search by name or email" aria-label="Search students" />
        <button className="btn-primary">Search</button>
      </form>

      {error && <p role="alert" className="mb-4 border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">{error.message}. Have you run migration 004?</p>}

      <div className="panel overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-steel-200 bg-steel-50 text-sm">
            <tr>
              <th className="p-3">Student</th><th className="p-3">Levels cleared</th>
              <th className="p-3">Attempts</th><th className="p-3">Last active</th><th className="p-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-steel-200">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-steel-50">
                <td className="p-3">
                  <Link href={`/admin/students/${s.id}`} className="font-semibold underline">{s.full_name || 'Unnamed student'}</Link>
                  <div className="text-sm text-steel-700">{s.email}</div>
                </td>
                <td className="p-3"><ProgressPips cleared={s.levels_cleared} /></td>
                <td className="p-3 tabular-nums">{s.total_attempts}</td>
                <td className="p-3 text-sm">{fmtDate(s.last_active)}</td>
                <td className="p-3 text-sm">{fmtDate(s.created_at)}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-steel-700">{needle ? `No students match “${q}”.` : 'No students have registered yet.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-steel-700">{students.length} student{students.length === 1 ? '' : 's'} shown.</p>
    </>
  );
}
