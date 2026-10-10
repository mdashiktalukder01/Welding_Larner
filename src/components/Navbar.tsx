import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SignOutButton from './SignOutButton';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let name = '';
  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('full_name, role').eq('id', user.id).single();
    name = profile?.full_name || user.email || '';
    isAdmin = profile?.role === 'admin';
  }

  return (
    <header className="border-b border-steel-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3">
          <span className="flex h-6 w-6 overflow-hidden" aria-hidden>
            <span className="w-1/4 bg-tint-1" /><span className="w-1/4 bg-tint-2" />
            <span className="w-1/4 bg-tint-3" /><span className="w-1/4 bg-tint-4" />
          </span>
          <span className="font-display text-2xl font-bold leading-none">Welding Learner</span>
        </Link>
        {user ? (
          <div className="flex items-center gap-4 text-sm">
            {isAdmin && <Link href="/admin" className="font-semibold underline">Admin</Link>}
            <span className="hidden max-w-[10rem] truncate text-steel-500 sm:inline">{name}</span>
            <SignOutButton />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Link href="/login" className="btn-quiet !py-1.5">Log in</Link>
            <Link href="/register" className="btn-primary !py-1.5">Sign up</Link>
          </div>
        )}
      </div>
    </header>
  );
}
