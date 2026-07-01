import { ImageResponse } from "workers-og";
import { robotoFont } from "./font";
import type { OgSnapshot } from "./cache";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pill(label: string, good: boolean): string {
  const bg = good ? "rgb(28,156,26)" : "rgb(156,26,26)";
  return `<div style="display:flex;align-items:center;justify-content:center;width:350px;height:50px;border-radius:10px;background:${bg};color:white;font-size:40px;margin-right:20px;">${escapeHtml(label)}</div>`;
}

// Recreate the legacy 1200x320 status card. Visually equivalent to the Pillow
// original (the Python descender-centering hack is not reproduced).
export function renderOgImage(og: OgSnapshot): ImageResponse {
  const subtitle = og.url.replace("https://", "");

  let flavorText = "Unknown server";
  if (og.flavorLine) {
    const flavor = og.flavorLine.split("This server is running")[1]?.split(" version ")[0]?.trim() ?? "Unknown";
    const version = og.flavorLine.split("version ")[1]?.split(" (")[0]?.trim() ?? "";
    flavorText = `${flavor} server ${version}`;
  }

  const bottomLine = og.invalidConfig
    ? `Invalid config at: ${og.invalidConfigLocations.join(".")}`
    : `Encountered ${og.exceptionCount} exceptions`;
  const bottomColor = og.invalidConfig ? "rgb(255,200,200)" : "white";

  const html = `<div style="display:flex;flex-direction:column;width:1200px;height:320px;background:rgb(48,49,54);font-family:Roboto;padding:10px 40px;color:white;">
    <div style="display:flex;font-size:30px;color:rgb(200,200,200);">${escapeHtml(subtitle)}</div>
    <div style="display:flex;flex-direction:row;margin-top:30px;">
      ${pill(og.isOffline ? "Offline Mode" : "Online Mode", !og.isOffline)}
      ${pill(og.hasMalware ? "Malware Detected" : "No Malware", !og.hasMalware)}
      ${pill(og.hasPiratedPlugins ? "Pirated Plugins" : "No Piracy", !og.hasPiratedPlugins)}
    </div>
    <div style="display:flex;font-size:30px;margin-top:40px;">${escapeHtml(flavorText)}</div>
    <div style="display:flex;font-size:30px;margin-top:10px;">Using ${og.pluginCount} plugins</div>
    <div style="display:flex;font-size:30px;margin-top:10px;color:${bottomColor};">${escapeHtml(bottomLine)}</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 320,
    fonts: [{ name: "Roboto", data: robotoFont, weight: 400, style: "normal" }],
  });
}
