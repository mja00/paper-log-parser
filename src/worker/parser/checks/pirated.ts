import type { Check } from "../types";
import { pirateRegexes } from "../regexes";

const PIRATE_GIVEAWAYS = [
  "beastleaks",
  "leak",
  "leaked",
  "cracked",
  "directleaks",
  "blackspigot",
  "spigotunlocked",
  "nulled",
  "mined.to",
];

export const piratedCheck: Check = {
  id: "pirated",
  // Regex paths require the "Server thread/INFO" prefix; the giveaway path requires "STDOUT".
  prefilter: ["Server thread/INFO", "STDOUT"],
  onLine(line, _index, ctx) {
    const { pirated } = ctx.findings;
    let matched: RegExpExecArray | null = null;
    for (const regex of pirateRegexes) {
      matched = regex.exec(line);
      if (matched) break;
    }
    if (matched) {
      pirated.lines.push(matched[0]);
      pirated.detected = true;
    } else if (PIRATE_GIVEAWAYS.some((word) => line.toLowerCase().includes(word)) && line.includes("STDOUT")) {
      pirated.lines.push(line);
      pirated.detected = true;
    }
  },
};
