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
    <h1 class="text-3xl font-bold text-primary">SFL Digging Hub</h1>
    <p class="text-base-content/80 text-lg max-w-2xl">
      Save, share, and discuss desert day grids when the game API only shows today.
      Dig on
      <a
        href="https://d1g.uk"
        class="link link-primary"
        target="_blank"
        rel="noopener"
        >d1g.uk</a
      >
      — browse public day grids, journal by land ID, and practice leaderboards here.
    </p>

    <div v-if="apiOk === true" class="alert alert-success py-2 text-sm">
      <span>API connected</span>
    </div>
    <div v-else-if="apiOk === false" class="alert alert-warning py-2 text-sm">
      <span>
        API offline — run
        <code class="text-xs bg-base-200 px-1 rounded">npm run dev:api</code>
        then refresh
      </span>
    </div>

    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <RouterLink to="/community" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Community</h2>
          <p class="text-sm text-base-content/70">Public digs by date</p>
        </div>
      </RouterLink>
      <RouterLink to="/journal" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Journal</h2>
          <p class="text-sm text-base-content/70">Dig history by land ID</p>
        </div>
      </RouterLink>
      <RouterLink to="/practice" class="card bg-base-200 hover:shadow-lg transition-shadow">
        <div class="card-body">
          <h2 class="card-title text-lg">Practice</h2>
          <p class="text-sm text-base-content/70">Victory list and leaderboards from d1g.uk practice</p>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
