// Recent-parses history in localStorage. All storage access is wrapped so private-mode/quota
// failures degrade to an empty, non-persistent history instead of breaking the page.
import type { Severity } from "../../worker/parser/types";

export interface HistoryEntry {
  url: string;
  parsedAt: number;
  status: Severity;
  headline: string;
  mcVersion: string | null;
}

const KEY = "plp:recent-parses";
const MAX_ENTRIES = 10;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is HistoryEntry =>
        typeof entry === "object" && entry !== null && typeof (entry as HistoryEntry).url === "string",
    );
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((e) => e.url !== entry.url)].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota/private mode: history just won't persist.
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore — nothing to clear if storage is unavailable.
  }
}
