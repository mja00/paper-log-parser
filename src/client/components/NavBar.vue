<script setup lang="ts">
import { RouterLink } from "vue-router";
import Icon from "./Icon.vue";

const links = [
  { to: "/", label: "Home" },
  { to: "/bingo", label: "Bingo" },
] as const;
</script>

<template>
  <nav class="sticky top-0 z-40 border-b border-hair bg-ink/85 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
      <RouterLink
        to="/"
        class="flex items-center gap-2"
      >
        <img
          src="https://github.com/EterNityCH/paperchan/blob/main/Paper%20Chan%20Emojis/Emoji%20paperOhhh.png?raw=true"
          alt=""
          class="h-7 w-7 rounded"
          width="28"
          height="28"
        >
        <span class="font-display text-sm tracking-tight text-fg">Paper Log Parser</span>
      </RouterLink>

      <div class="ml-auto flex items-center gap-1 font-mono text-sm">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded px-3 py-1.5 text-muted transition-colors hover:text-fg"
          exact-active-class="text-accent"
        >
          {{ link.label }}
        </RouterLink>
        <a
          href="https://github.com/mja00/paper-log-parser"
          target="_blank"
          rel="noreferrer"
          class="flex items-center gap-1 rounded px-3 py-1.5 text-muted transition-colors hover:text-fg"
        >
          Source
          <Icon
            name="link"
            class="text-xs"
          />
        </a>
      </div>
    </div>
  </nav>
</template>
