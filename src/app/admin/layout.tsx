import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';

const links = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/questions', label: 'Questions' },
  { href: '/admin/import', label: 'CSV import' },
  { href: '/admin/students', label: 'Students' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    // Breaks out of the narrow student-page column; stays centred on any screen.
    <div className="relative left-1/2 w-[min(72rem,calc(100vw-2rem))] -translate-x-1/2">
      <nav aria-label="Admin sections" className="mb-8 flex flex-wrap gap-1 border-b border-steel-200">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="px-4 py-2.5 font-semibold text-steel-700 hover:bg-white hover:text-steel-900">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
