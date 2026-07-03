<script setup lang="ts">
import { onMounted, ref } from "vue";
import FindingsReport from "../components/FindingsReport.vue";
import LogInput from "../components/LogInput.vue";
import type { Findings } from "../../worker/parser/types";
import { SUPPORTED_HOSTS } from "../../worker/parser/hosts";

const version = "2.1.0";

const logInput = ref<InstanceType<typeof LogInput> | null>(null);
const findings = ref<Findings | null>(null);
const errorMessage = ref("");
const noticeMessage = ref("");
const parsedUrl = ref("");
const parsedAt = ref("");
const isParsing = ref(false);

async function parse(url: string) {
  if (isParsing.value) return;
  isParsing.value = true;
  errorMessage.value = "";
  // A stalled /parse must not pin the spinner forever; abort after a bounded wait.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const resp = await fetch("/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logUrl: url }),
      signal: controller.signal,
    });
    const data = (await resp.json()) as { success: boolean; findings?: Findings; error?: string };
    if (data.success && data.findings) {
      findings.value = data.findings;
    } else {
      findings.value = null;
      errorMessage.value = data.error ?? "Unknown error";
    }
  } catch {
    findings.value = null;
    errorMessage.value = controller.signal.aborted
      ? "The parser timed out. Please try again."
      : "Failed to reach the parser.";
  } finally {
    clearTimeout(timeout);
    parsedUrl.value = url;
    parsedAt.value = new Date().toLocaleString();
    // Reflect the parsed URL in the address bar (enables shareable embeds).
    const next = new URL(window.location.href);
    next.searchParams.set("url", url);
    window.history.pushState(null, "", next);
    isParsing.value = false;
  }
}

onMounted(() => {
  const urlParam = new URL(window.location.href).searchParams.get("url");
  if (urlParam) {
    logInput.value?.setUrl(urlParam);
    void parse(urlParam);
  }
});
</script>

<template>
  <main class="mx-auto max-w-5xl px-4 py-8 sm:py-12">
    <!-- Hero: the input is the star. -->
    <section class="mx-auto max-w-2xl text-center">
      <p class="font-display text-[11px] uppercase tracking-[0.3em] text-accent">
        Server diagnostics
      </p>
      <h1 class="mt-3 font-display text-2xl leading-tight text-fg sm:text-3xl">
        Scan a Minecraft server log
      </h1>
      <p class="mt-3 text-sm text-muted">
        Paste a link to your <span class="font-mono text-fg">latest.log</span> and get a verdict —
        version, plugins, offline mode, malware, and more.
      </p>

      <div class="mt-6">
        <LogInput
          ref="logInput"
          :busy="isParsing"
          @submit="parse"
          @notice="noticeMessage = $event"
        />
      </div>

      <p
        v-if="noticeMessage"
        class="mt-3 font-mono text-xs"
        :style="{ color: '#FFFF55' }"
      >
        {{ noticeMessage }}
      </p>

      <p class="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted">
        <span>Supported:</span>
        <code
          v-for="host in SUPPORTED_HOSTS"
          :key="host"
          class="rounded border border-hair bg-surface px-1.5 py-0.5 font-mono text-fg"
        >{{ host }}</code>
      </p>
    </section>

    <!-- Error -->
    <p
      v-if="errorMessage"
      class="tooltip-frame mx-auto mt-8 max-w-2xl px-4 py-3 text-center font-mono text-sm"
      :style="{ color: '#FF5555' }"
    >
      {{ errorMessage }}
    </p>

    <!-- Results -->
    <section
      v-else-if="findings"
      class="mt-8"
    >
      <p class="mb-3 truncate font-mono text-xs text-muted">
        Parsed {{ parsedUrl }} · {{ parsedAt }}
      </p>
      <FindingsReport :findings="findings" />
    </section>

    <!-- Empty state -->
    <section
      v-else
      class="mx-auto mt-10 max-w-2xl text-center text-sm text-muted"
    >
      <p>
        Tip: share a parsed report by adding <code class="font-mono text-fg">?url=</code> to this page's
        address, followed by the log URL.
      </p>
      <p class="mt-4 text-xs">
        Hosted and maintained by
        <a
          href="https://github.com/mja00"
          class="text-accent hover:underline"
        >mja00</a>
        · v{{ version }}
      </p>
    </section>
  </main>
</template>
