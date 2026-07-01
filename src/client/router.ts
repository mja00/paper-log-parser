import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import Home from "./pages/Home.vue";
import Bingo from "./pages/Bingo.vue";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: Home },
  { path: "/bingo", name: "bingo", component: Bingo },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
