const PREFIX = 'tfl-draft:';

export function saveDraft(id: string, payload: unknown) {
  try {
    localStorage.setItem(`${PREFIX}${id}`, JSON.stringify({ savedAt: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

export function loadDraft<T>(id: string): T | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { payload: T };
    return parsed.payload;
  } catch {
    return null;
  }
}

export function clearDraft(id: string) {
  try {
    localStorage.removeItem(`${PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}
