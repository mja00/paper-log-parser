import type { Severity } from "./types";

// Centralized plugin knowledge base. A check or the client maps a plugin name to a severity here
// instead of the color logic being scattered across the parser.
export const BAD_PLUGINS = [
  "SkinsRestorer",
  "AuthMe",
  "nLogin",
  "ClearLagg",
  "FastClearLag",
  "PlugMan",
  // Same hot-reload hazard as PlugMan.
  "PlugManX",
  "Skript",
  // Long-abandoned permission managers.
  "PermissionsEx",
  "GroupManager",
  // Placebo "anti-lag" tooling.
  "LagAssist",
];
export const MEH_PLUGINS = ["ViaVersion", "ProtocolLib", "ViaBackwards", "ViaRewind", "FastLogin"];
// Plugins whose presence suggests a cracked/offline server.
export const WEIRD_PLUGINS = ["AuthMe", "nLogin", "SkinsRestorer"];

export function pluginSeverity(name: string): Severity {
  if (BAD_PLUGINS.includes(name)) return "error";
  if (MEH_PLUGINS.includes(name)) return "warning";
  return "ok";
}

export function isWeird(name: string): boolean {
  return WEIRD_PLUGINS.includes(name);
}
