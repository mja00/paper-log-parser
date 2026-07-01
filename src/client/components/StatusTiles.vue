<script setup lang="ts">
import { computed } from "vue";
import type { Findings } from "../../worker/parser/types";
import { buildStatusTiles, SEVERITY_COLORS } from "../lib/report";
import { SEVERITY_ICON } from "../lib/severity";
import Icon from "./Icon.vue";

// The at-a-glance row: version / flavor / build / mode / malware, each colored by severity.
const props = defineProps<{ findings: Findings }>();
const tiles = computed(() => buildStatusTiles(props.findings));
</script>

<template>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
    <div
      v-for="(tile, i) in tiles"
      :key="tile.label"
      class="tile-in tooltip-frame p-3"
      :style="{ animationDelay: `${i * 60}ms` }"
    >
      <div class="flex items-center justify-between">
        <span class="font-display text-[9px] uppercase tracking-[0.18em] text-muted">{{ tile.label }}</span>
        <Icon
          :name="SEVERITY_ICON[tile.severity]"
          class="text-sm"
          :style="{ color: SEVERITY_COLORS[tile.severity] }"
        />
      </div>
      <p
        class="mt-2 truncate font-mono text-lg"
        :style="{ color: SEVERITY_COLORS[tile.severity] }"
      >
        {{ tile.value }}
      </p>
      <p
        v-if="tile.note"
        class="truncate font-mono text-xs text-muted"
      >
        {{ tile.note }}
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes tile-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.tile-in {
  animation: tile-in 0.4s both cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
