import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles.css";
// Self-hosted body + data faces (no CDN). Weights match what the UI uses.
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

createApp(App).use(router).mount("#app");
