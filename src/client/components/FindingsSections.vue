<script setup lang="ts">
import { computed } from "vue";
import type { Findings } from "../../worker/parser/types";
import { SEVERITY_COLORS } from "../lib/report";
import TooltipCard from "./TooltipCard.vue";
import Icon from "./Icon.vue";

// Conditional detail panels. Each renders only when its finding is present, so a clean log
// collapses to just the verdict + tiles + plugins.
const props = defineProps<{ findings: Findings }>();
const f = computed(() => props.findings);

const missingDeps = computed(() =>
  f.value.missingDependencies.map((dep) => (Array.isArray(dep) ? dep.join(", ") : dep)),
);
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2">
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

    <TooltipCard
      v-if="f.exceptions.length > 0"
      eyebrow="Stack traces"
      title="Exceptions"
      :count="f.exceptions.length"
      class="md:col-span-2"
    >
      <template #icon>
        <Icon
          name="bolt"
          :style="{ color: SEVERITY_COLORS.warning }"
        />
      </template>
      <ul class="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
        <li
          v-for="ex in f.exceptions"
          :key="ex.lineNumber"
          class="break-words"
        >
          <span class="text-muted">Line {{ ex.lineNumber }}:</span>
          <span :style="{ color: SEVERITY_COLORS.warning }"> {{ ex.line }}</span>
        </li>
      </ul>
    </TooltipCard>

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
