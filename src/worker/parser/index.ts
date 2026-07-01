import { type Findings, newFindings } from "./types";
import { analyzeLines } from "./engine";
import { fetchLogText, validatePlayers, getLatestPaperVersion } from "./network";

export type { Findings } from "./types";

// Match Python str.splitlines(): split on CR/LF/CRLF, and drop the single trailing empty element
// produced by a final line terminator.
export function splitLines(text: string): string[] {
  const lines = text.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

// Orchestrates fetch → single-pass detection → network validation. All results live in `findings`.
export class LogFile {
  url: string;
  host = "";
  lines: string[] = [];
  findings: Findings = newFindings();

  constructor(url: string) {
    this.url = url;
  }

  async runChecks(): Promise<void> {
    this.getHostFromUrl();
    this.lines = splitLines(await fetchLogText(this.url, this.host));
    if (this.lines.length === 0) return;
    this.analyze();
    await this.validate();
  }

  // Offline (non-network) detection over this.lines — the single pass.
  analyze(): void {
    this.findings = analyzeLines(this.lines);
  }

  // Network-dependent checks. Player validation and the Paper-build lookup are independent, so
  // run them concurrently to save a round-trip.
  async validate(): Promise<void> {
    const [invalidPlayers, latestPaperVersion] = await Promise.all([
      validatePlayers(this.findings.players),
      getLatestPaperVersion(this.findings.mcVersion),
    ]);
    this.findings.invalidPlayers = invalidPlayers;
    this.findings.latestPaperVersion = latestPaperVersion;
  }

  private getHostFromUrl(): void {
    try {
      this.host = new URL(this.url).hostname;
    } catch {
      this.host = "";
    }
  }
}
