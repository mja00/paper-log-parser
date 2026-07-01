import type { Severity } from "../../worker/parser/types";

// Icon name (see Icon.vue) that conventionally represents each severity in the UI.
export const SEVERITY_ICON: Record<Severity, string> = {
  ok: "check",
  warning: "warning",
  error: "x",
  info: "info",
  neutral: "info",
};
