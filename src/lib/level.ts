import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// Validates the :level param and bounces students away from locked levels.
// (The database enforces this too; this just gives a friendly redirect.)
export async function requireUnlockedLevel(levelParam: string) {
  const n = Number(levelParam);
  if (![1, 2, 3, 4].includes(n)) notFound();
  const supabase = await createClient();
  const { data: unlocked } = await supabase.rpc('is_level_unlocked', { p_level_number: n });
  if (!unlocked) redirect('/dashboard');
  return { n, supabase };
}
