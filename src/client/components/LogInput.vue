<script setup lang="ts">
import { ref } from "vue";
import Icon from "./Icon.vue";
import { readLogFile, truncateLog, uploadToMclogs } from "../lib/upload";

const props = defineProps<{ busy: boolean }>();
const emit = defineEmits<{ submit: [url: string]; notice: [message: string] }>();

const mode = ref<"url" | "paste">("url");
const logUrl = ref("");
const pastedLog = ref("");
const isUploading = ref(false);
const uploadError = ref("");
const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

defineExpose({ setUrl: (url: string) => (logUrl.value = url) });

function submitUrl() {
  if (!logUrl.value.trim()) return;
  emit("notice", "");
  emit("submit", logUrl.value.trim());
}

async function uploadContent(content: string) {
  if (!content.trim() || isUploading.value) return;
  isUploading.value = true;
  uploadError.value = "";
  emit("notice", "");
  try {
    const { content: capped, truncated } = truncateLog(content);
    if (truncated) emit("notice", "Log exceeded mclo.gs limits and was truncated to the first 25k lines.");
    const url = await uploadToMclogs(capped);
    logUrl.value = url;
    mode.value = "url";
    emit("submit", url);
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : "Upload to mclo.gs failed.";
  } finally {
    isUploading.value = false;
  }
}

async function handleFile(file: File | undefined | null) {
  if (!file) return;
  try {
    await uploadContent(await readLogFile(file));
  } catch (err) {
    uploadError.value = err instanceof Error ? err.message : "Couldn't read that file.";
  }
}

function onDrop(event: DragEvent) {
  isDragging.value = false;
  void handleFile(event.dataTransfer?.files?.[0]);
}

function onFilePicked(event: Event) {
  void handleFile((event.target as HTMLInputElement).files?.[0]);
}
</script>

<template>
  <div>
    <!-- Mode tabs -->
    <div
      class="flex justify-center gap-1 font-display text-[11px] uppercase tracking-[0.2em]"
      role="tablist"
    >
      <button
        v-for="tab in ([
          { id: 'url', label: 'Link' },
          { id: 'paste', label: 'Paste / file' },
        ] as const)"
        :key="tab.id"
        role="tab"
        :aria-selected="mode === tab.id"
        class="rounded-t border border-b-0 border-hair px-3 py-1.5 transition"
        :class="mode === tab.id ? 'bg-surface text-accent' : 'text-muted hover:text-fg'"
        @click="mode = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- URL mode -->
    <form
      v-if="mode === 'url'"
      @submit.prevent="submitUrl"
    >
      <div class="tooltip-frame flex items-center gap-2 px-3 py-2 text-left focus-within:border-accent">
        <span
          class="font-mono text-accent"
          aria-hidden="true"
        >&gt;</span>
        <label
          for="logUrl"
          class="sr-only"
        >Log URL</label>
        <input
          id="logUrl"
          v-model="logUrl"
          type="text"
          name="logUrl"
          placeholder="https://pastes.dev/rorythecat"
          class="min-w-0 flex-1 bg-transparent font-mono text-sm text-fg placeholder:text-muted focus:outline-none"
        >
        <button
          type="submit"
          :disabled="props.busy"
          class="flex shrink-0 items-center gap-1.5 rounded bg-accent px-3 py-1.5 font-mono text-sm font-semibold text-ink transition hover:bg-accent/85 disabled:opacity-60"
        >
          <span
            v-if="props.busy"
            class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/40 border-t-ink"
            aria-hidden="true"
          />
          <Icon
            v-else
            name="scan"
          />
          <span>{{ props.busy ? "Scanning" : "Scan" }}</span>
        </button>
      </div>
    </form>

    <!-- Paste / file mode -->
    <div v-else>
      <div
        class="tooltip-frame p-2 text-left transition"
        :class="isDragging ? 'border-accent' : ''"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="onDrop"
      >
        <label
          for="pastedLog"
          class="sr-only"
        >Log contents</label>
        <textarea
          id="pastedLog"
          v-model="pastedLog"
          rows="8"
          placeholder="Paste your latest.log here, or drop a .log / .log.gz file anywhere in this box…"
          class="w-full resize-y bg-transparent font-mono text-xs text-fg placeholder:text-muted focus:outline-none"
        />
        <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            class="rounded border border-hair px-2.5 py-1 font-mono text-xs text-muted transition hover:border-accent hover:text-fg"
            @click="fileInput?.click()"
          >
            Choose file…
          </button>
          <input
            ref="fileInput"
            type="file"
            accept=".log,.txt,.gz,text/plain,application/gzip"
            class="hidden"
            @change="onFilePicked"
          >
          <button
            type="button"
            :disabled="isUploading || props.busy || !pastedLog.trim()"
            class="flex shrink-0 items-center gap-1.5 rounded bg-accent px-3 py-1.5 font-mono text-sm font-semibold text-ink transition hover:bg-accent/85 disabled:opacity-60"
            @click="uploadContent(pastedLog)"
          >
            <span
              v-if="isUploading || props.busy"
              class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink/40 border-t-ink"
              aria-hidden="true"
            />
            <Icon
              v-else
              name="scan"
            />
            <span>{{ isUploading ? "Uploading" : props.busy ? "Scanning" : "Upload & scan" }}</span>
          </button>
        </div>
      </div>
      <p class="mt-2 text-xs text-muted">
        Pasted logs are uploaded <span class="text-fg">publicly</span> to mclo.gs (kept ~90 days).
      </p>
      <p
        v-if="uploadError"
        class="mt-2 font-mono text-xs"
        :style="{ color: '#FF5555' }"
      >
        {{ uploadError }}
      </p>
    </div>
  </div>
</template>
