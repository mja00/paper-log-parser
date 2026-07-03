<script setup lang="ts">
import { computed } from "vue";
import type { Findings } from "../../worker/parser/types";
import { SEVERITY_COLORS } from "../lib/report";
import TooltipCard from "./TooltipCard.vue";
import ExceptionsPanel from "./ExceptionsPanel.vue";
import Icon from "./Icon.vue";

// Conditional detail panels. Each renders only when its finding is present, so a clean log
// collapses to just the verdict + tiles + plugins.
const props = defineProps<{ findings: Findings }>();
const f = computed(() => props.findings);

const missingDeps = computed(() =>
  f.value.missingDependencies.map((dep) => (Array.isArray(dep) ? dep.join(", ") : dep)),
);

const OOM_KIND_LABELS: Record<string, string> = {
  "heap-space": "Java heap space",
  "gc-overhead": "GC overhead limit exceeded",
  metaspace: "Metaspace",
  "native-thread": "Unable to create native thread",
  "direct-buffer": "Direct buffer memory",
  unknown: "Unknown kind",
};

const perf = computed(() => f.value.performance);
const hasPerfFindings = computed(
  () => perf.value.watchdog.crashCount > 0 || perf.value.cantKeepUp.count > 0,
);
const hasStartupFailure = computed(
  () => f.value.startup.portBindFailure || f.value.startup.eulaNotAccepted,
);
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2">
    <!-- Startup failures are fatal — the server never came up. Full-width callout. -->
    <TooltipCard
      v-if="hasStartupFailure"
      eyebrow="Startup failed"
      :title="f.startup.portBindFailure ? 'Failed to bind to port' : 'EULA not accepted'"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="x"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <p
        v-if="f.startup.portBindFailure"
        class="font-mono text-sm text-fg"
      >
        The server couldn't bind to its port — another process (probably another server instance) is
        already using it.
      </p>
      <p
        v-if="f.startup.eulaNotAccepted"
        class="font-mono text-sm text-fg"
      >
        The Minecraft EULA hasn't been accepted. Set <span :style="{ color: SEVERITY_COLORS.warning }">eula=true</span>
        in <span class="text-muted">eula.txt</span> and restart.
      </p>
    </TooltipCard>

    <TooltipCard
      v-if="f.oom.detected"
      eyebrow="Memory"
      title="Out of memory"
      :count="f.oom.count"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="warning"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm">
        <li
          v-for="kind in f.oom.kinds"
          :key="kind"
          :style="{ color: SEVERITY_COLORS.error }"
        >
          {{ OOM_KIND_LABELS[kind] ?? kind }}
        </li>
      </ul>
      <p class="mt-2 text-xs text-muted">
        Seen at line{{ f.oom.lineNumbers.length === 1 ? "" : "s" }} {{ f.oom.lineNumbers.slice(0, 6).join(", ") }}.
      </p>
    </TooltipCard>

    <TooltipCard
      v-if="hasPerfFindings"
      eyebrow="Performance"
      title="Lag & crashes"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="bolt"
          :style="{ color: SEVERITY_COLORS.warning }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm text-fg">
        <li v-if="perf.watchdog.crashCount > 0">
          <span :style="{ color: SEVERITY_COLORS.error }">Watchdog fired {{ perf.watchdog.crashCount }} time{{ perf.watchdog.crashCount === 1 ? "" : "s" }}</span>
          <span
            v-if="perf.watchdog.maxUnresponsiveSeconds !== null"
            class="text-muted"
          > — unresponsive for up to {{ perf.watchdog.maxUnresponsiveSeconds }}s</span>
          <span
            v-if="perf.watchdog.forcedShutdown"
            :style="{ color: SEVERITY_COLORS.error }"
          > · forcibly shut down</span>
        </li>
        <li v-if="perf.cantKeepUp.count > 0">
          <span :style="{ color: SEVERITY_COLORS.warning }">"Can't keep up!" × {{ perf.cantKeepUp.count }}</span>
          <span class="text-muted"> — {{ perf.cantKeepUp.totalTicksSkipped }} ticks skipped, worst {{ perf.cantKeepUp.maxMsBehind }}ms behind</span>
        </li>
      </ul>
      <p
        v-if="perf.watchdog.hasThreadDump"
        class="mt-2 text-xs text-muted"
      >
        A thread dump is in the log — look there for the plugin that stalled the server.
      </p>
    </TooltipCard>

    <TooltipCard
      v-if="f.startup.worldCorruption.count > 0"
      eyebrow="World"
      title="Possible corruption"
      :count="f.startup.worldCorruption.count"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="warning"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <ul class="space-y-1 font-mono text-xs">
        <li
          v-for="(sample, i) in f.startup.worldCorruption.samples"
          :key="i"
          class="break-words"
          :style="{ color: SEVERITY_COLORS.error }"
        >
          {{ sample }}
        </li>
      </ul>
    </TooltipCard>

    <TooltipCard
      v-if="f.pluginErrors.length > 0"
      eyebrow="Plugins"
      title="Plugin errors"
      :count="f.pluginErrors.length"
    >
      <template #icon>
        <Icon
          name="cube"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm">
        <li
          v-for="err in f.pluginErrors"
          :key="`${err.plugin}-${err.phase}`"
        >
          <span :style="{ color: SEVERITY_COLORS.error }">{{ err.plugin }}</span>
          <span
            v-if="err.version"
            class="text-muted"
          > v{{ err.version }}</span>
          <span class="text-muted"> — failed while {{ err.phase }}</span>
          <span
            v-if="err.count > 1"
            class="ml-1 rounded bg-white/10 px-1.5 font-mono text-[11px] text-fg"
          >×{{ err.count }}</span>
        </li>
      </ul>
    </TooltipCard>

    <TooltipCard
      v-if="f.legacyPlugins.length > 0"
      eyebrow="Outdated"
      title="Legacy plugins"
      :count="f.legacyPlugins.length"
    >
      <template #icon>
        <Icon
          name="info"
          :style="{ color: SEVERITY_COLORS.warning }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm text-fg">
        <li
          v-for="plugin in f.legacyPlugins"
          :key="plugin.name"
        >
          <span :style="{ color: SEVERITY_COLORS.warning }">{{ plugin.name }}</span>
          <span
            v-if="plugin.version"
            class="text-muted"
          > v{{ plugin.version }}</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-muted">
        Built for pre-1.13 Bukkit (no api-version) — expect breakage; look for updated forks.
      </p>
    </TooltipCard>

    <!-- Downgrade is a single hard error; spans full width as a callout. -->
    <TooltipCard
      v-if="f.downgrade"
      eyebrow="Not supported"
      title="Version downgrade"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="warning"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <p class="font-mono text-sm text-fg">
        Attempting to downgrade from
        <span :style="{ color: SEVERITY_COLORS.error }">{{ f.downgrade.from }}</span>
        to
        <span :style="{ color: SEVERITY_COLORS.error }">{{ f.downgrade.to }}</span>. This is not supported.
      </p>
    </TooltipCard>

    <TooltipCard
      v-if="f.invalidPlayers.length > 0"
      eyebrow="Suspicious"
      title="Invalid player UUIDs"
      :count="f.invalidPlayers.length"
    >
      <template #icon>
        <Icon
          name="shield"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm">
        <li
          v-for="player in f.invalidPlayers"
          :key="player.uuid"
          :style="{ color: SEVERITY_COLORS.error }"
        >
          {{ player.username }} <span class="text-muted">— {{ player.uuid }}</span>
        </li>
      </ul>
      <p class="mt-2 text-xs text-muted">
        These UUIDs either don't exist or belong to different usernames.
      </p>
    </TooltipCard>

    <TooltipCard
      v-if="f.ambiguous.detected"
      eyebrow="Duplicates"
      title="Ambiguous plugins"
      :count="f.ambiguous.plugins.length || undefined"
    >
      <template #icon>
        <Icon
          name="cube"
          :style="{ color: SEVERITY_COLORS.warning }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm text-fg">
        <li
          v-for="plugin in f.ambiguous.plugins"
          :key="plugin.pluginName"
        >
          <span :style="{ color: SEVERITY_COLORS.warning }">{{ plugin.pluginName }}</span>
          <span class="text-muted">: {{ plugin.pluginFilenames.join(", ") }}</span>
        </li>
      </ul>
    </TooltipCard>

    <TooltipCard
      v-if="missingDeps.length > 0"
      eyebrow="Missing"
      title="Plugin dependencies"
      :count="missingDeps.length"
    >
      <template #icon>
        <Icon
          name="link"
          :style="{ color: SEVERITY_COLORS.info }"
        />
      </template>
      <ul class="space-y-1 font-mono text-sm">
        <li
          v-for="(dep, i) in missingDeps"
          :key="i"
          :style="{ color: SEVERITY_COLORS.info }"
        >
          {{ dep }}
        </li>
      </ul>
    </TooltipCard>

    <TooltipCard
      v-if="f.possiblyCracked.cracked || f.pirated.detected"
      eyebrow="Integrity"
      title="Piracy indicators"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="shield"
          :style="{ color: SEVERITY_COLORS.info }"
        />
      </template>
      <div
        v-if="f.possiblyCracked.plugins.length > 0"
        class="mb-2"
      >
        <p class="mb-1 text-xs text-muted">
          Plugins that suggest a cracked server:
        </p>
        <ul class="space-y-1 font-mono text-sm text-fg">
          <li
            v-for="plugin in f.possiblyCracked.plugins"
            :key="plugin.name"
          >
            {{ plugin.name }} <span class="text-muted">v{{ plugin.version }}</span>
          </li>
        </ul>
      </div>
      <div v-if="f.pirated.lines.length > 0">
        <p class="mb-1 text-xs text-muted">
          Log lines that suggest piracy:
        </p>
        <ul class="space-y-1 font-mono text-xs">
          <li
            v-for="(line, i) in f.pirated.lines"
            :key="i"
            class="break-words"
            :style="{ color: SEVERITY_COLORS.info }"
          >
            {{ line }}
          </li>
        </ul>
      </div>
    </TooltipCard>

    <ExceptionsPanel
      v-if="f.exceptions.length > 0"
      :exceptions="f.exceptions"
    />

    <TooltipCard
      v-if="f.invalidConfig"
      eyebrow="Config"
      title="Invalid value"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="warning"
          :style="{ color: SEVERITY_COLORS.error }"
        />
      </template>
      <p class="font-mono text-sm text-fg">
        At <span :style="{ color: SEVERITY_COLORS.error }">{{ f.invalidConfig.locations.join(".") }}</span>:
        expected <span class="text-muted">{{ f.invalidConfig.validType }}</span>, got
        <span :style="{ color: SEVERITY_COLORS.error }">{{ f.invalidConfig.invalidType }}</span>.
      </p>
    </TooltipCard>
  </div>
</template>
