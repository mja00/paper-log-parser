<script setup lang="ts">
import { computed } from "vue";
import type { ExceptionTrace } from "../../worker/parser/types";
import { SEVERITY_COLORS } from "../lib/report";
import TooltipCard from "./TooltipCard.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ exceptions: ExceptionTrace[] }>();

const traces = computed(() => props.exceptions);

function frameCount(trace: ExceptionTrace): number {
  return trace.throwables.reduce((n, t) => n + t.frames.length, 0);
}

// Where a repeated trace was seen — a few line numbers, then an ellipsis.
function seenAt(lineNumbers: number[]): string {
  const shown = lineNumbers.slice(0, 6).join(", ");
  return lineNumbers.length > 6 ? `${shown}…` : shown;
}
</script>

<template>
  <TooltipCard
    eyebrow="Stack traces"
    title="Exceptions"
    :count="traces.length"
    class="md:col-span-2"
  >
    <template #icon>
      <Icon
        name="bolt"
        :style="{ color: SEVERITY_COLORS.warning }"
      />
    </template>

    <ul class="max-h-96 space-y-2 overflow-y-auto pr-1">
      <li
        v-for="(trace, i) in traces"
        :key="i"
        class="rounded border-l-2 bg-black/20 py-1.5 pl-3 pr-2"
        :style="{ borderColor: SEVERITY_COLORS.warning }"
      >
        <div class="flex items-baseline gap-2">
          <span
            class="font-mono text-sm font-semibold"
            :style="{ color: SEVERITY_COLORS.warning }"
          >{{ trace.throwables[0].type }}</span>
          <span
            v-if="trace.count > 1"
            class="rounded bg-white/10 px-1.5 font-mono text-[11px] text-fg"
            :title="`Seen ${trace.count} times`"
          >×{{ trace.count }}</span>
          <span class="ml-auto shrink-0 font-mono text-xs text-muted">
            {{ trace.count === 1 ? `line ${trace.lineNumbers[0]}` : `${trace.count} occurrences` }}
          </span>
        </div>
        <p
          v-if="trace.throwables[0].message"
          class="mt-0.5 break-words font-mono text-xs text-fg"
        >
          {{ trace.throwables[0].message }}
        </p>

        <!-- Cause chain summary: type + message per link, frames hidden in the disclosure below. -->
        <div
          v-for="(cause, j) in trace.throwables.slice(1)"
          :key="j"
          class="mt-1.5 border-l border-hair pl-2"
        >
          <span class="font-mono text-[10px] uppercase tracking-wide text-muted">caused by</span>
          <span
            class="ml-1 font-mono text-xs font-semibold"
            :style="{ color: SEVERITY_COLORS.warning }"
          >{{ cause.type }}</span>
          <p
            v-if="cause.message"
            class="mt-0.5 break-words font-mono text-xs text-muted"
          >
            {{ cause.message }}
          </p>
        </div>

        <details
          v-if="frameCount(trace) > 0"
          class="mt-1.5"
        >
          <summary class="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] text-accent">
            <Icon
              name="chevron"
              class="chev text-[10px] transition-transform"
            />
            {{ frameCount(trace) }} frames
          </summary>
          <div class="mt-1 space-y-1.5">
            <div
              v-for="(throwable, k) in trace.throwables"
              :key="k"
            >
              <p
                v-if="trace.throwables.length > 1"
                class="font-mono text-[10px] text-muted"
              >
                {{ throwable.type }}
              </p>
              <ol class="space-y-0.5">
                <li
                  v-for="(frame, f) in throwable.frames"
                  :key="f"
                  class="break-words pl-3 font-mono text-[11px] text-muted"
                >
                  {{ frame }}
                </li>
                <li
                  v-if="throwable.truncated > 0"
                  class="pl-3 font-mono text-[11px] text-muted/70"
                >
                  … {{ throwable.truncated }} more
                </li>
              </ol>
            </div>
          </div>
        </details>

        <p
          v-if="trace.count > 1"
          class="mt-1 font-mono text-[11px] text-muted"
        >
          Seen at lines {{ seenAt(trace.lineNumbers) }}
        </p>
      </li>
    </ul>
  </TooltipCard>
</template>

<style scoped>
summary {
  list-style: none;
}
summary::-webkit-details-marker {
  display: none;
}
details[open] .chev {
  transform: rotate(90deg);
}
</style>
