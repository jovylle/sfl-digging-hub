import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import ReplayView from "./views/ReplayView.vue";
import JournalView from "./views/JournalView.vue";
import CommunityView from "./views/CommunityView.vue";
import PracticeView from "./views/PracticeView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/replay/:id", name: "replay", component: ReplayView, props: true },
    { path: "/journal", name: "journal", component: JournalView },
    { path: "/community", name: "community", component: CommunityView },
    { path: "/practice", name: "practice", component: PracticeView },
  ],
});
