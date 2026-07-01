// Server-side ANSI escape codes, mirroring Python's colorama `Fore`.
// The report is emitted as strings containing these escapes; the Vue client
// (src/client/lib/ansi.ts) maps them to its own hex render palette.
export const Fore = {
  RED: "\x1b[31m",
  GREEN: "\x1b[32m",
  YELLOW: "\x1b[33m",
  BLUE: "\x1b[34m",
  MAGENTA: "\x1b[35m",
  CYAN: "\x1b[36m",
  WHITE: "\x1b[37m",
  RESET: "\x1b[39m",
} as const;
