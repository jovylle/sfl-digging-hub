<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatPracticeScore, type PracticeLeaderboardEntry } from "@sfl-digging-hub/shared";
import { getPracticeLeaderboard, getPracticeVictories } from "@/api/client";
import { D1G_BASE_URL, D1G_LABEL } from "@/utils/d1gUrl";
import { formatDayLabel, groupByUtcDate } from "@/utils/dayGroup";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import FormationGrid from "@/components/FormationGrid.vue";

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

const expandedRows = ref(new Set<string>());
function toggleExpand(id: string) {
  const next = new Set(expandedRows.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expandedRows.value = next;
}
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-primary">Practice</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Victories from
        <a :href="`${D1G_BASE_URL}/practice`" class="link link-primary" target="_blank" rel="noopener"
          >{{ D1G_LABEL }} practice mode</a
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
              <div class="card-body py-4 flex flex-col sm:flex-row gap-4 sm:items-start">
                <div
                  v-if="(row.digs && row.digs.length) || (row.formations && row.formations.length)"
                  class="flex gap-2 shrink-0"
                >
                  <div v-if="row.digs && row.digs.length" class="flex flex-col items-center gap-0.5">
                    <span class="text-[0.6rem] text-base-content/40 uppercase tracking-wide">Digs</span>
                    <DigResultsGrid :digs="row.digs" compact class="w-24 sm:w-28" />
                  </div>
                  <div v-if="row.formations && row.formations.length" class="flex flex-col items-center gap-0.5">
                    <span class="text-[0.6rem] text-base-content/40 uppercase tracking-wide">Formations</span>
                    <FormationGrid :formations="row.formations" compact class="w-24 sm:w-28" />
                  </div>
                </div>
                <div class="flex-1 min-w-0 flex flex-row items-center justify-between gap-3">
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
                    <div v-if="row.patternKeys && row.patternKeys.length" class="flex flex-wrap gap-1 mt-1">
                      <span
                        v-for="key in row.patternKeys"
                        :key="key"
                        class="badge badge-xs badge-ghost"
                      >{{ key }}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="badge badge-primary badge-lg">Victory</span>
                    <a
                      :href="`${D1G_BASE_URL}/practice/run/${row.id}`"
                      target="_blank"
                      rel="noopener"
                      class="link link-primary text-xs"
                      @click.stop
                    >View run →</a>
                  </div>
                </div>
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
        No victories yet for this filter. Win a round on {{ D1G_LABEL }} practice (with Save score on).
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
                <th />
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, i) in leaderboard" :key="row.id">
                <tr
                  :class="(row.digs?.length || row.formations?.length || row.patternKeys?.length) ? 'cursor-pointer hover' : ''"
                  @click="(row.digs?.length || row.formations?.length || row.patternKeys?.length) && toggleExpand(row.id)"
                >
                  <td>{{ i + 1 }}</td>
                  <td>
                    {{ row.displayName || "Anonymous" }}
                    <span v-if="row.owned" class="badge badge-success badge-xs ml-1">you</span>
                    <a
                      :href="`${D1G_BASE_URL}/practice/run/${row.id}`"
                      target="_blank"
                      rel="noopener"
                      class="link link-primary text-xs ml-1 opacity-50 hover:opacity-100"
                      title="View run on d1g"
                      @click.stop
                    >↗</a>
                  </td>
                  <td class="font-mono text-xs">{{ formatPracticeScore(row.score) }}</td>
                  <td>{{ row.digCount }}</td>
                  <td class="font-mono text-xs">{{ formatDuration(row.durationMs) }}</td>
                  <td class="text-right">
                    <span
                      v-if="row.digs?.length || row.formations?.length || row.patternKeys?.length"
                      class="text-base-content/40 text-xs select-none"
                    >{{ expandedRows.has(row.id) ? "▲" : "▼" }}</span>
                  </td>
                </tr>
                <tr v-if="expandedRows.has(row.id)" class="bg-base-100">
                  <td colspan="6" class="py-3 px-4">
                    <div class="flex flex-wrap gap-5 items-start">
                      <div v-if="row.digs?.length" class="flex flex-col items-center gap-1">
                        <span class="text-[0.6rem] text-base-content/40 uppercase tracking-wide">Digs</span>
                        <DigResultsGrid :digs="row.digs" compact class="w-28" />
                      </div>
                      <div v-if="row.formations?.length" class="flex flex-col items-center gap-1">
                        <span class="text-[0.6rem] text-base-content/40 uppercase tracking-wide">Formations</span>
                        <FormationGrid :formations="row.formations" compact class="w-28" />
                      </div>
                      <div v-if="row.patternKeys?.length" class="flex flex-col gap-1">
                        <span class="text-[0.6rem] text-base-content/40 uppercase tracking-wide">Patterns</span>
                        <div class="flex flex-wrap gap-1">
                          <span
                            v-for="key in row.patternKeys"
                            :key="key"
                            class="badge badge-sm badge-outline"
                          >{{ key }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <p v-else class="text-base-content/50 text-sm">
          No ranked runs yet. Finish a practice round on {{ D1G_LABEL }} to appear here.
        </p>
      </template>
    </template>
  </section>
</template>
