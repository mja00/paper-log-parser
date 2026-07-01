/* eslint-disable no-control-regex -- the ANSI ESC (\x1b) control char is matched on purpose */
// Client-side ANSI → HTML renderer, ported from the legacy ansiColorParse.
// The render palette is Minecraft-style hex (distinct from the worker's
// colorama emit codes). The Worker emits ESC sequences; we map them here.
const foregroundColors: Record<string, string> = {
  "30": "black",
  "31": "#FF5555",
  "32": "#55FF55",
  "33": "#FFFF55",
  "34": "#5555FF",
  "35": "#AA00AA",
  "36": "#55FFFF",
  "37": "white",
};

// Escape log text before injecting the color tags, so user-controlled log
// content can't smuggle markup through v-html (the legacy version did not).
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function ansiColorParse(line: string): string {
  let result = escapeHtml(line);

  for (const ansi of Object.keys(foregroundColors)) {
    const span = `<code style="color: ${foregroundColors[ansi]}; padding-left: 2px;">`;
    result = result
      .replace(new RegExp(`\\x1b\\[${ansi}m`, "g"), span)
      .replace(new RegExp(`\\x1b\\[0;${ansi}m`, "g"), span);
  }

  // Bold (1m / 22m) and italics (3m / 23m).
  result = result.replace(/\x1b\[1m/g, "<b>").replace(/\x1b\[22m/g, "</b>");
  result = result.replace(/\x1b\[3m/g, "<i>").replace(/\x1b\[23m/g, "</i>");

  // Reset / close codes.
  result = result.replace(/\x1b\[m/g, "</code>");
  result = result.replace(/\x1b\[0m/g, "</code>");
  return result.replace(/\x1b\[39m/g, "</code>");
}
