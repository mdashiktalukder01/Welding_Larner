'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setBusy(false); return; }
      router.push('/dashboard'); router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });
    if (error) { setError(error.message); setBusy(false); return; }
    if (data.session) { router.push('/dashboard'); router.refresh(); return; }
    setNotice('Account created. Open the confirmation email we sent, then log in.');
    setBusy(false);
  }

  const isLogin = mode === 'login';
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-4xl font-bold">{isLogin ? 'Log in' : 'Create your account'}</h1>
      <p className="mb-6 text-steel-700">
        {isLogin ? 'Pick up where you left off.' : 'Level 1 opens as soon as you sign up.'}
      </p>
      <form onSubmit={onSubmit} className="panel space-y-4 p-6">
        {!isLogin && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Full name</span>
            <input className="field" required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            className="field" type="password" required minLength={6}
            value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={isLogin ? 'current-password' : 'new-password'}
          />
          {!isLogin && <span className="mt-1 block text-xs text-steel-500">At least 6 characters.</span>}
        </label>
        {error && <p role="alert" className="border-l-4 border-bad bg-red-50 px-3 py-2 text-sm text-bad">{error}</p>}
        {notice && <p role="status" className="border-l-4 border-ok bg-green-50 px-3 py-2 text-sm text-ok">{notice}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-steel-700">
        {isLogin ? 'New here? ' : 'Already registered? '}
        <Link className="font-semibold underline" href={isLogin ? '/register' : '/login'}>
          {isLogin ? 'Create an account' : 'Log in'}
        </Link>
      </p>
    </div>
  );
}
