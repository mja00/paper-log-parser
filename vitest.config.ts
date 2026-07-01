import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Node by default (the parser uses no Workers globals; fetch is mocked).
// Component tests opt into happy-dom via a per-file @vitest-environment comment.
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
