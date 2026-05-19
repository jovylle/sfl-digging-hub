<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { formatPracticeScore, type PracticeLeaderboardEntry } from "@sfl-digging-hub/shared";
import { getPracticeLeaderboard } from "@/api/client";

const source = ref<"daily" | "random">("daily");
const date = ref(new Date().toISOString().slice(0, 10));
const entries = ref<PracticeLeaderboardEntry[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const subtitle = computed(() =>
  source.value === "daily"
    ? `Today's patterns · UTC ${date.value}`
    : "Random rounds · last 7 days",
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getPracticeLeaderboard({
      source: source.value,
      date: source.value === "daily" ? date.value : undefined,
    });
    entries.value = res.entries;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load leaderboard";
    entries.value = [];
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
      <h1 class="text-2xl font-bold text-primary">Practice leaderboard</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Scores from
        <a href="https://d1g.uk/practice" class="link link-primary" target="_blank" rel="noopener"
          >d1g.uk practice mode</a
        >
        — lower is better (time + dig penalty).
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

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>
    <div v-else-if="error" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>
    <div v-else-if="entries.length" class="overflow-x-auto">
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
          <tr v-for="(row, i) in entries" :key="row.id">
            <td>{{ i + 1 }}</td>
            <td>
              {{ row.displayName || "Anonymous" }}
              <span v-if="row.owned" class="badge badge-success badge-xs ml-1">you</span>
            </td>
            <td class="font-mono text-xs">{{ formatPracticeScore(row.score) }}</td>
            <td>{{ row.digCount }}</td>
            <td class="font-mono text-xs">
              {{ Math.floor(row.durationMs / 1000) }}s
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else class="text-base-content/50 text-sm">
      No victorious runs yet. Play on d1g.uk and finish a practice round to appear here.
    </p>
  </section>
</template>
