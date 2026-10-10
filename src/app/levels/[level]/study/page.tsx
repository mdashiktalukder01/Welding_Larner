import Link from 'next/link';
import { requireUnlockedLevel } from '@/lib/level';
import Accordion from '@/components/Accordion';

export default async function StudyPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const { n, supabase } = await requireUnlockedLevel(level);

  const { data } = await supabase
    .from('study_materials')
    .select('id, question, answer, levels!inner(level_number)')
    .eq('levels.level_number', n)
    .eq('is_published', true)
    .order('sort_order');

  const items = (data ?? []).map((r) => ({ id: r.id as string, question: r.question as string, answer: r.answer as string }));

  return (
    <>
      <Link href={`/levels/${n}`} className="text-sm font-medium text-steel-700 underline">Back to Level {n}</Link>
      <h1 className="mb-6 mt-2 text-4xl font-bold">Level {n} study notes</h1>
      <Accordion items={items} />
    </>
  );
}
