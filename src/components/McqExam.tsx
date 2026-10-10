'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { McqQuestion, McqResult, PASS_MARK } from '@/lib/types';

type Phase = 'intro' | 'running' | 'result';
type Draft = { attemptId: string; questions: McqQuestion[]; answers: Record<string, string>; i: number };

export default function McqExam({ level }: { level: number }) {
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>('intro');
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<McqQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<McqResult | null>(null);
  const [wrongOnly, setWrongOnly] = useState(true);

  // Resume an unfinished attempt after a refresh.
  useEffect(() => {
    const d = loadDraft<Draft>('mcq', level);
    if (d) {
      setAttemptId(d.attemptId); setQuestions(d.questions);
      setAnswers(d.answers); setI(d.i); setPhase('running');
    }
  }, [level]);

  useEffect(() => {
    if (phase === 'running') saveDraft('mcq', level, { attemptId, questions, answers, i });
  }, [phase, level, attemptId, questions, answers, i]);

  async function start() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('start_exam', { p_level_number: level, p_type: 'mcq' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setAttemptId(data.attempt_id); setQuestions(data.questions);
    setAnswers({}); setI(0); setResult(null); setPhase('running');
  }

  async function submit() {
    const unanswered = questions.length - Object.keys(answers).length;
    if (unanswered > 0 && !window.confirm(`${unanswered} question(s) are unanswered and will count as wrong. Submit anyway?`)) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('submit_mcq_exam', { p_attempt_id: attemptId, p_answers: answers });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    clearDraft('mcq', level);
    setResult(data as McqResult); setWrongOnly(true); setPhase('result');
  }

  const back = <Link href={`/levels/${level}`} className="text-sm font-medium text-steel-700 underline">Back to Level {level}</Link>;
  const errorBox = err && <p role="alert" className="mt-4 border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">{err}</p>;

  if (phase === 'intro') {
    return (
      <>
        {back}
        <h1 className="mb-2 mt-2 text-4xl font-bold">Level {level} MCQ exam</h1>
        <div className="panel max-w-xl space-y-3 p-6">
          <p>50 questions are drawn at random from the question bank, and the A–D choices are shuffled each time.</p>
          <p>You need {PASS_MARK}% or more to pass. Your answers are kept if you refresh the page.</p>
          <button className="btn-primary" onClick={start} disabled={busy}>{busy ? 'Preparing exam…' : 'Start exam'}</button>
          {errorBox}
        </div>
      </>
    );
  }

  if (phase === 'running') {
    const q = questions[i];
    const answered = Object.keys(answers).length;
    return (
      <>
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-semibold">Question {i + 1} of {questions.length}</span>
          <span className="text-steel-700">{answered} answered</span>
        </div>
        <div className="mb-6 h-1.5 bg-steel-200"><div className="h-full bg-tint-4" style={{ width: `${(answered / questions.length) * 100}%` }} /></div>

        <div className="panel p-6">
          <h2 className="font-sans text-xl font-semibold leading-snug">{q.question}</h2>
          <div role="radiogroup" aria-label="Answer choices" className="mt-5 space-y-2">
            {q.options.map((o) => {
              const chosen = answers[q.id] === o.label;
              return (
                <button
                  key={o.label} role="radio" aria-checked={chosen}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.label }))}
                  className={`flex w-full items-start gap-3 border px-4 py-3 text-left transition-colors ${
                    chosen ? 'border-steel-900 bg-steel-900 text-white' : 'border-steel-300 bg-white hover:bg-steel-50'
                  }`}
                >
                  <span className="font-display text-xl font-bold leading-6">{o.label}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 flex justify-between">
            <button className="btn-quiet" onClick={() => setI(i - 1)} disabled={i === 0}>Previous</button>
            {i < questions.length - 1
              ? <button className="btn-primary" onClick={() => setI(i + 1)}>Next question</button>
              : <button className="btn-primary" onClick={submit} disabled={busy}>{busy ? 'Scoring…' : 'Submit exam'}</button>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5" aria-label="Jump to question">
          {questions.map((x, idx) => (
            <button
              key={x.id} onClick={() => setI(idx)} aria-label={`Question ${idx + 1}${answers[x.id] ? ', answered' : ''}`}
              aria-current={idx === i}
              className={`h-8 w-8 text-xs font-semibold tabular-nums ${
                idx === i ? 'bg-steel-900 text-white' : answers[x.id] ? 'bg-tint-4 text-white' : 'border border-steel-300 bg-white'
              }`}
            >{idx + 1}</button>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button className="btn-quiet" onClick={submit} disabled={busy}>Submit now</button>
        </div>
        {errorBox}
      </>
    );
  }

  // ---- result ----
  const r = result!;
  const rows = questions.filter((q) => !wrongOnly || answers[q.id] !== r.correct_options[q.id]);
  return (
    <>
      {back}
      <div className={`mt-3 border-l-8 p-6 ${r.passed ? 'border-ok bg-green-50' : 'border-bad bg-red-50'}`}>
        <p className="font-display text-6xl font-bold tabular-nums">{r.score}%</p>
        <p className="mt-1 text-lg font-semibold">
          {r.passed ? 'Passed.' : `Not passed yet. You need ${PASS_MARK}%.`} {r.correct} of {r.total} correct.
        </p>
        {r.passed && level < 4 && (
          <p className="mt-1 text-steel-700">Pass the CQ exam as well to unlock Level {level + 1}.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => { setPhase('intro'); setResult(null); }}>Retake with new questions</button>
          <Link className="btn-quiet" href="/dashboard">Dashboard</Link>
        </div>
      </div>

      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Review</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wrongOnly} onChange={(e) => setWrongOnly(e.target.checked)} />
          Show only questions I got wrong
        </label>
      </div>
      {rows.length === 0 && <p className="panel p-5 text-steel-700">Nothing to review. Every answer was correct.</p>}
      <ol className="space-y-4">
        {rows.map((q) => {
          const correct = r.correct_options[q.id];
          const chosen = answers[q.id];
          return (
            <li key={q.id} className="panel p-5">
              <p className="font-semibold">{q.question}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                {q.options.map((o) => {
                  const isCorrect = o.label === correct;
                  const isWrongPick = o.label === chosen && !isCorrect;
                  return (
                    <li key={o.label} className={`flex gap-2 px-3 py-2 ${isCorrect ? 'bg-green-50 text-ok' : isWrongPick ? 'bg-red-50 text-bad' : ''}`}>
                      <span className="font-bold">{o.label}</span>
                      <span className="flex-1">{o.text}</span>
                      {isCorrect && <span className="font-semibold">✓ Correct answer</span>}
                      {isWrongPick && <span className="font-semibold">✗ Your answer</span>}
                    </li>
                  );
                })}
              </ul>
              {!chosen && <p className="mt-2 text-sm text-bad">You left this unanswered.</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
