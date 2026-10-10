import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Call at the top of every admin page. RLS and the admin_* functions enforce
// the same rule in the database; this just gives a friendly redirect.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') redirect('/dashboard');
  return { supabase, user };
}

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';
