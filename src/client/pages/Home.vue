<script setup lang="ts">
import { onMounted, ref } from "vue";
import LogOutput from "../components/LogOutput.vue";

const version = "2.1.0";

const logUrl = ref("");
const outputLines = ref<string[]>([]);
const errorMessage = ref("");
const outputHeader = ref("Output");
const isParsing = ref(false);
const sidebarVisible = ref(true);

async function parse() {
  if (isParsing.value) return;
  isParsing.value = true;
  errorMessage.value = "";
  const url = logUrl.value;
  try {
    const resp = await fetch("/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logUrl: url }),
    });
    const data = (await resp.json()) as { success: boolean; output?: string[]; error?: string };
    if (data.success && data.output) {
      outputLines.value = data.output;
    } else {
      outputLines.value = [];
      errorMessage.value = data.error ?? "Unknown error";
    }
  } catch {
    outputLines.value = [];
    errorMessage.value = "Failed to reach the parser.";
  } finally {
    outputHeader.value = `Output - ${url} - ${new Date().toLocaleString()}`;
    // Reflect the parsed URL in the address bar (enables shareable embeds).
    const next = new URL(window.location.href);
    next.searchParams.set("url", url);
    window.history.pushState(null, "", next);
    isParsing.value = false;
  }
}

function showSidebar() {
  sidebarVisible.value = true;
  localStorage.setItem("sidebarState", "visible");
}

function hideSidebar() {
  sidebarVisible.value = false;
  localStorage.setItem("sidebarState", "hidden");
}

onMounted(() => {
  if (localStorage.getItem("sidebarState") === "hidden") {
    sidebarVisible.value = false;
  }
  const urlParam = new URL(window.location.href).searchParams.get("url");
  if (urlParam) {
    logUrl.value = urlParam;
    void parse();
  }
});
</script>

<template>
  <div class="container-fluid mt-3">
    <button
      v-show="!sidebarVisible"
      id="sidebarButton"
      type="button"
      class="btn btn-primary btn-sm"
      style="position: fixed; left: 0; top: 10%; z-index: 1000"
      title="Open sidebar"
      @click="showSidebar"
    >
      <i class="fa-solid fa-chevron-right" />
    </button>
    <div class="row">
      <div
        v-show="sidebarVisible"
        id="sidebar"
        class="col"
      >
        <div class="card">
          <div class="card-header">
            Paper Log Parser
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              style="float: right"
              @click="hideSidebar"
            />
          </div>
          <div class="card-body text-center">
            <h5 class="card-title">
              Put the URL of your logs in the box below and press on the parse button!
            </h5>
            <div class="card-text">
              <form
                id="logSubmissionForm"
                @submit.prevent="parse"
              >
                <div class="mb-3">
                  <label
                    for="logUrl"
                    class="form-label"
                  >Log URL</label>
                  <input
                    id="logUrl"
                    v-model="logUrl"
                    type="text"
                    class="form-control"
                    name="logUrl"
                    placeholder="https://pastes.dev/rorythecat"
                  >
                </div>
                <button
                  type="submit"
                  class="btn btn-primary"
                  :disabled="isParsing"
                >
                  <span
                    v-if="isParsing"
                    class="spinner-border spinner-border-sm"
                    role="status"
                  />
                  <span v-else>Parse</span>
                </button>
              </form>
            </div>
            <br>
            <p class="text-muted text-center">
              Currently only supports logs from these hosts:
              <code>paste.gg</code>, <code>pastes.dev</code>, <code>mclo.gs</code>, <code>pastebin.com</code>
            </p>
          </div>
        </div>
        <div class="card mt-3">
          <div class="card-header">
            About
          </div>
          <div class="card-body">
            <p class="card-text">
              This is a web app that parses Minecraft server latest.log files. All you need to do is paste in a URL to
              the log file above and press parse. It will then scan the log and parse out various information about it.
            </p>
            <p class="card-text">
              Currently this parses out the following information:
            </p>
            <ul>
              <li>Minecraft Version</li>
              <li>Paper Version</li>
              <li>Server online mode status</li>
              <li>Plugins</li>
              <li>Pirated plugins</li>
              <li>Missing plugin dependencies</li>
              <li>Exceptions</li>
            </ul>
            <p class="card-text">
              If you wish to link directly to a parsed output just add <code>?url=</code> to the website URL and then
              paste the log URL.
            </p>
            <p class="card-text">
              Hosted and maintained by <a href="https://github.com/mja00">mja00</a> - {{ version }}
            </p>
          </div>
        </div>
      </div>
      <div
        id="content"
        class="d-flex flex-column"
        :class="sidebarVisible ? 'col-lg-8' : 'col'"
      >
        <div
          class="card"
          style="min-height: 830px"
        >
          <div
            id="outputHeader"
            class="card-header"
          >
            {{ outputHeader }}
          </div>
          <div
            class="card-body d-flex flex-column"
            style="min-height: 0"
          >
            <p
              v-if="errorMessage"
              class="text-danger"
            >
              {{ errorMessage }}
            </p>
            <LogOutput
              v-else
              :lines="outputLines"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
