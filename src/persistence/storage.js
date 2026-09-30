// Browser storage adapter. Every call is guarded: private windows, blocked storage,
// and full quotas must never throw into the game.

function store() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function readString(key) {
  try { return store()?.getItem(key) ?? null; } catch { return null; }
}

/** Returns true when the value was written. */
export function writeString(key, value) {
  try { store()?.setItem(key, value); return true; } catch { return false; }
}

/** Parsed JSON, or null when missing or unreadable. */
export function readJSON(key) {
  const raw = readString(key);
  if (raw === null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function writeJSON(key, value) {
  return writeString(key, JSON.stringify(value));
}
