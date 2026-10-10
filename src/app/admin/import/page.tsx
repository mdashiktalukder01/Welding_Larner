import { requireAdmin } from '@/lib/admin';
import ImportPanel from '@/components/admin/ImportPanel';

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <h1 className="text-4xl font-bold">CSV import</h1>
      <p className="mb-6 mt-1 max-w-2xl text-steel-700">
        Upload a whole question pool at once. The file is checked in your browser first, and nothing is saved unless every row is valid.
      </p>
      <ImportPanel />
    </>
  );
}
