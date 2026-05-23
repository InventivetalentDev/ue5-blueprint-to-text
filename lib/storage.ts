export const DRAFT_KEY = "ue5bp.draft";
export const DRAFT_CARDS_KEY = "ue5bp.draft.cards";
export const SAVED_KEY = "ue5bp.saved";
const LEGACY_HISTORY_KEY = "ue5bp.history";

export type SavedCard = {
  name: string;
  kind: "macro" | "function";
  body: string;
};

export type SavedGraph = {
  id: string;
  name: string;
  value: string;
  cards: SavedCard[];
  createdAt: number;
  updatedAt: number;
};

function hasWindow(): boolean {
  return typeof window !== "undefined";
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

function sanitizeCards(input: unknown): SavedCard[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((c): SavedCard[] => {
    if (
      c &&
      typeof c === "object" &&
      typeof (c as { name?: unknown }).name === "string" &&
      typeof (c as { body?: unknown }).body === "string" &&
      ((c as { kind?: unknown }).kind === "macro" ||
        (c as { kind?: unknown }).kind === "function")
    ) {
      const card = c as SavedCard;
      return [{ name: card.name, kind: card.kind, body: card.body }];
    }
    return [];
  });
}

export function loadDraftCards(): SavedCard[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(DRAFT_CARDS_KEY);
    if (!raw) return [];
    return sanitizeCards(JSON.parse(raw));
  } catch (e) {
    console.warn("loadDraftCards failed", e);
    return [];
  }
}

export function saveDraftCards(cards: SavedCard[]): void {
  if (!hasWindow()) return;
  try {
    if (cards.length === 0) {
      window.localStorage.removeItem(DRAFT_CARDS_KEY);
    } else {
      window.localStorage.setItem(DRAFT_CARDS_KEY, JSON.stringify(cards));
    }
  } catch (e) {
    console.warn("saveDraftCards failed", e);
  }
}

export function loadSaved(): SavedGraph[] {
  if (!hasWindow()) return [];
  try {
    window.localStorage.removeItem(LEGACY_HISTORY_KEY);
  } catch {
    // ignore
  }
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((e): SavedGraph[] => {
      if (
        !e ||
        typeof e.id !== "string" ||
        typeof e.name !== "string" ||
        typeof e.value !== "string" ||
        typeof e.createdAt !== "number" ||
        typeof e.updatedAt !== "number"
      ) {
        return [];
      }
      return [
        {
          id: e.id,
          name: e.name,
          value: e.value,
          cards: sanitizeCards(e.cards),
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        },
      ];
    });
  } catch (e) {
    console.warn("loadSaved failed", e);
    return [];
  }
}

function writeSaved(entries: SavedGraph[]): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn("writeSaved failed", e);
  }
}

export function suggestName(existing: SavedGraph[]): string {
  const used = new Set(existing.map((e) => e.name));
  for (let i = 1; i < 1000; i++) {
    const candidate = `Graph ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Graph ${Date.now()}`;
}

export function findByName(
  entries: SavedGraph[],
  name: string,
): SavedGraph | undefined {
  return entries.find((e) => e.name === name);
}

export type SaveResult = {
  entries: SavedGraph[];
  saved: SavedGraph;
};

export function upsertGraph(
  id: string | null,
  name: string,
  value: string,
  cards: SavedCard[],
): SaveResult {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error("Name cannot be empty");
  const now = Date.now();
  const current = loadSaved();
  const idx = id ? current.findIndex((e) => e.id === id) : -1;
  let next: SavedGraph[];
  let saved: SavedGraph;
  if (idx >= 0) {
    saved = {
      ...current[idx],
      name: trimmedName,
      value,
      cards,
      updatedAt: now,
    };
    next = [...current];
    next[idx] = saved;
  } else {
    saved = {
      id: makeId(),
      name: trimmedName,
      value,
      cards,
      createdAt: now,
      updatedAt: now,
    };
    next = [saved, ...current];
  }
  writeSaved(next);
  return { entries: next, saved };
}

export function renameGraph(id: string, name: string): SavedGraph[] {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name cannot be empty");
  const current = loadSaved();
  const next = current.map((e) =>
    e.id === id ? { ...e, name: trimmed, updatedAt: Date.now() } : e,
  );
  writeSaved(next);
  return next;
}

export function deleteGraph(id: string): SavedGraph[] {
  const next = loadSaved().filter((e) => e.id !== id);
  writeSaved(next);
  return next;
}

export function clearDraft(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(DRAFT_CARDS_KEY);
  } catch (e) {
    console.warn("clearDraft failed", e);
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
