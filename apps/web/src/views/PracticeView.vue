<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatPracticeScore, type PracticeLeaderboardEntry } from "@sfl-digging-hub/shared";
import { getPracticeLeaderboard, getPracticeVictories } from "@/api/client";
import { formatDayLabel, groupByUtcDate } from "@/utils/dayGroup";

const PAGE_SIZE = 30;

const source = ref<"daily" | "random">("daily");
const date = ref(new Date().toISOString().slice(0, 10));
const view = ref<"leaderboard" | "victories">("victories");

const leaderboard = ref<PracticeLeaderboardEntry[]>([]);
const leaderboardLoading = ref(false);
const leaderboardError = ref<string | null>(null);

const victories = ref<PracticeLeaderboardEntry[]>([]);
const victoriesCursor = ref<string | null>(null);
const victoriesLoading = ref(false);
const victoriesLoadingMore = ref(false);
const victoriesError = ref<string | null>(null);

const subtitle = computed(() =>
  source.value === "daily"
    ? view.value === "leaderboard"
      ? `Today's patterns · UTC ${date.value}`
      : "All daily-pattern victories, newest first"
    : view.value === "leaderboard"
      ? "Random rounds · last 7 days"
      : "All random-round victories, newest first",
);

const victoryGroups = computed(() =>
  groupByUtcDate(victories.value, (row) => row.createdAt.slice(0, 10)),
);

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

async function loadLeaderboard() {
  leaderboardLoading.value = true;
  leaderboardError.value = null;
  try {
    const board = await getPracticeLeaderboard({
      source: source.value,
      date: source.value === "daily" ? date.value : undefined,
    });
    leaderboard.value = board.entries;
  } catch (e) {
    leaderboardError.value = e instanceof Error ? e.message : "Failed to load leaderboard";
    leaderboard.value = [];
  } finally {
    leaderboardLoading.value = false;
  }
}

async function loadVictories() {
  victoriesLoading.value = true;
  victoriesError.value = null;
  try {
    const res = await getPracticeVictories({ source: source.value, limit: PAGE_SIZE });
    victories.value = res.entries;
    victoriesCursor.value = res.nextCursor;
  } catch (e) {
    victoriesError.value = e instanceof Error ? e.message : "Failed to load victories";
    victories.value = [];
    victoriesCursor.value = null;
  } finally {
    victoriesLoading.value = false;
  }
}

async function loadMoreVictories() {
  if (!victoriesCursor.value || victoriesLoadingMore.value) return;
  victoriesLoadingMore.value = true;
  victoriesError.value = null;
  try {
    const res = await getPracticeVictories({
      source: source.value,
      before: victoriesCursor.value,
      limit: PAGE_SIZE,
    });
    victories.value = victories.value.concat(res.entries);
    victoriesCursor.value = res.nextCursor;
  } catch (e) {
    victoriesError.value = e instanceof Error ? e.message : "Failed to load more";
  } finally {
    victoriesLoadingMore.value = false;
  }
}

onMounted(() => {
  loadVictories();
  loadLeaderboard();
});

watch(source, () => {
  loadVictories();
  loadLeaderboard();
});

watch(date, () => {
  if (source.value === "daily") loadLeaderboard();
});
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-primary">Practice</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Victories from
        <a href="https://d1g.uk/practice" class="link link-primary" target="_blank" rel="noopener"
          >d1g.uk practice mode</a
        >
        — find all treasures on a round. Lower score is better (time + dig penalty).
      </p>
    </div>

    <div class="flex flex-wrap gap-3 items-end">
      <div class="join">
        <button
          type="button"
          class="btn btn-sm join-item"
          :class="source === 'daily' ? 'btn-primary' : 'btn-ghost'"
          @click="source = 'daily'"
        >
          Daily patterns
        </button>
        <button
          type="button"
          class="btn btn-sm join-item"
          :class="source === 'random' ? 'btn-primary' : 'btn-ghost'"
          @click="source = 'random'"
        >
          Random
        </button>
      </div>
      <label
        v-if="view === 'leaderboard' && source === 'daily'"
        class="form-control"
      >
        <span class="label-text text-xs">UTC date</span>
        <input v-model="date" type="date" class="input input-bordered input-sm" />
      </label>
    </div>

    <p class="text-sm text-base-content/60">{{ subtitle }}</p>

    <div class="tabs tabs-boxed w-fit">
      <button
        type="button"
        class="tab"
        :class="{ 'tab-active': view === 'victories' }"
        @click="view = 'victories'"
      >
        Victories
        <span v-if="victories.length" class="badge badge-sm ml-1">{{ victories.length }}</span>
      </button>
      <button
        type="button"
        class="tab"
        :class="{ 'tab-active': view === 'leaderboard' }"
        @click="view = 'leaderboard'"
      >
        Leaderboard
      </button>
    </div>

    <template v-if="view === 'victories'">
      <div v-if="victoriesLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>
      <div v-else-if="victoriesError && !victories.length" class="alert alert-error text-sm">
        <span>{{ victoriesError }}</span>
      </div>

      <template v-else-if="victories.length">
        <div v-for="group in victoryGroups" :key="group.day" class="space-y-3">
          <div class="flex items-center gap-3">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-base-content/60">
              {{ formatDayLabel(group.day) }}
            </h2>
            <div class="flex-1 h-px bg-base-300" />
            <span class="text-xs text-base-content/40">{{ group.items.length }}</span>
          </div>
          <ul class="space-y-3">
            <li v-for="row in group.items" :key="row.id" class="card bg-base-200">
              <div class="card-body py-4 flex-row items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="font-semibold truncate">
                    {{ row.displayName || "Anonymous" }}
                    <span v-if="row.owned" class="badge badge-success badge-xs ml-1">you</span>
                  </p>
                  <p class="text-sm text-base-content/60">
                    {{ formatTime(row.createdAt) }}
                    · {{ row.digCount }} digs · {{ formatDuration(row.durationMs) }}
                    · score {{ formatPracticeScore(row.score) }}
                  </p>
                  <p class="text-xs text-base-content/50 mt-0.5">
                    {{ row.treasureCount }} treasure{{ row.treasureCount !== 1 ? "s" : "" }}
                    · {{ source === "daily" ? "daily patterns" : "random round" }}
                  </p>
                </div>
                <span class="badge badge-primary badge-lg shrink-0">Victory</span>
              </div>
            </li>
          </ul>
        </div>

        <div v-if="victoriesError" class="alert alert-warning text-sm">
          <span>{{ victoriesError }}</span>
        </div>

        <div class="flex justify-center pt-2">
          <button
            v-if="victoriesCursor"
            type="button"
            class="btn btn-outline btn-sm"
            :disabled="victoriesLoadingMore"
            @click="loadMoreVictories"
          >
            <span v-if="victoriesLoadingMore" class="loading loading-spinner loading-xs" />
            {{ victoriesLoadingMore ? "Loading..." : "Load more" }}
          </button>
          <p v-else class="text-xs text-base-content/40">You've reached the end.</p>
        </div>
      </template>

      <p v-else class="text-base-content/50 text-sm">
        No victories yet for this filter. Win a round on d1g.uk practice (with Save score on).
      </p>
    </template>

    <template v-else>
      <div v-if="leaderboardLoading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md text-primary" />
      </div>
      <div v-else-if="leaderboardError" class="alert alert-error text-sm">
        <span>{{ leaderboardError }}</span>
      </div>
      <template v-else>
        <p class="text-xs text-base-content/50">Best scores only — ranked lowest first.</p>
        <div v-if="leaderboard.length" class="overflow-x-auto">
          <table class="table table-zebra table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Score</th>
                <th>Digs</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in leaderboard" :key="row.id">
                <td>{{ i + 1 }}</td>
                <td>
                  {{ row.displayName || "Anonymous" }}
                  <span v-if="row.owned" class="badge badge-success badge-xs ml-1">you</span>
                </td>
                <td class="font-mono text-xs">{{ formatPracticeScore(row.score) }}</td>
                <td>{{ row.digCount }}</td>
                <td class="font-mono text-xs">{{ formatDuration(row.durationMs) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-base-content/50 text-sm">
          No ranked runs yet. Finish a practice round on d1g.uk to appear here.
        </p>
      </template>
    </template>
  </section>
</template>
