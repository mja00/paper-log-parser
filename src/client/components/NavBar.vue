<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container-fluid">
      <RouterLink
        class="navbar-brand"
        to="/"
      >
        Paper Log Parser
      </RouterLink>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarColor01"
        aria-controls="navbarColor01"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon" />
      </button>
      <div
        id="navbarColor01"
        class="collapse navbar-collapse"
      >
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/"
            >
              Home
            </RouterLink>
          </li>
          <li class="nav-item">
            <a
              class="nav-link"
              href="https://github.com/mja00/paper-log-parser"
              target="_blank"
              rel="noreferrer"
            >Source</a>
          </li>
          <li class="nav-item">
            <RouterLink
              class="nav-link"
              to="/bingo"
            >
              Bingo
            </RouterLink>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>
