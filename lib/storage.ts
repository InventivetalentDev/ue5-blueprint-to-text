export const DRAFT_KEY = "ue5bp.draft";
export const HISTORY_KEY = "ue5bp.history";
export const HISTORY_MAX = 10;
const PREVIEW_LEN = 80;

export type HistoryEntry = {
  id: string;
  value: string;
  savedAt: number;
  preview: string;
};

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function makePreview(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  if (collapsed.length <= PREVIEW_LEN) return collapsed;
  return collapsed.slice(0, PREVIEW_LEN) + "…";
}

function makeId(): string {
  if (hasWindow() && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadDraft(): string {
  if (!hasWindow()) return "";
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? "";
  } catch (e) {
    console.warn("loadDraft failed", e);
    return "";
  }
}

export function saveDraft(value: string): void {
  if (!hasWindow()) return;
  try {
    if (value) window.localStorage.setItem(DRAFT_KEY, value);
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch (e) {
    console.warn("saveDraft failed", e);
  }
}

export function loadHistory(): HistoryEntry[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        e &&
        typeof e.id === "string" &&
        typeof e.value === "string" &&
        typeof e.savedAt === "number" &&
        typeof e.preview === "string",
    );
  } catch (e) {
    console.warn("loadHistory failed", e);
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("writeHistory failed", e);
  }
}

export function pushHistory(value: string): HistoryEntry[] {
  const trimmed = value.trim();
  if (!trimmed) return loadHistory();
  const current = loadHistory();
  if (current.length > 0 && current[0].value === value) return current;
  const entry: HistoryEntry = {
    id: makeId(),
    value,
    savedAt: Date.now(),
    preview: makePreview(value),
  };
  const next = [entry, ...current].slice(0, HISTORY_MAX);
  writeHistory(next);
  return next;
}

export function clearAll(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(HISTORY_KEY);
  } catch (e) {
    console.warn("clearAll failed", e);
  }
}

export function formatRelative(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
