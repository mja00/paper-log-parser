<script setup lang="ts">
import { computed } from "vue";
import type { ExceptionInfo } from "../../worker/parser/types";
import { SEVERITY_COLORS } from "../lib/report";
import TooltipCard from "./TooltipCard.vue";
import Icon from "./Icon.vue";

const props = defineProps<{ exceptions: ExceptionInfo[] }>();

interface ParsedException {
  type: string;
  message: string;
  lineNumber: number;
  isCause: boolean;
}

interface ExceptionGroup {
  root: ParsedException;
  causes: ParsedException[];
}

// Drop the `[time] [thread/LEVEL]:` log prefix so the throwable itself leads.
function stripPrefix(line: string): string {
  return line.replace(/^.*?\]:\s*/, "").trim();
}

// Pull the throwable's short type and message out of a captured line.
function parseException(raw: string, lineNumber: number): ParsedException {
  let content = stripPrefix(raw);
  const isCause = content.startsWith("Caused by:");
  if (isCause) content = content.slice("Caused by:".length).trim();

  const match = content.match(/([\w.$]+(?:Exception|Error|Throwable))(?::\s*(.*))?/);
  if (match) {
    const type = match[1].split(".").pop() ?? match[1];
    return { type, message: (match[2] ?? "").trim(), lineNumber, isCause };
  }
  return { type: "Exception", message: content, lineNumber, isCause };
}

// "Caused by:" lines fold into the preceding throwable as its cause chain.
const groups = computed<ExceptionGroup[]>(() => {
  const out: ExceptionGroup[] = [];
  for (const exception of props.exceptions) {
    const parsed = parseException(exception.line, exception.lineNumber);
    if (parsed.isCause && out.length > 0) {
      out[out.length - 1].causes.push(parsed);
    } else {
      out.push({ root: parsed, causes: [] });
    }
  }
  return out;
});
</script>

<template>
  <TooltipCard
    eyebrow="Stack traces"
    title="Exceptions"
    :count="exceptions.length"
    class="md:col-span-2"
  >
    <template #icon>
      <Icon
        name="bolt"
        :style="{ color: SEVERITY_COLORS.warning }"
      />
    </template>

    <ul class="max-h-72 space-y-2 overflow-y-auto pr-1">
      <li
        v-for="(group, i) in groups"
        :key="i"
        class="rounded border-l-2 bg-black/20 py-1.5 pl-3 pr-2"
        :style="{ borderColor: SEVERITY_COLORS.warning }"
      >
        <div class="flex items-baseline gap-2">
          <span
            class="font-mono text-sm font-semibold"
            :style="{ color: SEVERITY_COLORS.warning }"
          >{{ group.root.type }}</span>
          <span class="ml-auto shrink-0 font-mono text-xs text-muted">line {{ group.root.lineNumber }}</span>
        </div>
        <p
          v-if="group.root.message"
          class="mt-0.5 break-words font-mono text-xs text-fg"
        >
          {{ group.root.message }}
        </p>

        <div
          v-for="(cause, j) in group.causes"
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
      </li>
    </ul>
  </TooltipCard>
</template>
