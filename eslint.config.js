import js from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "worker-configuration.d.ts",
      "services/**",
      "src/worker/font.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // TypeScript (vue-tsc) already resolves browser globals in <script setup>.
      "no-undef": "off",
    },
  },
  {
    rules: {
      "vue/multi-word-component-names": "off",
    },
  },
  {
    // LogOutput renders ANSI report lines that are HTML-escaped in ansiColorParse
    // before color tags are added, so v-html is safe here.
    files: ["src/client/components/LogOutput.vue"],
    rules: {
      "vue/no-v-html": "off",
    },
  },
);
