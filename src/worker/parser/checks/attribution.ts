import type { DerivedCheck, PluginInfo } from "../types";

// Platform/library packages that must never be attributed to a plugin.
const PLATFORM_PREFIXES = [
  "java.",
  "jdk.",
  "sun.",
  "javax.",
  "net.minecraft",
  "org.bukkit",
  "org.spigotmc",
  "io.papermc",
  "com.destroystokyo",
  "com.mojang",
  "io.netty",
  "co.aikar",
  "org.apache",
  "com.google",
  "kotlin.",
];

// Below this token length, containment matching is off — segments like "api" or "core" would
// false-positive constantly. Exact matches still count.
const CONTAINMENT_FLOOR = 5;

function normalize(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// "at com.example.myplugin.listener.Foo.onJoin(Foo.java:42)" → ["com", "example", "myplugin", "listener"]
function packageSegments(frame: string): string[] {
  const qualified = frame.replace(/^at\s+/, "").split("(")[0];
  if (PLATFORM_PREFIXES.some((prefix) => qualified.startsWith(prefix))) return [];
  // Drop the trailing Class.method pair.
  return qualified.split(".").slice(0, -2);
}

function segmentMatches(segment: string, token: string): boolean {
  if (segment === token) return true;
  if (token.length >= CONTAINMENT_FLOOR && segment.includes(token)) return true;
  if (segment.length >= CONTAINMENT_FLOOR && token.includes(segment)) return true;
  return false;
}

// Exported for unit tests: which loaded plugins do a trace's frames implicate?
export function suspectPlugins(frames: string[], plugins: PluginInfo[]): string[] {
  const tokens = plugins.map((p) => ({ name: p.name, token: normalize(p.name) }));
  const suspected: string[] = [];
  for (const frame of frames) {
    for (const segment of packageSegments(frame)) {
      const normalized = normalize(segment);
      if (normalized === "") continue;
      for (const { name, token } of tokens) {
        if (token !== "" && !suspected.includes(name) && segmentMatches(normalized, token)) {
          suspected.push(name);
        }
      }
    }
  }
  return suspected;
}

// Best-effort plugin attribution for stack traces. Runs after dedupeExceptions so each surviving
// trace is attributed once.
export const attributeExceptions: DerivedCheck = {
  id: "attribute-exceptions",
  run(ctx) {
    const { exceptions, plugins } = ctx.findings;
    if (plugins.length === 0) return;
    for (const trace of exceptions) {
      trace.suspectedPlugins = suspectPlugins(
        trace.throwables.flatMap((t) => t.frames),
        plugins,
      );
    }
  },
};
