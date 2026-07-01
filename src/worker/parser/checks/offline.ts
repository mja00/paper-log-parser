import type { Check } from "../types";

// On the offline banner, look ahead up to 10 lines for a proxy — a proxy short-circuits the
// offline verdict. Once a proxy is found, isDone drops the check (matches the legacy early return).
export const offlineCheck: Check = {
  id: "offline",
  prefilter: "SERVER IS RUNNING IN OFFLINE/INSECURE MODE!",
  isDone: (ctx) => ctx.findings.offline.usingProxy,
  onLine(_line, index, ctx) {
    const { offline } = ctx.findings;
    for (let j = index; j < index + 10 && j < ctx.lines.length; j++) {
      if (ctx.lines[j].includes("BungeeCord")) {
        offline.proxyFlavor = "BungeeCord";
        offline.usingProxy = true;
        return;
      }
      if (ctx.lines[j].includes("Velocity")) {
        offline.proxyFlavor = "Velocity";
        offline.usingProxy = true;
        return;
      }
    }
    offline.isOffline = true;
  },
};
