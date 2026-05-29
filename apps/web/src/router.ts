import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import DigView from "./views/DigView.vue";
import PracticeView from "./views/PracticeView.vue";
import ProfileView from "./views/ProfileView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/dig/:id", name: "dig", component: DigView, props: true },
    {
      path: "/replay/:id",
      redirect: (to) => ({ name: "dig", params: { id: to.params.id as string } }),
    },
    { path: "/journal", redirect: { name: "profile", hash: "#lands" } },
    { path: "/land/:landId", redirect: { name: "profile", hash: "#lands" } },
    { path: "/community", redirect: { name: "home" } },
    { path: "/practice", name: "practice", component: PracticeView },
    { path: "/profile", name: "profile", component: ProfileView },
  ],
});
