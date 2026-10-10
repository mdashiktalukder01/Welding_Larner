export const MAX_IMPORT_ROWS = 3000;

export const MCQ_HEADERS = ['level', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'];
export const CQ_HEADERS = ['level', 'question', 'model_answer'];

export type McqImportRow = {
  level: number; question_text: string; option_a: string; option_b: string;
  option_c: string; option_d: string; correct_option: string; explanation: string;
};
export type CqImportRow = { level: number; question_text: string; model_answer: string };

export type ImportCheck<T> = {
  rows: T[];
  errors: { row: number; message: string }[];
  fatal: string | null;
  perLevel: Record<number, number>;
};

const ALIASES: Record<string, string> = {
  question_text: 'question', answer: 'model_answer', correct: 'correct_option',
  correct_answer: 'correct_option', level_number: 'level',
};
const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, '_');

function readTable(table: string[][], required: string[]) {
  if (table.length === 0) return { fatal: 'The file is empty.' as string };
  const idx: Record<string, number> = {};
  table[0].forEach((h, i) => {
    const key = ALIASES[norm(h)] ?? norm(h);
    if (!(key in idx)) idx[key] = i;
  });
  const missing = required.filter((r) => !(r in idx));
  if (missing.length) {
    return { fatal: `Missing column(s): ${missing.join(', ')}. The first row must be a header row.` };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { fatal: `Too many rows (${table.length - 1}). Split the file into batches of ${MAX_IMPORT_ROWS} or fewer.` };
  }
  return { idx, body: table.slice(1) };
}

const emptyCheck = <T,>(fatal: string): ImportCheck<T> => ({ rows: [], errors: [], fatal, perLevel: {} });

export function validateMcq(table: string[][]): ImportCheck<McqImportRow> {
  const t = readTable(table, ['level', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option']);
  if ('fatal' in t && t.fatal) return emptyCheck(t.fatal);
  const { idx, body } = t as { idx: Record<string, number>; body: string[][] };

  const out: ImportCheck<McqImportRow> = { rows: [], errors: [], fatal: null, perLevel: {} };
  body.forEach((cells, i) => {
    const get = (k: string) => (k in idx ? (cells[idx[k]] ?? '').trim() : '');
    const row = i + 2; // header is row 1
    const errs: string[] = [];
    const level = Number(get('level'));
    if (!Number.isInteger(level) || level < 1 || level > 4) errs.push('level must be 1, 2, 3 or 4');
    if (!get('question')) errs.push('question is empty');
    const opts = ['option_a', 'option_b', 'option_c', 'option_d'].map(get);
    opts.forEach((o, n) => { if (!o) errs.push(`option_${'abcd'[n]} is empty`); });
    if (opts.every(Boolean) && new Set(opts.map((o) => o.toLowerCase())).size < 4) errs.push('two options are identical');
    const correct = get('correct_option').toUpperCase();
    if (!/^[ABCD]$/.test(correct)) errs.push('correct_option must be A, B, C or D');

    if (errs.length) { errs.forEach((m) => out.errors.push({ row, message: m })); return; }
    out.rows.push({
      level, question_text: get('question'),
      option_a: opts[0], option_b: opts[1], option_c: opts[2], option_d: opts[3],
      correct_option: correct, explanation: get('explanation'),
    });
    out.perLevel[level] = (out.perLevel[level] ?? 0) + 1;
  });
  return out;
}

export function validateCq(table: string[][]): ImportCheck<CqImportRow> {
  const t = readTable(table, ['level', 'question', 'model_answer']);
  if ('fatal' in t && t.fatal) return emptyCheck(t.fatal);
  const { idx, body } = t as { idx: Record<string, number>; body: string[][] };

  const out: ImportCheck<CqImportRow> = { rows: [], errors: [], fatal: null, perLevel: {} };
  body.forEach((cells, i) => {
    const get = (k: string) => (cells[idx[k]] ?? '').trim();
    const row = i + 2;
    const errs: string[] = [];
    const level = Number(get('level'));
    if (!Number.isInteger(level) || level < 1 || level > 4) errs.push('level must be 1, 2, 3 or 4');
    if (!get('question')) errs.push('question is empty');
    if (!get('model_answer')) errs.push('model_answer is empty');

    if (errs.length) { errs.forEach((m) => out.errors.push({ row, message: m })); return; }
    out.rows.push({ level, question_text: get('question'), model_answer: get('model_answer') });
    out.perLevel[level] = (out.perLevel[level] ?? 0) + 1;
  });
  return out;
}
