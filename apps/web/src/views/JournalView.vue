<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import {
  getLandDays,
  loadJournalLandId,
  saveJournalLandId,
  type LandDayItem,
} from "@/api/client";
import { buildD1gLandUrl, isTestnetLandId, testnetLandHubMessage } from "@/utils/testnet";

const landId = ref("");
const days = ref<LandDayItem[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function loadJournal() {
  const id = landId.value.trim();
  if (!id) {
    error.value = "Land ID is required";
    return;
  }
  if (isTestnetLandId(id)) {
    error.value = testnetLandHubMessage(id);
    days.value = [];
    return;
  }
  loading.value = true;
  error.value = null;
  saveJournalLandId(id);
  try {
    const res = await getLandDays(id);
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
    <div>
      <h1 class="text-2xl font-bold text-primary">Journal</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Public dig history by land ID — same data synced from d1g.uk.
      </p>
    </div>

    <form class="space-y-3" @submit.prevent="loadJournal">
      <label class="form-control w-full">
        <span class="label-text">Land ID</span>
        <input
          v-model="landId"
          type="text"
          class="input input-bordered w-full"
          placeholder="e.g. 12345 (mainnet; testnet uses ?testnet on d1g.uk)"
        />
      </label>
      <button type="submit" class="btn btn-primary" :disabled="loading">
        <span v-if="loading" class="loading loading-spinner loading-xs" />
        {{ loading ? "Loading…" : "Load digs" }}
      </button>
    </form>

    <div v-if="error" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>
    <p
      v-if="landId.trim() && isTestnetLandId(landId.trim())"
      class="text-warning text-sm"
    >
      <a
        :href="buildD1gLandUrl(landId.trim(), 'digging', { testnet: true })"
        class="link link-primary"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open on d1g.uk with ?testnet
      </a>
    </p>

    <ul v-if="days.length" class="space-y-2">
      <li v-for="d in days" :key="d.id" class="card bg-base-200">
        <div class="card-body py-4 flex-row items-center justify-between gap-4">
          <div>
            <p class="font-semibold">{{ d.utcDate }}</p>
            <p class="text-sm text-base-content/60">{{ d.digCount }} digs</p>
          </div>
          <RouterLink
            :to="{ name: 'dig', params: { id: d.id } }"
            class="btn btn-secondary btn-sm shrink-0"
          >
            View dig
          </RouterLink>
        </div>
      </li>
    </ul>
    <p v-else-if="!loading && !error" class="text-base-content/50 text-sm">
      No saved digs for this land yet.
    </p>
  </section>
</template>
