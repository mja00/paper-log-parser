import type { Check } from "../types";
import { cantKeepUpRegex, watchdogUnresponsiveRegex } from "../regexes";

// Banners within this many lines of the previous one count as the same watchdog event (the dump
// itself spans many lines and some Paper eras repeat the banner inside it).
const WATCHDOG_EVENT_WINDOW = 10;

export const watchdogCheck: Check = {
  id: "watchdog",
  prefilter: [
    "DO NOT REPORT THIS TO PAPER",
    "The server has not responded for",
    "Considering it to be crashed",
    "Server thread dump",
  ],
  onLine(line, index, ctx) {
    const { watchdog } = ctx.findings.performance;
    if (line.includes("DO NOT REPORT THIS TO PAPER")) {
      if (index - ctx.lastWatchdogBanner > WATCHDOG_EVENT_WINDOW) {
        watchdog.crashCount++;
        watchdog.lineNumbers.push(index + 1);
      }
      ctx.lastWatchdogBanner = index;
      return;
    }
    const unresponsive = watchdogUnresponsiveRegex.exec(line);
    if (unresponsive !== null) {
      const seconds = Number.parseInt(unresponsive[1], 10);
      if (watchdog.maxUnresponsiveSeconds === null || seconds > watchdog.maxUnresponsiveSeconds) {
        watchdog.maxUnresponsiveSeconds = seconds;
      }
      return;
    }
    // Vanilla watchdog hard-kill; Paper-format logs never print this, but vanilla logs get pasted too.
    if (line.includes("Considering it to be crashed")) {
      watchdog.forcedShutdown = true;
      if (watchdog.crashCount === 0) {
        watchdog.crashCount = 1;
        watchdog.lineNumbers.push(index + 1);
      }
      return;
    }
    if (line.includes("Server thread dump")) watchdog.hasThreadDump = true;
  },
};

export const cantKeepUpCheck: Check = {
  id: "cant-keep-up",
  prefilter: "Can't keep up!",
  onLine(line, _index, ctx) {
    const match = cantKeepUpRegex.exec(line);
    if (match === null) return;
    const ms = Number.parseInt(match[1], 10);
    const ticks = Number.parseInt(match[2], 10);
    const { cantKeepUp } = ctx.findings.performance;
    cantKeepUp.count++;
    cantKeepUp.totalMsBehind += ms;
    cantKeepUp.totalTicksSkipped += ticks;
    if (ms > cantKeepUp.maxMsBehind) cantKeepUp.maxMsBehind = ms;
  },
};
