// Compiled once at module scope (the original Python port recompiled per line).

export const ambiguousPluginRegex =
  /\[(\d\d:\d\d:\d\d)\] \[Server thread\/ERROR\]: \[ModernPluginLoadingStrategy\] Ambiguous plugin name '([^']+)' for files '([^']+)' and '([^']+)' in 'plugins\/\.paper-remapped'/;
export const attemptedDowngradeRegex =
  /.*java\.lang\.RuntimeException: Server attempted to load chunk saved with newer version of minecraft! (\d+) > (\d+)/;
export const malware1Regex = /at Updater.a\(:\d+\)/;
export const badConfigRegex = /(\[(.*?)\]|java\.lang\.([a-zA-Z]+))/g;
export const serverPluginRegex = /\[(.*)\](?:|:) Loading server plugin (.*) v(.*)/;
export const pluginRegex = /\[(.*)\] Loading (.*) v(.*)/;
export const uuidRegex = /UUID of player (.*) is (.*)/;
export const paperVersion1Regex = /git-Paper-(\d+)/;
// Build number after the MC version, e.g. "26.2-36-dev", "26.1.2-63-main", "1.21.4-26-master".
export const paperVersion2Regex = /Paper version [\d.]+-(\d+)-/;
export const startingVersionRegex = /Starting minecraft server version (\S+)/;
export const watchdogUnresponsiveRegex = /The server has not responded for (\d+) seconds/;
export const oomRegex = /java\.lang\.OutOfMemoryError(?::\s*(.+))?/;
// World/region corruption signals. Only "wrong location" is verified verbatim; the rest are kept
// loose and the matched lines are surfaced raw as evidence.
export const corruptionRegexes: RegExp[] = [
  /Chunk file at -?\d+,-?\d+ is in the wrong location/,
  /Failed to (?:read|store|load) chunk/,
  /(?:RegionFile|[Rr]egion file).*(?:truncated|corrupt|invalid)/,
];
export const cantKeepUpRegex = /Can't keep up! Is the server overloaded\? Running (\d+)ms or (\d+) ticks behind/;

export const pirateRegexes: RegExp[] = [
  // Common leak message
  /\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: \[[\w]+\] \[[\w]+\] \[[\w]+\] Leaked by [\w]+ @ [A-Za-z.]+/,
  // [06:10:18] [Server thread/INFO]: [LifestealCore] \x1b[36m[Spigotunlocked.net] - COSMO
  // The legacy regex has a literal ESC (\x1b) before [36m, so it only matches lines with the
  // raw ANSI color code — NOT ordinary plugin-load lines. Preserve it exactly.
  // eslint-disable-next-line no-control-regex
  /\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: \[[\w]+\] \x1b[36m[Spigotunlocked.net\] - [\w]+/,
  // Matches a "Downloaded from directleaks.*" message
  /\[\d{2}:\d{2}:\d{2}\] \[Server thread\/INFO\]: \[[\w]+\] Downloaded from (?:.*directleaks.*)/,
];
