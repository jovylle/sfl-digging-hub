<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  getLandDays,
  loadJournalLandId,
  saveJournalLandId,
  type LandDayItem,
} from "@/api/client";

const landId = ref("");
const days = ref<LandDayItem[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function loadJournal() {
  if (!landId.value.trim()) {
    error.value = "Land ID is required";
    return;
  }
  loading.value = true;
  error.value = null;
  saveJournalLandId(landId.value.trim());
  try {
    const res = await getLandDays(landId.value.trim());
    days.value = res.days;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load journal";
    days.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const saved = loadJournalLandId();
  if (saved) {
    landId.value = saved;
    loadJournal();
  }
});
</script>

<template>
  <section class="space-y-6 max-w-xl">
    <h1 class="text-2xl font-bold text-amber-400">Journal</h1>
    <p class="text-stone-400 text-sm">
      Public dig history by land ID — same data synced from d1g.uk.
    </p>

    <form class="space-y-3" @submit.prevent="loadJournal">
      <label class="block text-sm">
        <span class="text-stone-400">Land ID</span>
        <input
          v-model="landId"
          type="text"
          class="mt-1 w-full bg-stone-900 border border-stone-700 rounded px-3 py-2"
          placeholder="e.g. from d1g.uk/land/…"
        />
      </label>
      <button
        type="submit"
        class="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium"
        :disabled="loading"
      >
        {{ loading ? "Loading…" : "Load digs" }}
      </button>
    </form>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

    <ul v-if="days.length" class="space-y-2">
      <li
        v-for="d in days"
        :key="d.id"
        class="flex items-center justify-between gap-4 rounded-lg border border-stone-800 bg-stone-900 px-4 py-3"
      >
        <div>
          <p class="font-medium">{{ d.utcDate }}</p>
          <p class="text-stone-500 text-sm">{{ d.digCount }} digs</p>
        </div>
        <RouterLink
          :to="{ name: 'replay', params: { id: d.id } }"
          class="text-amber-400 text-sm hover:underline shrink-0"
        >
          Replay
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="!loading && !error" class="text-stone-500 text-sm">No saved digs for this land yet.</p>
  </section>
</template>
