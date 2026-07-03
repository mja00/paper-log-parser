<script setup lang="ts">
import TooltipCard from "./TooltipCard.vue";
import Icon from "./Icon.vue";
import { SEVERITY_COLORS } from "../lib/report";
import type { AdviceItem } from "../lib/advice";

defineProps<{ items: AdviceItem[] }>();

const ICON_BY_SEVERITY: Record<string, string> = {
  error: "warning",
  warning: "info",
  info: "info",
  ok: "check",
  neutral: "info",
};
</script>

<template>
  <TooltipCard
    eyebrow="Remediation"
    title="Recommended fixes"
    :count="items.length"
  >
    <ol class="space-y-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex gap-2.5"
      >
        <Icon
          :name="ICON_BY_SEVERITY[item.severity]"
          class="mt-0.5 shrink-0"
          :style="{ color: SEVERITY_COLORS[item.severity] }"
        />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-fg">
            {{ item.title }}
          </p>
          <p class="mt-0.5 text-xs text-muted">
            {{ item.body }}
            <a
              v-if="item.link"
              :href="item.link.href"
              target="_blank"
              rel="noopener"
              class="whitespace-nowrap font-mono text-accent hover:underline"
            >{{ item.link.label }} ↗</a>
          </p>
        </div>
      </li>
    </ol>
  </TooltipCard>
</template>
