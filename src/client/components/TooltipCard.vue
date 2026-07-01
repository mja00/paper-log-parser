<script setup lang="ts">
// The signature primitive: a Minecraft item-tooltip — violet-black panel inside a purple
// gradient border (see .tooltip-frame). Every findings section is one of these.
defineProps<{
  eyebrow?: string;
  title?: string;
  count?: number;
}>();
</script>

<template>
  <section class="tooltip-frame px-4 py-3">
    <header
      v-if="eyebrow || title || count !== undefined || $slots.icon"
      class="mb-3 flex items-center gap-3"
    >
      <span
        v-if="$slots.icon"
        class="grid h-8 w-8 shrink-0 place-items-center text-lg"
      >
        <slot name="icon" />
      </span>
      <div class="min-w-0">
        <p
          v-if="eyebrow"
          class="font-display text-[10px] uppercase tracking-[0.2em] text-accent"
        >
          {{ eyebrow }}
        </p>
        <h2
          v-if="title"
          class="truncate text-base font-semibold text-fg"
        >
          {{ title }}
        </h2>
      </div>
      <span
        v-if="count !== undefined"
        class="ml-auto rounded bg-white/5 px-2 py-0.5 font-mono text-sm text-muted"
      >
        {{ count }}
      </span>
    </header>
    <slot />
  </section>
</template>
