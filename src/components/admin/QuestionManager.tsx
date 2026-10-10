'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TINT_BG, TINT_TEXT } from '@/lib/types';

type QType = 'mcq' | 'cq';
type LevelRow = { id: string; level_number: number };
type Row = {
  id: string; level_id: string; question_text: string; is_active: boolean;
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  correct_option?: string; explanation?: string | null; model_answer?: string;
  levels: { level_number: number };
};
type Form = {
  id?: string; level: number; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: string; explanation: string; model_answer: string; is_active: boolean;
};

const PAGE = 20;
const blank = (level: number): Form => ({
  level, question_text: '', option_a: '', option_b: '', option_c: '', option_d: '',
  correct_option: 'A', explanation: '', model_answer: '', is_active: true,
});

export default function QuestionManager() {
  const [supabase] = useState(() => createClient());
  const [type, setType] = useState<QType>('mcq');
  const [levelFilter, setLevelFilter] = useState(0); // 0 = all levels
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    supabase.from('levels').select('id, level_number').order('level_number')
      .then(({ data }) => setLevels((data ?? []) as LevelRow[]));
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    const table = type === 'mcq' ? 'questions_mcq' : 'questions_cq';
    let q = supabase.from(table)
      .select('*, levels!inner(level_number)', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id')
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (levelFilter) q = q.eq('levels.level_number', levelFilter);
    if (debounced) q = q.ilike('question_text', `%${debounced}%`);
    const { data, error, count } = await q;
    if (error) setMsg({ kind: 'err', text: error.message });
    else { setRows((data ?? []) as Row[]); setTotal(count ?? 0); }
    setLoading(false);
  }, [supabase, type, levelFilter, debounced, page]);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setFormErr(null); setForm(blank(levelFilter || 1));
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  function openEdit(r: Row) {
    setFormErr(null);
    setForm({
      id: r.id, level: r.levels.level_number, question_text: r.question_text,
      option_a: r.option_a ?? '', option_b: r.option_b ?? '', option_c: r.option_c ?? '', option_d: r.option_d ?? '',
      correct_option: r.correct_option ?? 'A', explanation: r.explanation ?? '',
      model_answer: r.model_answer ?? '', is_active: r.is_active,
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const levelId = levels.find((l) => l.level_number === form.level)?.id;
    if (!levelId) { setFormErr('Pick a level.'); return; }
    const question = form.question_text.trim();
    if (!question) { setFormErr('Write the question.'); return; }

    let payload: Record<string, unknown>;
    if (type === 'mcq') {
      const opts = [form.option_a, form.option_b, form.option_c, form.option_d].map((o) => o.trim());
      if (opts.some((o) => !o)) { setFormErr('Fill in all four options.'); return; }
      if (new Set(opts.map((o) => o.toLowerCase())).size < 4) { setFormErr('Two options are identical. Make each one different.'); return; }
      payload = {
        level_id: levelId, question_text: question,
        option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
        correct_option: form.correct_option, explanation: form.explanation.trim() || null, is_active: form.is_active,
      };
    } else {
      if (!form.model_answer.trim()) { setFormErr('Write the model answer.'); return; }
      payload = { level_id: levelId, question_text: question, model_answer: form.model_answer.trim(), is_active: form.is_active };
    }

    setSaving(true); setFormErr(null);
    const table = type === 'mcq' ? 'questions_mcq' : 'questions_cq';
    const { error } = form.id
      ? await supabase.from(table).update(payload).eq('id', form.id)
      : await supabase.from(table).insert(payload);
    setSaving(false);
    if (error) { setFormErr(error.message); return; }
    setMsg({ kind: 'ok', text: form.id ? 'Question updated.' : 'Question added.' });
    setForm(null);
    load();
  }

  async function remove(r: Row) {
    if (!window.confirm('Delete this question permanently? Past exam results are not affected.')) return;
    const table = type === 'mcq' ? 'questions_mcq' : 'questions_cq';
    const { error } = await supabase.from(table).delete().eq('id', r.id);
    if (error) setMsg({ kind: 'err', text: error.message });
    else { setMsg({ kind: 'ok', text: 'Question deleted.' }); load(); }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Question type" className="flex border border-steel-300 bg-white">
          {(['mcq', 'cq'] as QType[]).map((t) => (
            <button
              key={t} role="tab" aria-selected={type === t}
              onClick={() => { setType(t); setPage(0); setForm(null); }}
              className={`px-4 py-2 font-semibold ${type === t ? 'bg-steel-900 text-white' : 'hover:bg-steel-50'}`}
            >{t === 'mcq' ? 'MCQ' : 'CQ'}</button>
          ))}
        </div>
        <select className="field !w-auto" value={levelFilter} aria-label="Filter by level"
          onChange={(e) => { setLevelFilter(Number(e.target.value)); setPage(0); }}>
          <option value={0}>All levels</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Level {n}</option>)}
        </select>
        <input className="field !w-auto min-w-[14rem] flex-1" type="search" placeholder="Search question text"
          aria-label="Search questions" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-primary" onClick={openNew}>Add {type === 'mcq' ? 'MCQ' : 'CQ'}</button>
      </div>

      {msg && (
        <p role={msg.kind === 'err' ? 'alert' : 'status'}
          className={`mb-4 border-l-4 px-3 py-2 ${msg.kind === 'ok' ? 'border-ok bg-green-50 text-ok' : 'border-bad bg-red-50 text-bad'}`}>
          {msg.text}
        </p>
      )}

      {form && (
        <form ref={formRef} onSubmit={save} className="panel mb-6 space-y-4 border-l-4 border-l-tint-4 p-5">
          <h2 className="text-2xl font-bold">{form.id ? 'Edit' : 'New'} {type === 'mcq' ? 'MCQ' : 'CQ'}</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Level</span>
            <select className="field !w-auto" value={form.level} onChange={(e) => set('level', Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>Level {n}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Question</span>
            <textarea className="field" rows={3} value={form.question_text} onChange={(e) => set('question_text', e.target.value)} />
          </label>

          {type === 'mcq' ? (
            <>
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Options. Select the correct one.</legend>
                <div className="space-y-2">
                  {(['A', 'B', 'C', 'D'] as const).map((L) => {
                    const key = `option_${L.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d';
                    return (
                      <div key={L} className="flex items-center gap-3">
                        <input type="radio" name="correct" checked={form.correct_option === L}
                          onChange={() => set('correct_option', L)} aria-label={`Option ${L} is correct`} className="h-4 w-4" />
                        <span className="w-4 font-display text-xl font-bold">{L}</span>
                        <input className="field" value={form[key]} onChange={(e) => set(key, e.target.value)} aria-label={`Option ${L}`} />
                      </div>
                    );
                  })}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-1 block text-sm font-medium">Explanation (optional)</span>
                <textarea className="field" rows={2} value={form.explanation} onChange={(e) => set('explanation', e.target.value)} />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">Model answer</span>
              <textarea className="field" rows={5} value={form.model_answer} onChange={(e) => set('model_answer', e.target.value)} />
            </label>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Active. Include this question in exams.
          </label>
          {formErr && <p role="alert" className="border-l-4 border-bad bg-red-50 px-3 py-2 text-sm text-bad">{formErr}</p>}
          <div className="flex gap-3">
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save question'}</button>
            <button type="button" className="btn-quiet" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="panel divide-y divide-steel-200" aria-busy={loading}>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-start gap-4 p-4">
            <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center font-display text-xl font-bold ${TINT_BG[r.levels.level_number]} ${TINT_TEXT[r.levels.level_number]}`}
              title={`Level ${r.levels.level_number}`}>{r.levels.level_number}</span>
            <div className="min-w-[14rem] flex-1">
              <p className="line-clamp-2 font-medium">{r.question_text}</p>
              <p className="mt-1 text-sm text-steel-700">
                {type === 'mcq' ? `Correct answer: ${r.correct_option}` : <span className="line-clamp-1">Model answer: {r.model_answer}</span>}
                {!r.is_active && <span className="ml-3 font-semibold text-bad">Hidden from exams</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-quiet !px-3 !py-1.5 text-sm" onClick={() => openEdit(r)}>Edit</button>
              <button className="btn-quiet !px-3 !py-1.5 text-sm text-bad" onClick={() => remove(r)}>Delete</button>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 && (
          <p className="p-6 text-steel-700">
            {debounced || levelFilter ? 'No questions match these filters.' : 'No questions yet. Add one, or import a CSV.'}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-steel-700">
          {total === 0 ? '0 questions' : `Showing ${page * PAGE + 1}–${Math.min((page + 1) * PAGE, total)} of ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button className="btn-quiet !py-1.5" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="tabular-nums">Page {page + 1} of {pages}</span>
          <button className="btn-quiet !py-1.5" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}
