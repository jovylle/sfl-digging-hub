<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { SnapshotPublic } from "@sfl-digging-hub/shared";
import {
  getMySnapshots,
  loadJournalCreds,
  saveJournalCreds,
} from "@/api/client";

const landId = ref("");
const editToken = ref("");
const snapshots = ref<SnapshotPublic[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

function applySaved() {
  const saved = loadJournalCreds();
  if (saved) {
    landId.value = saved.landId;
    editToken.value = saved.editToken;
  }
}

async function loadJournal() {
  if (!landId.value.trim() || !editToken.value.trim()) {
    error.value = "Land ID and edit token are required";
    return;
  }
  loading.value = true;
  error.value = null;
  saveJournalCreds({ landId: landId.value.trim(), editToken: editToken.value.trim() });
  try {
    const res = await getMySnapshots(landId.value.trim(), editToken.value.trim());
    snapshots.value = res.snapshots;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load journal";
    snapshots.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  applySaved();
  if (landId.value && editToken.value) loadJournal();
});
</script>

<template>
  <section class="space-y-6 max-w-xl">
    <h1 class="text-2xl font-bold text-amber-400">Journal</h1>
    <p class="text-stone-400 text-sm">
      Saved after Share from d1g.uk. Use the land ID from your URL and the edit token returned when
      you saved.
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
      <label class="block text-sm">
        <span class="text-stone-400">Edit token</span>
        <input
          v-model="editToken"
          type="password"
          class="mt-1 w-full bg-stone-900 border border-stone-700 rounded px-3 py-2"
          autocomplete="off"
        />
      </label>
      <button
        type="submit"
        class="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium"
        :disabled="loading"
      >
        {{ loading ? "Loading…" : "Load my digs" }}
      </button>
    </form>

    <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>

    <ul v-if="snapshots.length" class="space-y-2">
      <li
        v-for="s in snapshots"
        :key="s.id"
        class="flex items-center justify-between gap-4 rounded-lg border border-stone-800 bg-stone-900 px-4 py-3"
      >
        <div>
          <p class="font-medium">{{ s.utcDate }}</p>
          <p class="text-stone-500 text-sm">{{ s.digs.length }} digs · {{ s.visibility }}</p>
        </div>
        <RouterLink
          :to="{ name: 'replay', params: { id: s.id }, query: { token: editToken } }"
          class="text-amber-400 text-sm hover:underline shrink-0"
        >
          Replay
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="!loading && !error" class="text-stone-500 text-sm">No saved digs yet.</p>
  </section>
</template>
