<script setup lang="ts">
import NavBar from "./components/NavBar.vue";
</script>

<template>
  <div class="min-h-screen bg-ink text-fg">
    <NavBar />
    <router-view />
  </div>
</template>
