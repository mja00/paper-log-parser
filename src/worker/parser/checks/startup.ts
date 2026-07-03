import type { Check } from "../types";

export const portBindCheck: Check = {
  id: "port-bind",
  prefilter: ["FAILED TO BIND TO PORT", "Perhaps a server is already running"],
  isDone: (ctx) => ctx.findings.startup.portBindFailure,
  onLine(_line, _index, ctx) {
    ctx.findings.startup.portBindFailure = true;
  },
};

export const eulaCheck: Check = {
  id: "eula",
  prefilter: "agree to the EULA",
  isDone: (ctx) => ctx.findings.startup.eulaNotAccepted,
  onLine(_line, _index, ctx) {
    ctx.findings.startup.eulaNotAccepted = true;
  },
};
