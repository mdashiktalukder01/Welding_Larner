'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { CqQuestion, CqReviewItem, PASS_MARK } from '@/lib/types';

type Phase = 'intro' | 'running' | 'evaluate' | 'result';
type Draft = { attemptId: string; questions: CqQuestion[]; answers: Record<string, string>; i: number };
type Mark = 0 | 0.5 | 1;

const MARKS: { value: Mark; label: string }[] = [
  { value: 1, label: 'Correct' },
  { value: 0.5, label: 'Partly right' },
  { value: 0, label: 'Wrong' },
];

export default function CqExam({ level }: { level: number }) {
  const [supabase] = useState(() => createClient());
  const [phase, setPhase] = useState<Phase>('intro');
  const [attemptId, setAttemptId] = useState('');
  const [questions, setQuestions] = useState<CqQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [i, setI] = useState(0);
  const [review, setReview] = useState<CqReviewItem[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);

  useEffect(() => {
    const d = loadDraft<Draft>('cq', level);
    if (d) {
      setAttemptId(d.attemptId); setQuestions(d.questions);
      setAnswers(d.answers); setI(d.i); setPhase('running');
    }
  }, [level]);

  useEffect(() => {
    if (phase === 'running') saveDraft('cq', level, { attemptId, questions, answers, i });
  }, [phase, level, attemptId, questions, answers, i]);

  async function start() {
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('start_exam', { p_level_number: level, p_type: 'cq' });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setAttemptId(data.attempt_id); setQuestions(data.questions);
    setAnswers({}); setMarks({}); setReview([]); setResult(null); setI(0); setPhase('running');
  }

  async function submitAnswers() {
    const blank = questions.filter((q) => !(answers[q.id] ?? '').trim()).length;
    if (blank > 0 && !window.confirm(`${blank} question(s) have no answer. Submit anyway?`)) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('submit_cq_exam', { p_attempt_id: attemptId, p_answers: answers });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    clearDraft('cq', level);
    setReview(data.review as CqReviewItem[]);
    setPhase('evaluate');
  }

  const percent = useMemo(() => {
    if (review.length === 0) return 0;
    const total = review.reduce((sum, r) => sum + (marks[r.id] ?? 0), 0);
    return Math.round((total / review.length) * 10000) / 100;
  }, [marks, review]);

  const unmarked = review.filter((r) => marks[r.id] === undefined).length;

  async function finalize() {
    if (unmarked > 0 && !window.confirm(`${unmarked} question(s) are not marked yet and will count as 0. Save anyway?`)) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('finalize_cq_exam', { p_attempt_id: attemptId, p_score: percent });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setResult(data as { score: number; passed: boolean });
    setPhase('result');
  }

  async function copyAiPrompt() {
    const body = review.map((r, n) =>
      `Question ${n + 1}: ${r.question}\nStudent answer: ${r.student_answer || '(no answer)'}\nModel answer: ${r.model_answer}`
    ).join('\n\n');
    const prompt =
      'You are a welding instructor. For each question below, compare the student answer with the model answer ' +
      'and give a mark of 1 (correct), 0.5 (partly right) or 0 (wrong) with a one-line reason. ' +
      'Finish with the total as a percentage.\n\n' + body;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch {
      setErr('Could not copy to the clipboard. Select the text manually instead.');
    }
  }

  const back = <Link href={`/levels/${level}`} className="text-sm font-medium text-steel-700 underline">Back to Level {level}</Link>;
  const errorBox = err && <p role="alert" className="mt-4 border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">{err}</p>;

  if (phase === 'intro') {
    return (
      <>
        {back}
        <h1 className="mb-2 mt-2 text-4xl font-bold">Level {level} CQ exam</h1>
        <div className="panel max-w-xl space-y-3 p-6">
          <p>50 short-answer questions are drawn at random from the question bank. Type your answer to each one.</p>
          <p>After you submit, you will see your answers beside the model answers and mark yourself. You need {PASS_MARK}% or more to pass.</p>
          <button className="btn-primary" onClick={start} disabled={busy}>{busy ? 'Preparing exam…' : 'Start exam'}</button>
          {errorBox}
        </div>
      </>
    );
  }

  if (phase === 'running') {
    const q = questions[i];
    const done = questions.filter((x) => (answers[x.id] ?? '').trim()).length;
    return (
      <>
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="font-semibold">Question {i + 1} of {questions.length}</span>
          <span className="text-steel-700">{done} answered</span>
        </div>
        <div className="mb-6 h-1.5 bg-steel-200"><div className="h-full bg-tint-4" style={{ width: `${(done / questions.length) * 100}%` }} /></div>

        <div className="panel p-6">
          <label htmlFor="cq-answer" className="font-sans text-xl font-semibold leading-snug">{q.question}</label>
          <textarea
            id="cq-answer" rows={7} className="field mt-4"
            placeholder="Type your answer here"
            value={answers[q.id] ?? ''}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
          />
          <div className="mt-5 flex justify-between">
            <button className="btn-quiet" onClick={() => setI(i - 1)} disabled={i === 0}>Previous</button>
            {i < questions.length - 1
              ? <button className="btn-primary" onClick={() => setI(i + 1)}>Next question</button>
              : <button className="btn-primary" onClick={submitAnswers} disabled={busy}>{busy ? 'Submitting…' : 'Submit answers'}</button>}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1.5" aria-label="Jump to question">
          {questions.map((x, idx) => {
            const has = (answers[x.id] ?? '').trim().length > 0;
            return (
              <button
                key={x.id} onClick={() => setI(idx)} aria-current={idx === i}
                aria-label={`Question ${idx + 1}${has ? ', answered' : ''}`}
                className={`h-8 w-8 text-xs font-semibold tabular-nums ${
                  idx === i ? 'bg-steel-900 text-white' : has ? 'bg-tint-4 text-white' : 'border border-steel-300 bg-white'
                }`}
              >{idx + 1}</button>
            );
          })}
        </div>
        <div className="mt-6"><button className="btn-quiet" onClick={submitAnswers} disabled={busy}>Submit now</button></div>
        {errorBox}
      </>
    );
  }

  if (phase === 'evaluate') {
    return (
      <>
        <h1 className="text-4xl font-bold">Mark your answers</h1>
        <p className="mt-1 max-w-2xl text-steel-700">
          Compare each of your answers with the model answer, then choose how well you did. Your score is worked out from your marks.
        </p>

        <div className="sticky top-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-steel-200 bg-steel-100/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <p className="tabular-nums">
            <span className="font-display text-3xl font-bold">{percent}%</span>
            <span className="ml-2 text-sm text-steel-700">{unmarked} not marked yet</span>
          </p>
          <div className="flex gap-2">
            <button className="btn-quiet" onClick={copyAiPrompt}>{copied ? 'Copied' : 'Copy prompt for AI marking'}</button>
            <button className="btn-primary" onClick={finalize} disabled={busy}>{busy ? 'Saving…' : 'Save my score'}</button>
          </div>
        </div>
        {errorBox}

        <ol className="mt-6 space-y-5">
          {review.map((r, n) => (
            <li key={r.id} className="panel p-5">
              <p className="font-semibold">{n + 1}. {r.question}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="border-l-4 border-tint-4 bg-steel-50 p-3">
                  <p className="mb-1 text-sm font-semibold">Your answer</p>
                  <p className="whitespace-pre-line text-sm">{r.student_answer.trim() || <em className="text-steel-500">No answer given</em>}</p>
                </div>
                <div className="border-l-4 border-ok bg-green-50 p-3">
                  <p className="mb-1 text-sm font-semibold">Model answer</p>
                  <p className="whitespace-pre-line text-sm">{r.model_answer}</p>
                </div>
              </div>
              <fieldset className="mt-4">
                <legend className="sr-only">Mark for question {n + 1}</legend>
                <div className="flex flex-wrap gap-2">
                  {MARKS.map((m) => {
                    const on = marks[r.id] === m.value;
                    return (
                      <button
                        key={m.value} aria-pressed={on}
                        onClick={() => setMarks((s) => ({ ...s, [r.id]: m.value }))}
                        className={`border px-3 py-1.5 text-sm font-medium ${on ? 'border-steel-900 bg-steel-900 text-white' : 'border-steel-300 bg-white hover:bg-steel-50'}`}
                      >{m.label}</button>
                    );
                  })}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>
      </>
    );
  }

  // ---- result ----
  const r = result!;
  return (
    <>
      {back}
      <div className={`mt-3 border-l-8 p-6 ${r.passed ? 'border-ok bg-green-50' : 'border-bad bg-red-50'}`}>
        <p className="font-display text-6xl font-bold tabular-nums">{r.score}%</p>
        <p className="mt-1 text-lg font-semibold">{r.passed ? 'Passed.' : `Not passed yet. You need ${PASS_MARK}%.`}</p>
        {r.passed && level < 4 && <p className="mt-1 text-steel-700">Pass the MCQ exam as well to unlock Level {level + 1}.</p>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => { setPhase('intro'); setResult(null); }}>Retake with new questions</button>
          <Link className="btn-quiet" href="/dashboard">Dashboard</Link>
        </div>
      </div>
    </>
  );
}
