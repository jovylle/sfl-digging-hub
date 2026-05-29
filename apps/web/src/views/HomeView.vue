<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { checkHealth, getCommunity, type CommunityItem } from "@/api/client";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import { publicDigTitle } from "@/utils/anonymize";
import { D1G_BASE_URL, D1G_LABEL } from "@/utils/d1gUrl";

const PAGE_SIZE = 12;

const apiOk = ref<boolean | null>(null);
const feedItems = ref<CommunityItem[]>([]);
const feedNextOffset = ref<number | null>(null);
const feedLoading = ref(true);
const feedLoadingMore = ref(false);
const feedError = ref<string | null>(null);

function treasureCount(item: CommunityItem): number {
  const n = item.stats?.treasureCount;
  return typeof n === "number" ? n : 0;
}

async function loadFeed(offset = 0) {
  if (offset === 0) {
    feedLoading.value = true;
    feedError.value = null;
  } else {
    feedLoadingMore.value = true;
    feedError.value = null;
  }
  try {
    const res = await getCommunity({ limit: PAGE_SIZE, offset });
    if (offset === 0) {
      feedItems.value = res.items;
    } else {
      feedItems.value = feedItems.value.concat(res.items);
    }
    feedNextOffset.value = res.nextOffset;
  } catch (e) {
    feedError.value = e instanceof Error ? e.message : "Failed to load digs";
    if (offset === 0) {
      feedItems.value = [];
      feedNextOffset.value = null;
    }
  } finally {
    feedLoading.value = false;
    feedLoadingMore.value = false;
  }
}

onMounted(async () => {
  try {
    const h = await checkHealth();
    apiOk.value = h.ok;
  } catch {
    apiOk.value = false;
  }

  await loadFeed();
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

    <div class="grid sm:grid-cols-2 gap-4">
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
      <h2 class="text-lg font-semibold">Random digs</h2>
      <p class="text-sm text-base-content/60">
        Random anonymous day grids — no land IDs shown.
      </p>

      <div v-if="feedLoading" class="flex justify-center py-6">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>

      <div
        v-else-if="feedItems.length"
        class="space-y-3"
      >
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <RouterLink
            v-for="item in feedItems"
            :key="item.id"
            :to="{ name: 'dig', params: { id: item.id } }"
            class="card bg-base-200 hover:shadow-lg transition-shadow"
          >
            <div class="card-body py-3 px-3 gap-2">
              <DigResultsGrid :digs="item.digs" compact class="w-full" />
              <div class="min-w-0">
                <p class="font-semibold text-sm truncate">
                  {{ publicDigTitle("public", item.displayName) }}
                </p>
                <p class="text-xs text-base-content/60">
                  {{ item.digCount }} digs
                  <span v-if="treasureCount(item) > 0"> · {{ treasureCount(item) }} treasures</span>
                </p>
              </div>
            </div>
          </RouterLink>
        </div>

        <div v-if="feedError" class="alert alert-warning text-sm">
          <span>{{ feedError }}</span>
        </div>

        <div class="flex justify-center pt-1">
          <button
            v-if="feedNextOffset != null"
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="feedLoadingMore"
            @click="loadFeed(feedNextOffset!)"
          >
            <span v-if="feedLoadingMore" class="loading loading-spinner loading-xs" />
            {{ feedLoadingMore ? "Loading..." : "More random digs" }}
          </button>
        </div>
      </div>

      <p v-else-if="feedError" class="text-error text-sm">{{ feedError }}</p>
      <p v-else class="text-base-content/50 text-sm">No public digs yet.</p>
    </div>
  </section>
</template>
