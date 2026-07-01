<script setup lang="ts">
import { computed } from "vue";
import { VList } from "virtua/vue";
import type { Findings } from "../../worker/parser/types";
import { buildReport, SEVERITY_COLORS } from "../lib/report";

const props = defineProps<{ findings: Findings }>();

// virtua only mounts visible rows; the report is a flat list of severity-tagged items.
const items = computed(() => buildReport(props.findings));
</script>

<template>
  <VList
    :data="items"
    class="output"
  >
    <template #default="{ item }">
      <!-- Text is bound via interpolation (Vue-escaped), so raw log content is safe — no v-html. -->
      <pre
        class="output-line"
        :class="{ 'output-header': item.kind === 'header' }"
        :style="{ color: SEVERITY_COLORS[item.severity] }"
      >{{ item.text }}</pre>
    </template>
  </VList>
</template>

<style scoped>
.output {
  background-color: black;
  border-radius: 5px;
  height: 100%;
}
.output-line {
  margin: 0;
  padding: 0 4px;
  white-space: pre-wrap;
  word-break: break-word;
  color: white;
  font-family: var(--bs-font-monospace, monospace);
}
.output-header {
  margin-top: 12px;
  font-weight: bold;
  text-decoration: underline;
}
</style>
