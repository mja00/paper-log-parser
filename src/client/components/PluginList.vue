<script setup lang="ts">
import { computed, ref } from "vue";
import { VList } from "virtua/vue";
import type { PluginInfo } from "../../worker/parser/types";
import { SEVERITY_COLORS } from "../lib/report";
import TooltipCard from "./TooltipCard.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ plugins: PluginInfo[] }>();

const onlyProblems = ref(false);
const query = ref("");

const problemCount = computed(
  () => props.plugins.filter((p) => p.severity === "error" || p.severity === "warning").length,
);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return props.plugins.filter((p) => {
    if (onlyProblems.value && p.severity !== "error" && p.severity !== "warning") return false;
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  });
});

// virtua needs a bounded height; cap the visible window at ~9 rows and let the rest scroll.
const listHeight = computed(() => `${Math.min(Math.max(filtered.value.length, 1), 9) * 34}px`);
</script>

<template>
  <TooltipCard
    eyebrow="Loaded"
    title="Plugins"
    :count="plugins.length"
  >
    <template #icon>
      <Icon
        name="cube"
        class="text-accent"
      />
    </template>

    <div class="mb-2 flex flex-wrap items-center gap-2">
      <label
        for="pluginFilter"
        class="sr-only"
      >Filter plugins</label>
      <input
        id="pluginFilter"
        v-model="query"
        type="text"
        placeholder="Filter plugins…"
        class="min-w-0 flex-1 rounded border border-hair bg-black/30 px-2 py-1 font-mono text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      >
      <button
        type="button"
        class="shrink-0 rounded border px-2 py-1 font-mono text-xs transition-colors"
        :class="onlyProblems ? 'border-accent text-accent' : 'border-hair text-muted hover:text-fg'"
        :disabled="problemCount === 0"
        @click="onlyProblems = !onlyProblems"
      >
        Only problems ({{ problemCount }})
      </button>
    </div>

    <p
      v-if="filtered.length === 0"
      class="py-3 text-center font-mono text-sm text-muted"
    >
      No matching plugins.
    </p>
    <VList
      v-else
      :data="filtered"
      :style="{ height: listHeight }"
    >
      <template #default="{ item }">
        <div class="flex items-center gap-2 py-1 font-mono text-sm">
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :style="{ backgroundColor: SEVERITY_COLORS[item.severity] }"
          />
          <span class="truncate text-fg">{{ item.name }}</span>
          <span class="ml-auto shrink-0 text-muted">v{{ item.version }}</span>
        </div>
      </template>
    </VList>
  </TooltipCard>
</template>
