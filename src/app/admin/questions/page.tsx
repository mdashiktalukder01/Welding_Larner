import { requireAdmin } from '@/lib/admin';
import QuestionManager from '@/components/admin/QuestionManager';

export default async function QuestionsPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="mb-6 text-4xl font-bold">Questions</h1>
      <QuestionManager />
    </>
  );
}
