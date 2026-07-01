<script setup lang="ts">
import { computed } from "vue";
import { VList } from "virtua/vue";
import { ansiColorParse } from "../lib/ansi";

const props = defineProps<{ lines: string[] }>();

// Pre-parse each ANSI line to HTML once; virtua only mounts visible rows.
const renderedLines = computed(() => props.lines.map((line) => ansiColorParse(line)));
</script>

<template>
  <VList
    :data="renderedLines"
    class="output"
  >
    <template #default="{ item }">
      <!-- item is HTML-escaped in ansiColorParse before color tags are added (vue/no-v-html disabled for this file) -->
      <pre
        class="output-line"
        v-html="item"
      />
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
</style>
