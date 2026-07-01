<script setup lang="ts">
import type { Findings } from "../../worker/parser/types";
import VerdictBanner from "./VerdictBanner.vue";
import StatusTiles from "./StatusTiles.vue";
import PluginList from "./PluginList.vue";
import FindingsSections from "./FindingsSections.vue";

defineProps<{ findings: Findings }>();
</script>

<template>
  <div class="space-y-4">
    <VerdictBanner :findings="findings" />
    <StatusTiles :findings="findings" />
    <PluginList :plugins="findings.plugins" />
    <FindingsSections :findings="findings" />
  </div>
</template>
