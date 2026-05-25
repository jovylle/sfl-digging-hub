import { createRouter, createWebHistory } from "vue-router";
import HomeView from "./views/HomeView.vue";
import DigView from "./views/DigView.vue";
import JournalView from "./views/JournalView.vue";
import CommunityView from "./views/CommunityView.vue";
import PracticeView from "./views/PracticeView.vue";
import LandView from "./views/LandView.vue";
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
    { path: "/journal", name: "journal", component: JournalView },
    { path: "/community", name: "community", component: CommunityView },
    { path: "/practice", name: "practice", component: PracticeView },
    { path: "/land/:landId", name: "land", component: LandView, props: true },
    { path: "/profile", name: "profile", component: ProfileView },
  ],
});
