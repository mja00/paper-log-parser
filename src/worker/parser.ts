import { Fore } from "./ansi";
import { getMcFromDataVersion, MAX_LOG_LENGTH } from "./constants";

const USER_AGENT = "Minecraft Latest.log Parser v1";
const FETCH_TIMEOUT_MS = 10_000;
// Cap on playerdb.co lookups + their concurrency, to stay under the Worker
// subrequest limit (50/req free, 1000 paid) on logs with many players.
const MAX_PLAYERS_VALIDATED = 25;
const PLAYER_VALIDATION_CONCURRENCY = 8;

// --- Regexes (compiled once at module scope; the Python port recompiled per line) ---
const ambiguousPluginRegex =
  /\[(\d\d:\d\d:\d\d)\] \[Server thread\/ERROR\]: \[ModernPluginLoadingStrategy\] Ambiguous plugin name '([^']+)' for files '([^']+)' and '([^']+)' in 'plugins\/\.paper-remapped'/;
const attemptedDowngradeRegex =
  /.*java\.lang\.RuntimeException: Server attempted to load chunk saved with newer version of minecraft! (\d+) > (\d+)/;
const malware1Regex = /at Updater.a\(:\d+\)/;
const badConfigRegex = /(\[(.*?)\]|java\.lang\.([a-zA-Z]+))/g;
const serverPluginRegex = /\[(.*)\](?:|:) Loading server plugin (.*) v(.*)/;
const pluginRegex = /\[(.*)\] Loading (.*) v(.*)/;
const uuidRegex = /UUID of player (.*) is (.*)/;
const paperVersion1Regex = /git-Paper-(\d+)/;
const paperVersion2Regex = /Paper version \d+\.\d+\.\d+-(\d+)-(master|main)/;
const pirateRegexes: RegExp[] = [
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

const BAD_PLUGINS = ["SkinsRestorer", "AuthMe", "nLogin", "ClearLagg", "FastClearLag", "PlugMan", "Skript"];
const MEH_PLUGINS = ["ViaVersion", "ProtocolLib", "ViaBackwards", "ViaRewind"];
const WEIRD_PLUGINS = ["AuthMe", "nLogin", "SkinsRestorer"];
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
const IGNORED_EXCEPTIONS = ["UnknownDependencyException", "CoercionFailedException"];
const SUPPORTED_VERSIONS = ["1.21.4"];

// Render a value the way Python's f-strings would (True/False/None), so the
// report output is byte-identical to the (bug-patched) Python implementation.
function pyStr(value: unknown): string {
  if (value === true) return "True";
  if (value === false) return "False";
  if (value === null || value === undefined) return "None";
  return String(value);
}

// Python list repr, e.g. ['a', 'b'] — used for the missing-dependency list case.
function pyListRepr(items: string[]): string {
  return `[${items.map((i) => `'${i}'`).join(", ")}]`;
}

// Match Python str.splitlines(): split on CR/LF/CRLF, and drop the single
// trailing empty element produced by a final line terminator.
export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function fetchWithUa(url: string, extraInit?: RequestInit): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...extraInit,
  });
}

export class Plugin {
  constructor(
    public name: string,
    public version: string,
  ) {}

  toString(): string {
    return `${this.name} v${this.version}`;
  }

  getColor(): string {
    if (BAD_PLUGINS.includes(this.name)) return Fore.RED;
    if (MEH_PLUGINS.includes(this.name)) return Fore.YELLOW;
    return Fore.GREEN;
  }
}

interface PlayerInfo {
  username: string;
  uuid: string;
}

interface AmbiguousPlugin {
  pluginName: string;
  pluginFilenames: string[];
}

interface ExceptionInfo {
  line: string;
  lineNumber: number;
}

export class LogFile {
  url: string;
  host = "";
  maxLines = MAX_LOG_LENGTH;
  plugins: Plugin[] = [];
  mcVersion: string | null = null;
  paperVersion: number | null = null;
  latestPaperVersion: number | null = null;
  flavor: string | null = null;
  flavorLine: string | null = null;
  supported = false;
  lines: string[] = [];
  isOffline = false;
  weirdPluginsAcquired: Plugin[] = [];
  runningPaper = false;
  possiblyCracked = false;
  hasPiratedPlugins = false;
  potentiallyPiratedLines: string[] = [];
  hasMissingDependencies = false;
  missingDependencies: (string | string[])[] = [];
  hasExceptions = false;
  exceptions: ExceptionInfo[] = [];
  hasAmbiguousPlugins = false;
  ambiguousPlugins: AmbiguousPlugin[] = [];
  attemptingToDowngrade = false;
  downgradedVersions: string[] = [];
  hasMalware = false;
  malwareCount = 0;
  invalidConfig = false;
  invalidConfigLocations: string[] = [];
  mockConfig = "";
  proxyFlavor = "";
  usingProxy = false;
  players: PlayerInfo[] = [];
  invalidPlayers: PlayerInfo[] = [];

  constructor(url: string) {
    this.url = url;
  }

  async runChecks(): Promise<void> {
    this.getHostFromUrl();
    await this.readUrlIntoMemory();
    if (this.lines.length === 0) return;
    this.analyze();
    await this.validate();
  }

  // All offline (non-network) checks over this.lines. Split out from runChecks
  // so the pure parsing logic is testable without fetching.
  analyze(): void {
    this.getFlavorLine();
    this.getPaperVersion();
    this.getPlugins();
    this.checkForAmbiguousPlugin();
    this.checkOfflineMode();
    this.checkForWeirdPlugins();
    this.checkForPaper();
    this.checkPossiblyCracked();
    this.checkForPiratedPlugins();
    this.checkForMissingDependencies();
    this.findExceptions();
    this.checkForAttemptedDowngrade();
    this.checkForMalware();
    this.checkConfig();
    this.getPlayers();
  }

  // Network-dependent checks (playerdb validation + latest Paper build).
  async validate(): Promise<void> {
    await this.validatePlayers();
    this.latestPaperVersion = await this.getLatestPaperVersion();
  }

  private getHostFromUrl(): void {
    try {
      this.host = new URL(this.url).hostname;
    } catch {
      this.host = "";
    }
  }

  private async readUrlIntoMemory(): Promise<void> {
    let resp: Response;
    switch (this.host) {
      case "paste.gg": {
        if (!this.url.endsWith("raw")) {
          const htmlResp = await fetchWithUa(this.url);
          const rawHref = await extractPasteGgRawHref(htmlResp);
          if (rawHref === null) {
            // No raw link found — treat as unsupported/blank (mirrors the empty path).
            this.lines = [];
            return;
          }
          resp = await fetchWithUa(`https://paste.gg${rawHref}`);
        } else {
          resp = await fetchWithUa(this.url);
        }
        break;
      }
      case "pastes.dev": {
        resp = await fetchWithUa(this.url.replace("pastes.dev", "api.pastes.dev"));
        break;
      }
      case "api.pastes.dev": {
        resp = await fetchWithUa(this.url);
        break;
      }
      case "pastebin.com": {
        resp = await fetchWithUa(this.url.replace("pastebin.com", "pastebin.com/raw"));
        break;
      }
      case "mclo.gs": {
        const id = this.url.split("/").pop() ?? "";
        resp = await fetchWithUa(`https://api.mclo.gs/1/raw/${id}`);
        break;
      }
      default: {
        // Not a site we support.
        this.lines = [];
        return;
      }
    }
    const text = await resp.text();
    this.lines = splitLines(text);
  }

  private getFlavorLine(): void {
    let lineCount = 0;
    for (const line of this.lines) {
      if (line.includes("This server is running")) {
        this.flavorLine = line;
        this.getMcVersion();
        this.getServerFlavor();
        return;
      }
      lineCount += 1;
      if (lineCount > this.maxLines) return;
    }
  }

  private getMcVersion(): void {
    if (this.flavorLine === null) return;
    const block = this.flavorLine.split("(Implementing API version ")[1];
    this.mcVersion = block.split("-")[0];
    if (SUPPORTED_VERSIONS.includes(this.mcVersion)) {
      this.supported = true;
    }
  }

  private getServerFlavor(): void {
    if (this.flavorLine === null) return;
    this.flavor = this.flavorLine.split("This server is running ")[1].split(" version ")[0].trim();
  }

  private getPaperVersion(): void {
    if (this.flavor === null || this.flavorLine === null) return;
    const match = paperVersion1Regex.exec(this.flavor);
    const match2 = paperVersion2Regex.exec(this.flavorLine);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      this.paperVersion = Number.isNaN(parsed) ? null : parsed;
      this.runningPaper = true;
    } else if (match2) {
      const parsed = Number.parseInt(match2[1], 10);
      this.paperVersion = Number.isNaN(parsed) ? null : parsed;
      this.runningPaper = true;
    }
  }

  private async getFromApi(): Promise<number | null> {
    if (this.mcVersion === null) return null;
    const apiUrl = `https://api.papermc.io/v2/projects/paper/versions/${this.mcVersion}`;
    // PaperMC 404s for unknown versions; cf-cache successful responses for 30 min.
    const resp = await fetchWithUa(apiUrl, { cf: { cacheTtl: 1800, cacheEverything: true } });
    if (resp.status === 200) {
      const data = (await resp.json()) as { builds: number[] };
      return data.builds[data.builds.length - 1] ?? null;
    }
    return null;
  }

  private async getLatestPaperVersion(): Promise<number | null> {
    return this.getFromApi();
  }

  private getPlugins(): void {
    let checkedLines = 0;
    for (const line of this.lines) {
      if (line.includes("Preparing level")) return;
      const regex = line.includes("server plugin") ? serverPluginRegex : pluginRegex;
      const match = regex.exec(line);
      if (match) {
        this.plugins.push(new Plugin(match[2], match[3]));
      }
      checkedLines += 1;
      if (checkedLines > this.maxLines) return;
    }
  }

  private checkOfflineMode(): void {
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].includes("SERVER IS RUNNING IN OFFLINE/INSECURE MODE!")) {
        // Check the next 10 lines for a proxy mention (bounded to avoid the
        // Python IndexError near EOF). A proxy short-circuits the offline verdict.
        let foundProxy = false;
        for (let j = i; j < i + 10 && j < this.lines.length; j++) {
          if (this.lines[j].includes("BungeeCord")) {
            this.proxyFlavor = "BungeeCord";
            this.usingProxy = true;
            foundProxy = true;
            break;
          }
          if (this.lines[j].includes("Velocity")) {
            this.proxyFlavor = "Velocity";
            this.usingProxy = true;
            foundProxy = true;
            break;
          }
        }
        if (foundProxy) return;
        this.isOffline = true;
      }
    }
  }

  private checkForWeirdPlugins(): void {
    for (const plugin of this.plugins) {
      if (WEIRD_PLUGINS.includes(plugin.name)) {
        this.weirdPluginsAcquired.push(plugin);
      }
    }
  }

  private checkPossiblyCracked(): void {
    if (this.weirdPluginsAcquired.length > 0) {
      this.possiblyCracked = true;
    }
  }

  private checkForPaper(): void {
    if (this.flavor === null) return;
    if (this.flavor.includes("Paper version") && this.flavor.includes("git-Paper")) {
      this.runningPaper = true;
    }
  }

  private getPlayers(): void {
    for (const line of this.lines) {
      const match = uuidRegex.exec(line);
      if (match) {
        const playerInfo: PlayerInfo = { username: match[1], uuid: match[2] };
        if (!this.players.some((p) => p.username === playerInfo.username && p.uuid === playerInfo.uuid)) {
          this.players.push(playerInfo);
        }
      }
    }
  }

  private async validatePlayers(): Promise<void> {
    const toValidate = this.players.slice(0, MAX_PLAYERS_VALIDATED);
    const results: boolean[] = new Array(toValidate.length).fill(false);

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < toValidate.length) {
        const index = cursor++;
        results[index] = await this.isPlayerInvalid(toValidate[index]);
      }
    };
    const workers = Array.from(
      { length: Math.min(PLAYER_VALIDATION_CONCURRENCY, toValidate.length) },
      () => worker(),
    );
    await Promise.all(workers);

    // Preserve original player order in invalidPlayers (matches Python iteration).
    toValidate.forEach((player, index) => {
      if (results[index]) this.invalidPlayers.push(player);
    });
  }

  private async isPlayerInvalid(player: PlayerInfo): Promise<boolean> {
    try {
      const resp = await fetchWithUa(`https://playerdb.co/api/player/minecraft/${player.uuid}`);
      if (resp.status === 200) {
        const data = (await resp.json()) as { data: { player: { username: string } } };
        // Non-matching username indicates a cracked/fake UUID.
        return data.data.player.username !== player.username;
      }
      // Non-200 (incl. 429) marks the player invalid — preserves the legacy
      // behavior, which can produce false positives under rate limiting.
      return true;
    } catch {
      return true;
    }
  }

  private checkForPiratedPlugins(): void {
    let linesChecked = 0;
    for (const line of this.lines) {
      let matched: RegExpExecArray | null = null;
      for (const regex of pirateRegexes) {
        matched = regex.exec(line);
        if (matched) break;
      }
      if (matched) {
        this.potentiallyPiratedLines.push(matched[0]);
        this.hasPiratedPlugins = true;
      } else if (PIRATE_GIVEAWAYS.some((word) => line.toLowerCase().includes(word)) && line.includes("STDOUT")) {
        this.potentiallyPiratedLines.push(line);
        this.hasPiratedPlugins = true;
      }
      linesChecked += 1;
      if (linesChecked > this.maxLines) return;
    }
  }

  private checkForMissingDependencies(): void {
    let linesChecked = 0;
    for (const line of this.lines) {
      if (line.includes("org.bukkit.plugin.UnknownDependencyException")) {
        this.hasMissingDependencies = true;
        let dependencies = line.split("Unknown/missing dependency plugins: ")[1].split(".")[0];
        dependencies = dependencies.replace(/\[/g, "").replace(/\]/g, "");
        if (dependencies.includes(",")) {
          this.missingDependencies.push(dependencies.split(","));
        } else {
          this.missingDependencies.push(dependencies);
        }
      }
      linesChecked += 1;
      if (linesChecked > this.maxLines) return;
    }
  }

  private findExceptions(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.includes("Exception") && !line.includes("lost connection")) {
        if (!IGNORED_EXCEPTIONS.some((word) => line.includes(word))) {
          this.hasExceptions = true;
          this.exceptions.push({ line, lineNumber: i });
        }
      }
      if (i > this.maxLines) return;
    }
  }

  private checkForAmbiguousPlugin(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.includes("Ambiguous plugin name")) {
        this.hasAmbiguousPlugins = true;
        const matches = ambiguousPluginRegex.exec(line);
        if (matches) {
          const pluginName = matches[2];
          const pluginFilenames = matches.slice(3).filter((g): g is string => g !== undefined);
          this.ambiguousPlugins.push({ pluginName, pluginFilenames });
        }
      }
      if (i > this.maxLines) return;
    }
  }

  private checkForAttemptedDowngrade(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const match = attemptedDowngradeRegex.exec(this.lines[i]);
      if (match) {
        this.attemptingToDowngrade = true;
        this.downgradedVersions = [getMcFromDataVersion(match[1]), getMcFromDataVersion(match[2])];
      }
      if (i > this.maxLines) return;
    }
  }

  private checkForMalware(): void {
    for (let i = 0; i < this.lines.length; i++) {
      if (malware1Regex.test(this.lines[i])) {
        this.hasMalware = true;
        this.malwareCount += 1;
      }
      if (i > this.maxLines) return;
    }
  }

  private checkConfig(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (line.includes("org.spongepowered.configurate.serialize.CoercionFailedException")) {
        this.invalidConfig = true;
        const matches = [...line.matchAll(badConfigRegex)];
        const configLocation = (matches[0]?.[2] ?? "").split(", ");
        this.invalidConfigLocations = configLocation;
        const validType = matches[1]?.[3] ?? "";
        const invalidType = matches[2]?.[3] ?? "";

        let mockConfig = `${Fore.WHITE}`;
        configLocation.forEach((location, locI) => {
          if (locI === 0) {
            mockConfig += `"${location}": {`;
          } else if (locI === configLocation.length - 1) {
            mockConfig += `\n${" ".repeat(locI * 4)}"${location}": `;
          } else {
            mockConfig += `\n${" ".repeat(locI * 4)}"${location}": {`;
          }
        });
        switch (invalidType) {
          case "String":
            mockConfig += `"${invalidType}"`;
            break;
          case "Integer":
            mockConfig += `${invalidType}`;
            break;
          case "Boolean":
            mockConfig += `${invalidType}`;
            break;
          default:
            mockConfig += `"${invalidType}"`;
            break;
        }
        mockConfig += `, <-- ${Fore.RED}ERROR`;
        mockConfig += ` (should be ${validType})${Fore.RESET}`;
        [...configLocation].reverse().forEach((_location, locI) => {
          if (locI === 0) return;
          mockConfig += `\n${" ".repeat((configLocation.length - (locI + 1)) * 4)}}`;
        });

        this.mockConfig = mockConfig;
        return;
      }
      if (i > this.maxLines) return;
    }
  }

  private outputPluginsForReport(): string[] {
    const output: string[] = [];
    for (const plugin of this.plugins) {
      output.push(`${plugin.getColor()}${plugin.toString()}${Fore.RESET}`);
    }
    output.push(`${Fore.GREEN}==============================`);
    return output;
  }

  getReportAsString(): string[] {
    const output: string[] = [];
    // Bug fix: legacy parser used `Fore.REDz` here, which crashed on every
    // non-supported version. Corrected to Fore.RED.
    let color = this.supported ? Fore.GREEN : Fore.RED;
    output.push(`${color}Minecraft Version: ${pyStr(this.mcVersion)}${Fore.RESET}`);
    color = this.runningPaper ? Fore.GREEN : Fore.RED;
    output.push(`${color}Server Flavor: ${pyStr(this.flavor)}${Fore.RESET}`);
    color = this.paperVersion === this.latestPaperVersion ? Fore.GREEN : Fore.RED;
    output.push(`${color}Paper Version: ${pyStr(this.paperVersion)}${Fore.RESET}`);
    color = !this.isOffline ? Fore.GREEN : Fore.RED;
    output.push(`${color}Offline Mode: ${pyStr(this.isOffline)}${Fore.RESET}`);
    color = !this.hasMalware ? Fore.GREEN : Fore.RED;
    if (this.usingProxy) {
      output.push(`${Fore.CYAN}Using ${this.proxyFlavor} proxy`);
    }
    output.push(`${color}Malware Detected: ${pyStr(this.hasMalware)}${Fore.RESET}`);
    if (this.attemptingToDowngrade) {
      output.push(
        `${Fore.RED}Server is attempting to downgrade. This is not supported! You're going from ${this.downgradedVersions[0]} to ${this.downgradedVersions[1]}${Fore.RESET}`,
      );
    }
    if (this.invalidPlayers.length > 0) {
      output.push(`${Fore.RED}==============================${Fore.RESET}`);
      output.push(`${Fore.RED}The following players have invalid UUIDs: ${Fore.RESET}`);
      for (const player of this.invalidPlayers) {
        output.push(`${Fore.RED}${player.username} - ${player.uuid}${Fore.RESET}`);
      }
      output.push(`${Fore.RED}These UUIDs either do not exist, or are for different usernames.${Fore.RESET}`);
    }
    output.push(`${Fore.GREEN}============PLUGINS============${Fore.RESET}`);
    for (const line of this.outputPluginsForReport()) {
      output.push(line);
    }
    if (this.hasAmbiguousPlugins) {
      output.pop();
      output.push(`${Fore.YELLOW}==========AMBIGUOUS PLUGINS==========${Fore.RESET}`);
      for (const plugin of this.ambiguousPlugins) {
        output.push(`${Fore.YELLOW}Plugin Name: ${plugin.pluginName}`);
        output.push(`${Fore.YELLOW}Plugin Filenames: ${pyListRepr(plugin.pluginFilenames)}`);
      }
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    if (this.hasMissingDependencies) {
      output.push(`${Fore.CYAN}Server has missing dependencies. The following dependencies are missing: ${Fore.RESET}`);
      for (const dependency of this.missingDependencies) {
        const rendered = Array.isArray(dependency) ? pyListRepr(dependency) : dependency;
        output.push(`${Fore.CYAN}${rendered}${Fore.RESET}`);
      }
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    if (this.possiblyCracked) {
      output.push(`${Fore.CYAN}Server is possibly cracked. The following plugins suggest this: ${Fore.RESET}`);
      for (const plugin of this.weirdPluginsAcquired) {
        output.push(`${plugin.getColor()}${plugin.toString()}${Fore.RESET}`);
      }
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    if (this.hasPiratedPlugins) {
      output.push(`${Fore.CYAN}Server has pirated plugins. The following lines suggest this: ${Fore.RESET}`);
      for (const line of this.potentiallyPiratedLines) {
        output.push(`${Fore.CYAN}${line}${Fore.RESET}`);
      }
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    if (this.hasExceptions) {
      output.push(`${Fore.CYAN}Server has exceptions. The following exceptions were found: ${Fore.RESET}`);
      for (const exception of this.exceptions) {
        output.push(`${Fore.CYAN}Line ${exception.lineNumber}: ${Fore.YELLOW}${exception.line}${Fore.RESET}`);
      }
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    if (this.invalidConfig) {
      output.push(`${Fore.RED}Server has an invalid config. Use the following info to fix it! ${Fore.RESET}`);
      output.push(this.mockConfig);
      output.push(`${Fore.YELLOW}You should find lines like look like this in your Paper configs.`);
      output.push(`${Fore.GREEN}==============================${Fore.RESET}`);
    }
    return output;
  }
}

// Stream the paste.gg HTML and capture the raw-download link's href. Replaces
// the legacy BeautifulSoup `a.is-pulled-right.button` lookup.
async function extractPasteGgRawHref(resp: Response): Promise<string | null> {
  let rawHref: string | null = null;
  const rewriter = new HTMLRewriter().on("a.is-pulled-right.button", {
    element(el) {
      if (rawHref === null) {
        rawHref = el.getAttribute("href");
      }
    },
  });
  // Consume the transformed stream so the handler runs.
  await rewriter.transform(resp).text();
  return rawHref;
}
