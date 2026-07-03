import type { Check } from "../types";
import { oomRegex } from "../regexes";

// The JVM's message after "java.lang.OutOfMemoryError:" → a stable kind the client can narrate.
function classifyOom(detail: string): string {
  if (detail.includes("Java heap space")) return "heap-space";
  if (detail.includes("GC overhead limit exceeded")) return "gc-overhead";
  if (detail.includes("Metaspace")) return "metaspace";
  if (detail.includes("native thread")) return "native-thread";
  if (detail.includes("Direct buffer memory")) return "direct-buffer";
  return "unknown";
}

// OOM headers are also captured as full traces by exceptionsCheck — deliberately. This field
// powers the top-level verdict/tile; the client excludes OOM-rooted traces when counting issues.
export const oomCheck: Check = {
  id: "oom",
  prefilter: "OutOfMemoryError",
  onLine(line, index, ctx) {
    const match = oomRegex.exec(line);
    if (match === null) return;
    const { oom } = ctx.findings;
    oom.detected = true;
    oom.count++;
    oom.lineNumbers.push(index + 1);
    const kind = classifyOom(match[1] ?? "");
    if (!oom.kinds.includes(kind)) oom.kinds.push(kind);
  },
};
