<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { checkHealth, getCommunity, type CommunityItem } from "@/api/client";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import { D1G_BASE_URL, D1G_LABEL } from "@/utils/d1gUrl";

const apiOk = ref<boolean | null>(null);
const feedItems = ref<CommunityItem[]>([]);
const feedLoading = ref(true);

function treasureCount(item: CommunityItem): number {
  const n = item.stats?.treasureCount;
  return typeof n === "number" ? n : 0;
}

onMounted(async () => {
  try {
    const h = await checkHealth();
    apiOk.value = h.ok;
  } catch {
    apiOk.value = false;
  }

  try {
    const res = await getCommunity({ limit: 6 });
    feedItems.value = res.items;
  } catch {
    // feed is best-effort on home
  } finally {
    feedLoading.value = false;
  }
});
</script>

<template>
  <section class="space-y-8">
    <div class="space-y-3">
      <h1 class="text-3xl font-bold text-primary">SFL Digging Hub</h1>
      <p class="text-base-content/80 text-lg max-w-2xl">
        Save, share, and discuss desert day grids when the game API only shows today.
        Dig on
        <a
          :href="D1G_BASE_URL"
          class="link link-primary"
          target="_blank"
          rel="noopener"
          >{{ D1G_LABEL }}</a
        >
        — browse anonymous community digs, track today's grids on your profile, and practice leaderboards here.
      </p>

      <div v-if="apiOk === true" class="alert alert-success py-2 text-sm">
        <span>API connected</span>
      </div>
      <div v-else-if="apiOk === false" class="alert alert-warning py-2 text-sm">
        <span>
          API offline — run
          <code class="text-xs bg-base-200 px-1 rounded">npm run dev:api</code>
          then refresh
        </span>
      </div>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink to="/community" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Community</h2>
          <p class="text-sm text-base-content/70">Random anonymous day grids</p>
        </div>
      </RouterLink>
      <RouterLink to="/profile" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">My Land Digs</h2>
          <p class="text-sm text-base-content/70">Today's grids for your saved lands (private)</p>
        </div>
      </RouterLink>
      <RouterLink to="/practice" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Practice</h2>
          <p class="text-sm text-base-content/70">Victory list and leaderboards from {{ D1G_LABEL }} practice</p>
        </div>
      </RouterLink>
    </div>

    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Random digs</h2>
        <RouterLink to="/community" class="text-sm link link-primary">View all →</RouterLink>
      </div>

      <div v-if="feedLoading" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>

      <div
        v-else-if="feedItems.length"
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <RouterLink
          v-for="item in feedItems"
          :key="item.id"
          :to="{ name: 'dig', params: { id: item.id } }"
          class="card bg-base-200 hover:shadow-lg transition-shadow"
        >
          <div class="card-body py-3 px-3 gap-2">
            <DigResultsGrid :digs="item.digs" compact class="w-full" />
            <div class="min-w-0">
              <p class="font-semibold text-sm truncate">Desert dig</p>
              <p class="text-xs text-base-content/60">
                {{ item.digCount }} digs
                <span v-if="treasureCount(item) > 0"> · {{ treasureCount(item) }} treasures</span>
              </p>
            </div>
          </div>
        </RouterLink>
      </div>

      <p v-else class="text-base-content/50 text-sm">No public digs yet.</p>
    </div>
  </section>
</template>
