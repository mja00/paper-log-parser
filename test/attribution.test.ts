import { describe, expect, it } from "vitest";
import { suspectPlugins } from "../src/worker/parser/checks/attribution";
import type { PluginInfo } from "../src/worker/parser/types";

function plugin(name: string): PluginInfo {
  return { name, version: "1.0", severity: "ok" };
}

describe("suspectPlugins", () => {
  it("matches a frame package segment to a plugin name", () => {
    const frames = ["at com.sk89q.worldedit.bukkit.WorldEditPlugin.onCommand(WorldEditPlugin.java:401)"];
    expect(suspectPlugins(frames, [plugin("WorldEdit"), plugin("EssentialsX")])).toEqual(["WorldEdit"]);
  });

  it("matches by containment for long tokens", () => {
    const frames = ["at com.earth2me.essentials.commands.Commandtp.run(Commandtp.java:42)"];
    expect(suspectPlugins(frames, [plugin("EssentialsX")])).toEqual(["EssentialsX"]);
  });

  it("skips platform packages entirely", () => {
    const frames = [
      "at org.bukkit.plugin.java.JavaPlugin.setEnabled(JavaPlugin.java:264)",
      "at net.minecraft.server.MinecraftServer.tick(MinecraftServer.java:1000)",
      "at io.papermc.paper.plugin.manager.PaperPluginInstanceManager.enablePlugin(PaperPluginInstanceManager.java:200)",
    ];
    expect(suspectPlugins(frames, [plugin("Paper"), plugin("Java")])).toEqual([]);
  });

  it("does not containment-match short tokens like Core", () => {
    const frames = ["at com.example.coreutils.Handler.handle(Handler.java:10)"];
    expect(suspectPlugins(frames, [plugin("Core")])).toEqual([]);
  });

  it("returns an empty list with no plugins loaded", () => {
    const frames = ["at com.example.myplugin.Foo.bar(Foo.java:1)"];
    expect(suspectPlugins(frames, [])).toEqual([]);
  });

  it("dedupes a plugin implicated by multiple frames", () => {
    const frames = [
      "at com.sk89q.worldedit.EditSession.setBlock(EditSession.java:99)",
      "at com.sk89q.worldedit.bukkit.WorldEditPlugin.onCommand(WorldEditPlugin.java:401)",
    ];
    expect(suspectPlugins(frames, [plugin("WorldEdit")])).toEqual(["WorldEdit"]);
  });
});
