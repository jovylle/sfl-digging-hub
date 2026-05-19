<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { getCommunity, type CommunityItem } from "@/api/client";

const date = ref(new Date().toISOString().slice(0, 10));
const items = ref<CommunityItem[]>([]);
const error = ref<string | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getCommunity(date.value);
    items.value = res.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load feed";
    items.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(date, load);
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-primary">Community</h1>
      <p class="text-base-content/70 text-sm mt-1">Public digs shared for a UTC day.</p>
    </div>

    <label class="form-control w-full max-w-xs">
      <span class="label-text">Date (UTC)</span>
      <input v-model="date" type="date" class="input input-bordered w-full" />
    </label>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-md text-primary" />
    </div>
    <div v-else-if="error" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>

    <ul v-else-if="items.length" class="space-y-3">
      <li v-for="item in items" :key="item.id" class="card bg-base-200">
        <div class="card-body py-4 flex-row items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="font-semibold truncate">
              {{ item.displayName || (item.landId ? `Land ${item.landId}` : "Desert dig") }}
            </p>
            <p class="text-sm text-base-content/60">
              {{ item.digCount }} digs
              <span v-if="item.commentCount > 0"> · {{ item.commentCount }} comments</span>
            </p>
          </div>
          <RouterLink
            :to="{ name: 'replay', params: { id: item.id } }"
            class="btn btn-primary btn-sm shrink-0"
          >
            Watch replay
          </RouterLink>
        </div>
      </li>
    </ul>
    <p v-else class="text-base-content/50 text-sm">No public digs for this date.</p>
  </section>
</template>
