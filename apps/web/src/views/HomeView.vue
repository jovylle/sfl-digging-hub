<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { checkHealth } from "@/api/client";

const apiOk = ref<boolean | null>(null);

onMounted(async () => {
  try {
    const h = await checkHealth();
    apiOk.value = h.ok;
  } catch {
    apiOk.value = false;
  }
});
</script>

<template>
  <section class="space-y-6">
    <h1 class="text-3xl font-bold text-amber-400">SFL Digging Hub</h1>
    <p class="text-stone-300 text-lg max-w-2xl">
      Save, replay, and share desert digs when the game API only shows today.
      Dig on
      <a href="https://d1g.uk" class="text-amber-400 underline" target="_blank" rel="noopener"
        >d1g.uk</a
      >
      — open replays and community stories here.
    </p>

    <p v-if="apiOk === true" class="text-emerald-400 text-sm">API connected</p>
    <p v-else-if="apiOk === false" class="text-amber-600 text-sm">
      API offline — run <code class="bg-stone-800 px-1 rounded">npm run dev:api</code> then refresh
    </p>

    <div class="grid sm:grid-cols-2 gap-4">
      <RouterLink
        to="/community"
        class="block p-5 rounded-xl border border-stone-800 bg-stone-900 hover:border-amber-700/50 transition"
      >
        <h2 class="font-semibold text-lg mb-1">Community</h2>
        <p class="text-stone-400 text-sm">Public digs by date</p>
      </RouterLink>
      <RouterLink
        to="/journal"
        class="block p-5 rounded-xl border border-stone-800 bg-stone-900 hover:border-amber-700/50 transition"
      >
        <h2 class="font-semibold text-lg mb-1">Journal</h2>
        <p class="text-stone-400 text-sm">Your saved days (land + edit token)</p>
      </RouterLink>
    </div>
  </section>
</template>
