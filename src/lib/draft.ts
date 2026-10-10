// Keeps an in-progress exam in sessionStorage so a refresh doesn't lose answers.
const key = (type: string, level: number) => `wl-draft-${type}-${level}`;

export function loadDraft<T>(type: string, level: number): T | null {
  try {
    const raw = sessionStorage.getItem(key(type, level));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
export function saveDraft(type: string, level: number, value: unknown) {
  try { sessionStorage.setItem(key(type, level), JSON.stringify(value)); } catch {}
}
export function clearDraft(type: string, level: number) {
  try { sessionStorage.removeItem(key(type, level)); } catch {}
}
