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
    <h1 class="text-2xl font-bold text-amber-400">Community</h1>
    <p class="text-stone-400 text-sm">Public digs shared for a UTC day.</p>

    <label class="flex items-center gap-3 text-sm">
      <span class="text-stone-400">Date</span>
      <input
        v-model="date"
        type="date"
        class="bg-stone-900 border border-stone-700 rounded px-3 py-1.5"
      />
    </label>

    <p v-if="loading" class="text-stone-500">Loading…</p>
    <p v-else-if="error" class="text-red-400">{{ error }}</p>

    <ul v-else-if="items.length" class="space-y-3">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center justify-between gap-4 rounded-lg border border-stone-800 bg-stone-900 px-4 py-3"
      >
        <div>
          <p class="font-medium">{{ item.displayName || "Anonymous digger" }}</p>
          <p class="text-stone-500 text-sm">{{ item.digCount }} digs</p>
        </div>
        <RouterLink
          :to="{ name: 'replay', params: { id: item.id } }"
          class="text-amber-400 text-sm hover:underline shrink-0"
        >
          Watch replay
        </RouterLink>
      </li>
    </ul>
    <p v-else class="text-stone-500 text-sm">No public digs for this date.</p>
  </section>
</template>
