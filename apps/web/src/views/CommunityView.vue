<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { ReactionEmoji } from "@sfl-digging-hub/shared";
import {
  getCommunity,
  getSessionToken,
  type CommunityItem,
} from "@/api/client";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import ReactionBar from "@/components/ReactionBar.vue";

const PAGE_SIZE = 30;

function treasureCount(item: CommunityItem): number {
  const n = item.stats?.treasureCount;
  return typeof n === "number" ? n : 0;
}

const items = ref<CommunityItem[]>([]);
const nextOffset = ref<number | null>(null);
const error = ref<string | null>(null);
const signInHint = ref(false);
const loading = ref(false);
const loadingMore = ref(false);
const signedIn = ref<boolean>(Boolean(getSessionToken()));

async function loadInitial() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getCommunity({ limit: PAGE_SIZE, offset: 0 });
    items.value = res.items;
    nextOffset.value = res.nextOffset;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load feed";
    items.value = [];
    nextOffset.value = null;
  } finally {
    loading.value = false;
  }
}

async function loadMore() {
  if (nextOffset.value == null || loadingMore.value) return;
  loadingMore.value = true;
  error.value = null;
  try {
    const res = await getCommunity({ offset: nextOffset.value, limit: PAGE_SIZE });
    items.value = items.value.concat(res.items);
    nextOffset.value = res.nextOffset;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load more";
  } finally {
    loadingMore.value = false;
  }
}

function applyReactionUpdate(
  item: CommunityItem,
  next: { counts: Record<string, number>; userEmoji: ReactionEmoji | null },
): void {
  item.reactions = { counts: next.counts, userEmoji: next.userEmoji };
}

function showSignInHint() {
  signInHint.value = true;
  window.setTimeout(() => {
    signInHint.value = false;
  }, 4000);
}

onMounted(loadInitial);
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-primary">Community</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Random anonymous day grids — shareable links, comments welcome. No land IDs are shown.
        Load more for another random batch.
      </p>
    </div>

    <div v-if="signInHint" class="alert alert-info text-sm">
      <span>Sign in on the dig page to react.</span>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>
    <div v-else-if="error && !items.length" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>

    <template v-else-if="items.length">
      <ul class="space-y-3">
        <li v-for="item in items" :key="item.id" class="card bg-base-200">
          <div class="card-body py-4 flex flex-col sm:flex-row gap-4 sm:items-start">
            <DigResultsGrid
              :digs="item.digs"
              compact
              class="w-24 sm:w-28 shrink-0"
            />
            <div class="flex-1 min-w-0 space-y-2">
              <div>
                <p class="font-semibold truncate">Desert dig</p>
                <p class="text-sm text-base-content/60">
                  {{ item.digCount }} digs
                  <span v-if="treasureCount(item) > 0"> · {{ treasureCount(item) }} treasures</span>
                  <span v-if="item.commentCount > 0"> · {{ item.commentCount }} comments</span>
                </p>
              </div>
              <ReactionBar
                :snapshot-id="item.id"
                :counts="item.reactions.counts"
                :user-emoji="item.reactions.userEmoji"
                :signed-in="signedIn"
                @update="applyReactionUpdate(item, $event)"
                @signin-required="showSignInHint"
              />
            </div>
            <RouterLink
              :to="{ name: 'dig', params: { id: item.id } }"
              class="btn btn-primary btn-sm shrink-0 self-start sm:self-center"
            >
              View grid
            </RouterLink>
          </div>
        </li>
      </ul>

      <div v-if="error" class="alert alert-warning text-sm">
        <span>{{ error }}</span>
      </div>

      <div class="flex justify-center pt-2">
        <button
          v-if="nextOffset != null"
          type="button"
          class="btn btn-outline btn-sm"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <span v-if="loadingMore" class="loading loading-spinner loading-xs" />
          {{ loadingMore ? "Loading..." : "More random digs" }}
        </button>
        <p v-else class="text-xs text-base-content/40">That's the batch for now.</p>
      </div>
    </template>

    <p v-else class="text-base-content/50 text-sm">No public digs yet.</p>
  </section>
</template>
