<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { D1G_LABEL } from "@/utils/d1gUrl";
import {
  getLandDays,
  getSavedLands,
  getSessionToken,
  saveLand,
  unsaveLand,
  type LandDayItem,
} from "@/api/client";

const props = defineProps<{ landId: string }>();

const days = ref<LandDayItem[]>([]);
const loadError = ref<string | null>(null);
const loading = ref(false);

const signedIn = computed(() => Boolean(getSessionToken()));
const isSaved = ref(false);
const savedLoading = ref(false);
const saveToggling = ref(false);

async function loadDays() {
  loading.value = true;
  loadError.value = null;
  days.value = [];
  try {
    const res = await getLandDays(props.landId);
    days.value = res.days;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : "Failed to load land history";
  } finally {
    loading.value = false;
  }
}

async function loadSavedStatus() {
  if (!signedIn.value) return;
  savedLoading.value = true;
  try {
    const res = await getSavedLands();
    isSaved.value = res.lands.some((l) => l.landId === props.landId);
  } catch {
    // not critical
  } finally {
    savedLoading.value = false;
  }
}

async function toggleSave() {
  if (!signedIn.value) return;
  saveToggling.value = true;
  try {
    if (isSaved.value) {
      await unsaveLand(props.landId);
      isSaved.value = false;
    } else {
      await saveLand(props.landId);
      isSaved.value = true;
    }
  } catch {
    // silently ignore
  } finally {
    saveToggling.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadDays(), loadSavedStatus()]);
});

watch(() => props.landId, async () => {
  isSaved.value = false;
  await Promise.all([loadDays(), loadSavedStatus()]);
});
</script>

<template>
  <section class="space-y-6 max-w-xl">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-primary">Land #{{ landId }}</h1>
        <p class="text-base-content/70 text-sm mt-1">
          Public dig history synced from {{ D1G_LABEL }}
        </p>
      </div>

      <div v-if="signedIn" class="shrink-0 mt-1">
        <button
          class="btn btn-sm gap-2"
          :class="isSaved ? 'btn-secondary' : 'btn-ghost border border-base-300'"
          :disabled="saveToggling || savedLoading"
          @click="toggleSave"
        >
          <span v-if="saveToggling" class="loading loading-spinner loading-xs" />
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4"
            :fill="isSaved ? 'currentColor' : 'none'"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          {{ isSaved ? "Saved" : "Save" }}
        </button>
      </div>
    </div>

    <div v-if="loadError" class="alert alert-error text-sm">
      <span>{{ loadError }}</span>
    </div>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>

    <ul v-else-if="days.length" class="space-y-2">
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
            View grid
          </RouterLink>
        </div>
      </li>
    </ul>

    <p v-else-if="!loading && !loadError" class="text-base-content/50 text-sm">
      No saved digs for this land yet.
    </p>

    <p v-if="!signedIn" class="text-base-content/40 text-xs">
      <RouterLink to="/community" class="link">Sign in on any dig page</RouterLink>
      to save this land to your profile.
    </p>
  </section>
</template>
