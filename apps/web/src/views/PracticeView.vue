<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatPracticeScore, type PracticeLeaderboardEntry } from "@sfl-digging-hub/shared";
import { getPracticeLeaderboard, getPracticeVictories } from "@/api/client";

const source = ref<"daily" | "random">("daily");
const date = ref(new Date().toISOString().slice(0, 10));
const view = ref<"leaderboard" | "victories">("victories");
const leaderboard = ref<PracticeLeaderboardEntry[]>([]);
const victories = ref<PracticeLeaderboardEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const subtitle = computed(() =>
  source.value === "daily"
    ? `Today's patterns · UTC ${date.value}`
    : "Random rounds · last 7 days",
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

async function load() {
  loading.value = true;
  error.value = null;
  const opts = {
    source: source.value,
    date: source.value === "daily" ? date.value : undefined,
  };
  try {
    const [board, recent] = await Promise.all([
      getPracticeLeaderboard(opts),
      getPracticeVictories(opts),
    ]);
    leaderboard.value = board.entries;
    victories.value = recent.entries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load practice data";
    leaderboard.value = [];
    victories.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch([source, date], load);
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
      <label v-if="source === 'daily'" class="form-control">
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

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>
    <div v-else-if="error" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>

    <template v-else-if="view === 'victories'">
      <p class="text-xs text-base-content/50">
        Every completed practice round (newest first), same idea as the community dig list.
      </p>
      <ul v-if="victories.length" class="space-y-3">
        <li v-for="row in victories" :key="row.id" class="card bg-base-200">
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
      <p v-else class="text-base-content/50 text-sm">
        No victories yet for this filter. Win a round on d1g.uk practice (with Save score on).
      </p>
    </template>

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
  </section>
</template>
