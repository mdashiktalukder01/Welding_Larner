'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { parseCsv, toCsv } from '@/lib/csv';
import { CQ_HEADERS, MCQ_HEADERS, validateCq, validateMcq } from '@/lib/importers';

type Kind = 'mcq' | 'cq';

const SAMPLE: Record<Kind, string[][]> = {
  mcq: [
    MCQ_HEADERS,
    ['1', 'Which radiation from the arc damages unprotected eyes?', 'Ultraviolet', 'Radio waves', 'Sound waves', 'Gamma only', 'A', 'The arc emits UV and IR radiation.'],
    ['1', 'What does SMAW stand for?', 'Shielded Metal Arc Welding', 'Simple Metal Arc Work', 'Static Metal Arc Weld', 'Submerged Metal Arc Welding', 'A', ''],
  ],
  cq: [
    CQ_HEADERS,
    ['1', 'Define welding.', 'Welding joins metals permanently using heat and/or pressure, with or without filler metal.'],
    ['2', 'Name two advantages of MIG welding.', 'Faster travel speed and easier to learn than stick welding.'],
  ],
};

export default function ImportPanel() {
  const [supabase] = useState(() => createClient());
  const [kind, setKind] = useState<Kind>('mcq');
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ inserted: number; skipped: number } | null>(null);

  const check = useMemo(() => {
    if (text === null) return null;
    const table = parseCsv(text);
    return kind === 'mcq' ? validateMcq(table) : validateCq(table);
  }, [text, kind]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setDone(null); setErr(null); setFileName(f.name);
    setText(await f.text());
  }

  function downloadTemplate() {
    const blob = new Blob(['\uFEFF' + toCsv(SAMPLE[kind])], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function runImport() {
    if (!check || check.fatal || check.errors.length || check.rows.length === 0) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc(kind === 'mcq' ? 'admin_import_mcq' : 'admin_import_cq', { p_rows: check.rows });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setDone(data as { inserted: number; skipped: number });
    setText(null); setFileName('');
  }

  const cols = kind === 'mcq' ? MCQ_HEADERS : CQ_HEADERS;
  const valid = check && !check.fatal && check.errors.length === 0 && check.rows.length > 0;

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Question type" className="inline-flex border border-steel-300 bg-white">
        {(['mcq', 'cq'] as Kind[]).map((k) => (
          <button key={k} role="tab" aria-selected={kind === k}
            onClick={() => { setKind(k); setDone(null); setErr(null); }}
            className={`px-4 py-2 font-semibold ${kind === k ? 'bg-steel-900 text-white' : 'hover:bg-steel-50'}`}>
            {k === 'mcq' ? 'MCQ questions' : 'CQ questions'}
          </button>
        ))}
      </div>

      <section className="panel p-5">
        <h2 className="text-2xl font-bold">1. Prepare your file</h2>
        <p className="mt-1 text-steel-700">
          A CSV with a header row and these columns: <code className="bg-steel-100 px-1">{cols.join(', ')}</code>.
          Use level numbers 1–4{kind === 'mcq' ? ' and A, B, C or D for correct_option. The explanation column is optional' : ''}.
          Export from Excel or Google Sheets as CSV (UTF-8) to keep Bangla and special characters intact.
        </p>
        <button className="btn-quiet mt-4" onClick={downloadTemplate}>Download {kind.toUpperCase()} template</button>
      </section>

      <section className="panel p-5">
        <h2 className="text-2xl font-bold">2. Choose the file</h2>
        <label className="mt-3 block">
          <span className="sr-only">CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={onFile}
            className="block w-full text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-steel-900 file:px-4 file:py-2.5 file:font-semibold file:text-white hover:file:bg-steel-700" />
        </label>
        {fileName && <p className="mt-2 text-sm text-steel-700">Selected: {fileName}</p>}
      </section>

      {check?.fatal && <p role="alert" className="border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">{check.fatal}</p>}

      {check && !check.fatal && (
        <section className="panel p-5">
          <h2 className="text-2xl font-bold">3. Check and import</h2>
          <p className="mt-2">
            <span className="font-semibold text-ok">{check.rows.length} valid</span>
            {check.errors.length > 0 && <>, <span className="font-semibold text-bad">{new Set(check.errors.map((e) => e.row)).size} row(s) with problems</span></>}
          </p>
          {check.rows.length > 0 && (
            <p className="mt-1 text-sm text-steel-700">
              By level: {[1, 2, 3, 4].filter((n) => check.perLevel[n]).map((n) => `Level ${n}: ${check.perLevel[n]}`).join(', ')}
            </p>
          )}

          {check.errors.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Fix these in your file, then choose it again. Nothing has been saved.</p>
              <ul className="max-h-64 divide-y divide-steel-200 overflow-auto border border-steel-200 text-sm">
                {check.errors.slice(0, 100).map((e, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2"><span className="w-16 shrink-0 font-semibold tabular-nums">Row {e.row}</span><span>{e.message}</span></li>
                ))}
              </ul>
              {check.errors.length > 100 && <p className="mt-1 text-sm text-steel-700">Showing the first 100 of {check.errors.length} problems.</p>}
            </div>
          )}

          {valid && (
            <>
              <div className="mt-4 overflow-x-auto border border-steel-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-steel-50"><tr><th className="p-2">Level</th><th className="p-2">Question</th>
                    <th className="p-2">{kind === 'mcq' ? 'Correct' : 'Model answer'}</th></tr></thead>
                  <tbody className="divide-y divide-steel-200">
                    {check.rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2">{r.level}</td>
                        <td className="p-2">{r.question_text}</td>
                        <td className="p-2">{'correct_option' in r ? r.correct_option : (r as { model_answer: string }).model_answer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-sm text-steel-700">Preview of the first 5 rows. Questions already in the bank (same level and text) are skipped automatically.</p>
              <button className="btn-primary mt-4" onClick={runImport} disabled={busy}>
                {busy ? 'Importing…' : `Import ${check.rows.length} questions`}
              </button>
            </>
          )}
        </section>
      )}

      {err && <p role="alert" className="border-l-4 border-bad bg-red-50 px-3 py-2 text-bad">Import failed and nothing was saved: {err}</p>}
      {done && (
        <p role="status" className="border-l-4 border-ok bg-green-50 px-3 py-3 text-ok">
          Imported {done.inserted} question{done.inserted === 1 ? '' : 's'}
          {done.skipped > 0 && `, skipped ${done.skipped} already in the bank`}.{' '}
          <Link href="/admin" className="font-semibold underline">Check the pool size</Link>
        </p>
      )}
    </div>
  );
}
