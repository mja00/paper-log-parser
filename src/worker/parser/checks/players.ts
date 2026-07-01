import type { Check } from "../types";
import { uuidRegex } from "../regexes";

// Collects unique (username, uuid) pairs; network validation happens later in network.ts.
export const playersCheck: Check = {
  id: "players",
  prefilter: "UUID of player",
  onLine(line, _index, ctx) {
    const match = uuidRegex.exec(line);
    if (!match) return;
    const player = { username: match[1], uuid: match[2] };
    if (!ctx.findings.players.some((p) => p.username === player.username && p.uuid === player.uuid)) {
      ctx.findings.players.push(player);
    }
  },
};
