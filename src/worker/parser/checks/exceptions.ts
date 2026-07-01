import type { Check } from "../types";

// Exceptions that are noise or handled by their own checks, so they don't clutter the report.
const IGNORED_EXCEPTIONS = ["UnknownDependencyException", "CoercionFailedException"];

export const exceptionsCheck: Check = {
  id: "exceptions",
  prefilter: "Exception",
  onLine(line, index, ctx) {
    if (line.includes("lost connection")) return;
    if (IGNORED_EXCEPTIONS.some((word) => line.includes(word))) return;
    ctx.findings.exceptions.push({ line, lineNumber: index });
  },
};
