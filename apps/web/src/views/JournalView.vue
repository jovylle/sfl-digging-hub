<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { loadJournalLandId, saveJournalLandId } from "@/api/client";
import { isTestnetLandId, testnetLandHubMessage } from "@/utils/testnet";

const router = useRouter();
const landId = ref("");
const error = ref<string | null>(null);

function goToLand() {
  const id = landId.value.trim();
  if (!id) {
    error.value = "Land ID is required";
    return;
  }
  if (isTestnetLandId(id)) {
    error.value = testnetLandHubMessage(id);
    return;
  }
  error.value = null;
  saveJournalLandId(id);
  router.push({ name: "land", params: { landId: id } });
}

onMounted(() => {
  const saved = loadJournalLandId();
  if (saved) {
    landId.value = saved;
  }
});
</script>

<template>
  <section class="space-y-6 max-w-xl">
    <div>
      <h1 class="text-2xl font-bold text-primary">Journal</h1>
      <p class="text-base-content/70 text-sm mt-1">
        Look up public dig history by land ID — same data synced from d1g.uk.
      </p>
    </div>

    <form class="space-y-3" @submit.prevent="goToLand">
      <label class="form-control w-full">
        <span class="label-text">Land ID</span>
        <input
          v-model="landId"
          type="text"
          class="input input-bordered w-full"
          placeholder="e.g. 12345 (mainnet; testnet uses ?testnet on d1g.uk)"
        />
      </label>
      <button type="submit" class="btn btn-primary">
        View land
      </button>
    </form>

    <div v-if="error" class="alert alert-error text-sm">
      <span>{{ error }}</span>
    </div>
  </section>
</template>
