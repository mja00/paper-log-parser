// Drop the `[time] [thread/LEVEL]:` log prefix so the payload leads. Lines printed straight to
// stdout have no prefix, so a non-match returns the trimmed line unchanged.
export function stripPrefix(line: string): string {
  return line.replace(/^.*?\]:\s*/, "").trim();
}
