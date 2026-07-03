<script setup lang="ts">
import { computed } from "vue";
import type { Findings } from "../../worker/parser/types";
import { buildVerdict, SEVERITY_COLORS } from "../lib/report";
import { SEVERITY_ICON } from "../lib/severity";
import Icon from "./Icon.vue";

// The hero after a parse: an advancement-toast-style banner carrying the single top-line signal.
const props = defineProps<{ findings: Findings }>();

const verdict = computed(() => buildVerdict(props.findings));
const color = computed(() => SEVERITY_COLORS[verdict.value.status]);
const subtitle = computed(() => {
  const n = verdict.value.issueCount;
  return n === 0 ? "No issues found" : `${n} issue${n === 1 ? "" : "s"} found`;
});
</script>

<template>
  <section class="tooltip-frame toast-in flex items-center gap-4 p-3">
    <div
      class="grid h-14 w-14 shrink-0 place-items-center rounded text-2xl"
      :style="{ backgroundColor: `${color}1a`, color }"
    >
      <Icon :name="SEVERITY_ICON[verdict.status]" />
    </div>
    <div class="min-w-0">
      <p class="font-display text-[10px] uppercase tracking-[0.25em] text-muted">
        Scan complete
      </p>
      <h2
        class="font-display text-lg leading-tight sm:text-2xl"
        :style="{ color }"
      >
        {{ verdict.headline }}
      </h2>
      <p class="mt-1 font-mono text-sm text-muted">
        {{ subtitle }}
      </p>
    </div>
  </section>
</template>

<style scoped>
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.toast-in {
  animation: toast-in 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
