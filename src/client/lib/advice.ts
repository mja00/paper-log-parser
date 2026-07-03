// Per-finding remediation advice, ordered worst-first to mirror buildVerdict. New detections plug
// in as another entry in buildAdvice — one registry, one function, one card.
import type { Findings, Severity } from "../../worker/parser/types";
import {
  SEVERE_LAG_TICKS,
  hasWatchdogCrash,
  isPaperUpToDate,
  isSupported,
  javaIncompatibility,
} from "./report";

export interface AdviceItem {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  link?: { label: string; href: string };
}

const PAPER_DOWNLOADS = { label: "papermc.io/downloads", href: "https://papermc.io/downloads/paper" };
const PAPER_DOCS = { label: "docs.papermc.io", href: "https://docs.papermc.io" };
const SPARK = { label: "spark.lucko.me", href: "https://spark.lucko.me" };
const AIKAR_FLAGS = { label: "Aikar's flags", href: "https://docs.papermc.io/paper/aikars-flags" };

// Advice for the plugins-db BAD_PLUGINS set; keys must match plugins-db.ts names exactly.
export const PLUGIN_ADVICE: Record<string, Omit<AdviceItem, "id" | "severity">> = {
  ClearLagg: {
    title: "Remove ClearLagg",
    body: "Entity-clearing plugins are a placebo that can break farms. Profile the real lag source with spark instead.",
    link: SPARK,
  },
  FastClearLag: {
    title: "Remove FastClearLag",
    body: "Entity-clearing plugins are a placebo that can break farms. Profile the real lag source with spark instead.",
    link: SPARK,
  },
  PlugMan: {
    title: "Remove PlugMan",
    body: "Hot plugin reloads corrupt plugin state and cause subtle breakage. Restart the server to reload plugins.",
  },
  PlugManX: {
    title: "Remove PlugManX",
    body: "Hot plugin reloads corrupt plugin state and cause subtle breakage. Restart the server to reload plugins.",
  },
  AuthMe: {
    title: "Reconsider AuthMe",
    body: "Auth plugins usually mean offline mode, which forfeits Mojang authentication and skin/UUID integrity. Prefer online-mode or a properly secured proxy.",
    link: PAPER_DOCS,
  },
  nLogin: {
    title: "Reconsider nLogin",
    body: "Auth plugins usually mean offline mode, which forfeits Mojang authentication and skin/UUID integrity. Prefer online-mode or a properly secured proxy.",
    link: PAPER_DOCS,
  },
  SkinsRestorer: {
    title: "SkinsRestorer implies offline mode",
    body: "Skins only need restoring when Mojang auth is off. Prefer online-mode or a properly secured proxy.",
  },
  Skript: {
    title: "Audit Skript scripts",
    body: "Skript is a common source of lag and errors. Audit installed scripts and replace hot paths with real plugins.",
  },
  PermissionsEx: {
    title: "Replace PermissionsEx",
    body: "PermissionsEx has been abandoned for years and breaks on modern servers. Migrate to LuckPerms.",
    link: { label: "luckperms.net", href: "https://luckperms.net" },
  },
  GroupManager: {
    title: "Replace GroupManager",
    body: "GroupManager has been abandoned for years and breaks on modern servers. Migrate to LuckPerms.",
    link: { label: "luckperms.net", href: "https://luckperms.net" },
  },
  LagAssist: {
    title: "Remove LagAssist",
    body: "\"Anti-lag\" plugins mask symptoms instead of fixing causes. Profile with spark and fix the real hotspot.",
    link: SPARK,
  },
};

export function buildAdvice(f: Findings): AdviceItem[] {
  const items: AdviceItem[] = [];
  const add = (id: string, severity: Severity, entry: Omit<AdviceItem, "id" | "severity">) =>
    items.push({ id, severity, ...entry });

  if (f.malware.detected) {
    add("malware", "error", {
      title: "Remove the malware",
      body: "Delete the infected jars, rotate every credential the server had access to, and rescan the machine. Only reinstall plugins from their official sources.",
    });
  }
  if (f.oom.detected) {
    add("oom", "error", {
      title: "Increase memory or fix the leak",
      body: "The JVM ran out of memory. Raise -Xmx if the host has headroom, use Aikar's flags, and profile with spark if usage climbs over time (a leaking plugin).",
      link: AIKAR_FLAGS,
    });
  }
  if (hasWatchdogCrash(f)) {
    add("watchdog", "error", {
      title: "Find what stalled the main thread",
      body: "The watchdog fired because the main thread stopped responding. Check the thread dump in the log for the plugin at the top of the stack, and profile with spark.",
      link: SPARK,
    });
  }
  if (f.startup.portBindFailure) {
    add("port-bind", "error", {
      title: "Free the server port",
      body: "Another process is already bound to the port — usually a previous server instance that never exited. Stop it or change server-port in server.properties.",
    });
  }
  if (f.startup.eulaNotAccepted) {
    add("eula", "error", {
      title: "Accept the EULA",
      body: "Set eula=true in eula.txt next to the server jar, then start the server again.",
    });
  }
  if (f.startup.worldCorruption.count > 0) {
    add("corruption", "error", {
      title: "Restore from backup",
      body: "Region/chunk errors usually mean disk-level damage or a hard kill mid-save. Restore the newest healthy backup and stop the server with `stop`, never by killing the process.",
    });
  }
  if (!isSupported(f)) {
    add("unsupported", "error", {
      title: "Upgrade to a supported version",
      body: `Paper no longer publishes builds for ${f.mcVersion ?? "this version"} — no bug or security fixes. Upgrade to a current release.`,
      link: PAPER_DOWNLOADS,
    });
  }
  if (f.downgrade) {
    add("downgrade", "error", {
      title: "Don't downgrade a world",
      body: `This world was last saved by ${f.downgrade.from} but the server runs ${f.downgrade.to}. Restore a pre-upgrade backup or run the newer version — downgrades corrupt worlds.`,
    });
  }
  const javaIssue = javaIncompatibility(f);
  if (javaIssue === "old" && f.javaEnv.requiredJavaMajor !== null) {
    add("java-old", "error", {
      title: `Install Java ${f.javaEnv.requiredJavaMajor}`,
      body: `This Minecraft version needs Java ${f.javaEnv.requiredJavaMajor}+, but the server is running Java ${f.javaEnv.javaMajor}.`,
      link: { label: "Java install guide", href: "https://docs.papermc.io/misc/java-install" },
    });
  } else if (javaIssue === "new" && f.javaEnv.maxSupportedJavaMajor !== null) {
    add("java-new", "error", {
      title: "This build can't run on that Java",
      body: `The server build only supports up to Java ${f.javaEnv.maxSupportedJavaMajor}. Update the server jar, or run it with the older Java it expects.`,
      link: PAPER_DOWNLOADS,
    });
  }
  if (f.offline.isOffline) {
    add("offline", "error", {
      title: "Enable online mode",
      body: "Offline mode disables Mojang authentication — anyone can join as any username. Set online-mode=true, or secure your proxy's forwarding if you run one.",
      link: PAPER_DOCS,
    });
  }
  for (const err of f.pluginErrors) {
    add(`plugin-error-${err.plugin}-${err.phase}`, "error", {
      title: `Fix or remove ${err.plugin}`,
      body: `It failed while ${err.phase}. Update it to a build for your Minecraft version, or remove it if unmaintained.`,
    });
  }
  if (isSupported(f) && !isPaperUpToDate(f) && f.latestPaperVersion !== null) {
    add("outdated", "warning", {
      title: `Update Paper to build #${f.latestPaperVersion}`,
      body: `You're on build #${f.paperVersion ?? "?"} — newer builds carry bug and exploit fixes.`,
      link: PAPER_DOWNLOADS,
    });
  }
  if (f.performance.cantKeepUp.totalTicksSkipped > SEVERE_LAG_TICKS && !hasWatchdogCrash(f)) {
    add("lag", "warning", {
      title: "Profile the lag",
      body: `The server skipped ${f.performance.cantKeepUp.totalTicksSkipped} ticks. Profile with spark to find the hotspot, and make sure the JVM uses Aikar's flags.`,
      link: SPARK,
    });
  }
  if (f.missingDependencies.length > 0) {
    const deps = f.missingDependencies.map((d) => (Array.isArray(d) ? d.join(", ") : d)).join(", ");
    add("missing-deps", "warning", {
      title: "Install missing dependencies",
      body: `Plugins failed to load because these dependencies are missing: ${deps}.`,
    });
  }
  if (f.invalidConfig) {
    add("invalid-config", "warning", {
      title: "Fix the invalid config value",
      body: `At ${f.invalidConfig.locations.join(".")}: expected ${f.invalidConfig.validType}, got ${f.invalidConfig.invalidType}.`,
    });
  }
  if (f.legacyPlugins.length > 0) {
    add("legacy-plugins", "warning", {
      title: "Replace legacy plugins",
      body: `${f.legacyPlugins.map((p) => p.name).join(", ")} ${f.legacyPlugins.length === 1 ? "was" : "were"} built for pre-1.13 Bukkit and will misbehave. Look for maintained forks or replacements.`,
    });
  }
  // One item per distinct bad plugin actually loaded.
  const seen = new Set<string>();
  for (const plugin of f.plugins) {
    const entry = PLUGIN_ADVICE[plugin.name];
    if (entry && plugin.severity === "error" && !seen.has(plugin.name)) {
      seen.add(plugin.name);
      add(`plugin-${plugin.name}`, "warning", entry);
    }
  }
  return items;
}
