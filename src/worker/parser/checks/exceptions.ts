import type { Check, Throwable } from "../types";
import { stripPrefix } from "./util";

// Exceptions that are noise or handled by their own checks, so they don't clutter the report.
const IGNORED_EXCEPTIONS = ["UnknownDependencyException", "CoercionFailedException"];

// Matches a throwable's fully-qualified class (and optional message) anywhere in the line.
const THROWABLE = /([\w.$]+(?:Exception|Error|Throwable))(?::\s*(.*))?/;
// A trace almost never exceeds this many continuation lines; caps look-ahead on malformed logs.
const MAX_TRACE_LINES = 400;

// `... N more` collapses frames shared with the enclosing trace; capture N, else null.
function moreCount(content: string): number | null {
  const match = content.match(/^\.{3}\s*(\d+)\s+more$/);
  return match ? Number.parseInt(match[1], 10) : null;
}

// A `Caused by:`/`Suppressed:` link opens a new throwable in the chain; return its remainder.
function chainLink(content: string): string | null {
  if (content.startsWith("Caused by:")) return content.slice("Caused by:".length).trim();
  if (content.startsWith("Suppressed:")) return content.slice("Suppressed:".length).trim();
  return null;
}

function parseThrowable(content: string): Throwable {
  const match = content.match(THROWABLE);
  if (match) {
    const type = match[1].split(".").pop() ?? match[1];
    return { type, message: (match[2] ?? "").trim(), frames: [], truncated: 0 };
  }
  return { type: "Exception", message: content, frames: [], truncated: 0 };
}

// On a throwable header, look ahead consuming `at …` frames, `… N more`, and `Caused by:`/
// `Suppressed:` links to assemble one complete trace. Continuation lines are marked consumed so the
// driver doesn't re-open a trace on a `Caused by:` line (which also contains "Exception").
export const exceptionsCheck: Check = {
  id: "exceptions",
  // Superset of the THROWABLE regex's suffixes so `…Error`/`…Throwable` headers (e.g.
  // OutOfMemoryError) reach onLine, not just `…Exception`.
  prefilter: ["Exception", "Error", "Throwable"],
  onLine(line, index, ctx) {
    if (index <= ctx.exceptionsConsumedThrough) return;

    const content = stripPrefix(line);
    // Only a non-continuation throwable line starts a trace; orphan frames/links are ignored.
    if (content.startsWith("at ") || moreCount(content) !== null || chainLink(content) !== null) return;
    if (!THROWABLE.test(content)) return;
    if (content.includes("lost connection")) return;
    if (IGNORED_EXCEPTIONS.some((word) => content.includes(word))) return;

    const throwables: Throwable[] = [parseThrowable(content)];
    let current = throwables[0];
    let lastConsumed = index;

    const end = Math.min(ctx.lines.length, index + 1 + MAX_TRACE_LINES);
    for (let j = index + 1; j < end; j++) {
      const c = stripPrefix(ctx.lines[j]);
      if (c === "") break;
      if (c.startsWith("at ")) {
        current.frames.push(c);
      } else if (moreCount(c) !== null) {
        current.truncated = moreCount(c) as number;
      } else if (chainLink(c) !== null) {
        current = parseThrowable(chainLink(c) as string);
        throwables.push(current);
      } else {
        break;
      }
      lastConsumed = j;
    }

    ctx.exceptionsConsumedThrough = lastConsumed;
    ctx.findings.exceptions.push({ throwables, count: 1, lineNumbers: [index] });
  },
};
