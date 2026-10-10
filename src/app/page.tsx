import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TINT_BG, TINT_TEXT } from '@/lib/types';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <div className="pt-6">
      <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] sm:text-7xl">
        Learn welding one level at a time.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-steel-700">
        Read the study notes, take the MCQ and CQ exams, and score 80% on both to unlock the next level.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/register" className="btn-primary">Start Level 1</Link>
        <Link href="/login" className="btn-quiet">Log in</Link>
      </div>

      <div className="mt-14 grid grid-cols-4 overflow-hidden" aria-label="Four levels">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className={`${TINT_BG[n]} ${TINT_TEXT[n]} px-3 py-6 sm:py-10`}>
            <div className="font-display text-4xl font-bold sm:text-6xl">{n}</div>
            <div className="mt-1 text-xs sm:text-sm">{n === 1 ? 'Open from day one' : 'Locked until the level before is passed'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
