import { notFound } from 'next/navigation';
import { requireUnlockedLevel } from '@/lib/level';
import McqExam from '@/components/McqExam';
import CqExam from '@/components/CqExam';

export default async function ExamPage({ params }: { params: Promise<{ level: string; type: string }> }) {
  const { level, type } = await params;
  if (type !== 'mcq' && type !== 'cq') notFound();
  const { n } = await requireUnlockedLevel(level);
  return type === 'mcq' ? <McqExam level={n} /> : <CqExam level={n} />;
}
