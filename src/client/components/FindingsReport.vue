<script setup lang="ts">
import { computed } from "vue";
import type { Findings } from "../../worker/parser/types";
import VerdictBanner from "./VerdictBanner.vue";
import StatusTiles from "./StatusTiles.vue";
import PluginList from "./PluginList.vue";
import FindingsSections from "./FindingsSections.vue";
import AdviceCard from "./AdviceCard.vue";
import { buildAdvice } from "../lib/advice";

const props = defineProps<{ findings: Findings }>();
const advice = computed(() => buildAdvice(props.findings));
</script>

<template>
  <div class="space-y-4">
    <VerdictBanner :findings="findings" />
    <StatusTiles :findings="findings" />
    <AdviceCard
      v-if="advice.length > 0"
      :items="advice"
    />
    <PluginList :plugins="findings.plugins" />
    <FindingsSections :findings="findings" />
  </div>
</template>
