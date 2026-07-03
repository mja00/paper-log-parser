<script setup lang="ts">
import TooltipCard from "./TooltipCard.vue";
import { SEVERITY_COLORS } from "../lib/report";
import type { HistoryEntry } from "../lib/history";

defineProps<{ entries: HistoryEntry[] }>();
defineEmits<{ select: [url: string]; clear: [] }>();

function shortTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <TooltipCard
    eyebrow="History"
    title="Recent scans"
    :count="entries.length"
  >
    <ul class="space-y-1">
      <li
        v-for="entry in entries"
        :key="entry.url"
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-white/5"
          @click="$emit('select', entry.url)"
        >
          <span
            class="h-2 w-2 shrink-0 rounded-full"
            :style="{ backgroundColor: SEVERITY_COLORS[entry.status] }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate font-mono text-xs text-fg">{{ entry.url }}</span>
          <span class="hidden shrink-0 text-xs text-muted sm:inline">{{ entry.headline }}</span>
          <span class="shrink-0 font-mono text-[10px] text-muted">{{ shortTime(entry.parsedAt) }}</span>
        </button>
      </li>
    </ul>
    <div class="mt-2 text-right">
      <button
        type="button"
        class="font-mono text-xs text-muted transition hover:text-fg"
        @click="$emit('clear')"
      >
        Clear history
      </button>
    </div>
  </TooltipCard>
</template>
