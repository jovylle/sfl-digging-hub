<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { SnapshotPublic } from "@sfl-digging-hub/shared";
import { summarizeDigLoot } from "@sfl-digging-hub/shared";
import { RouterLink } from "vue-router";
import {
  getComments,
  getSavedLands,
  getSession,
  getSessionToken,
  getSnapshot,
  postComment,
  saveLand,
  unsaveLand,
  type Comment,
} from "@/api/client";
import DigResultsGrid from "@/components/DigResultsGrid.vue";
import GoogleSignIn from "@/components/GoogleSignIn.vue";

const props = defineProps<{ id: string }>();

const snapshot = ref<SnapshotPublic | null>(null);
const error = ref<string | null>(null);
const comments = ref<Comment[]>([]);
const commentBody = ref("");
const sessionEmail = ref<string | null>(null);
const signedIn = computed(() => Boolean(sessionEmail.value));

const isSaved = ref(false);
const saveToggling = ref(false);

const loot = computed(() =>
  snapshot.value ? summarizeDigLoot(snapshot.value.digs) : null,
);

const statsTreasures = computed(() => {
  const n = snapshot.value?.stats?.treasureCount;
  return typeof n === "number" ? n : loot.value?.treasures ?? 0;
});

async function refreshSession() {
  if (!getSessionToken()) {
    sessionEmail.value = null;
    return;
  }
  try {
    const s = await getSession();
    sessionEmail.value = s.email;
  } catch {
    sessionEmail.value = null;
  }
}

async function loadSavedStatus(landId: string) {
  if (!getSessionToken()) return;
  try {
    const res = await getSavedLands();
    isSaved.value = res.lands.some((l) => l.landId === landId);
  } catch {
    // not critical
  }
}

async function toggleSave() {
  if (!signedIn.value || !snapshot.value?.landId) return;
  saveToggling.value = true;
  try {
    if (isSaved.value) {
      await unsaveLand(snapshot.value.landId);
      isSaved.value = false;
    } else {
      await saveLand(snapshot.value.landId);
      isSaved.value = true;
    }
  } catch {
    // silently ignore
  } finally {
    saveToggling.value = false;
  }
}

async function load() {
  error.value = null;
  snapshot.value = null;
  isSaved.value = false;
  try {
    const [snap, c] = await Promise.all([
      getSnapshot(props.id),
      getComments(props.id),
    ]);
    snapshot.value = snap;
    comments.value = c.comments;
    if (snap.landId) {
      await loadSavedStatus(snap.landId);
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load dig";
  }
}

async function submitComment() {
  if (!signedIn.value || !commentBody.value.trim()) return;
  try {
    const created = await postComment(props.id, {
      body: commentBody.value.trim(),
    });
    comments.value = [...comments.value, created];
    commentBody.value = "";
    error.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Comment failed";
  }
}

async function onSignedIn(email: string) {
  sessionEmail.value = email;
  if (snapshot.value?.landId) {
    await loadSavedStatus(snapshot.value.landId);
  }
}

onMounted(async () => {
  await refreshSession();
  await load();
});
watch(() => props.id, load);
</script>

<template>
  <section v-if="error && !snapshot" class="alert alert-error">
    <span>{{ error }}</span>
  </section>
  <section v-else-if="!snapshot" class="flex justify-center py-12">
    <span class="loading loading-spinner loading-lg text-primary" />
  </section>
  <section v-else class="space-y-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold text-primary">
        {{ snapshot.displayName || "Desert dig" }}
      </h1>
      <p class="text-base-content/70 text-sm">
        {{ snapshot.utcDate }} · day grid · {{ snapshot.digs.length }} digs ·
        {{ statsTreasures }} treasures
      </p>
      <div v-if="snapshot.landId" class="flex items-center gap-2 flex-wrap pt-0.5">
        <RouterLink
          :to="{ name: 'land', params: { landId: snapshot.landId } }"
          class="text-xs text-base-content/50 link link-hover"
        >
          Land #{{ snapshot.landId }}
        </RouterLink>
        <button
          v-if="signedIn"
          class="btn btn-xs gap-1"
          :class="isSaved ? 'btn-secondary' : 'btn-ghost border border-base-300'"
          :disabled="saveToggling"
          @click="toggleSave"
        >
          <span v-if="saveToggling" class="loading loading-spinner loading-xs" />
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-3 w-3"
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
          {{ isSaved ? "Saved" : "Save land" }}
        </button>
      </div>
      <p class="text-base-content/50 text-xs">
        Each tile shows what was found and the dig order number — not a step-by-step replay.
      </p>
    </header>

    <DigResultsGrid :digs="snapshot.digs" show-order />

    <div v-if="loot" class="card bg-base-200 max-w-md mx-auto w-full">
      <div class="card-body py-4 text-sm space-y-2">
        <p class="font-medium text-primary">Loot found</p>
        <ul class="text-base-content/80 grid grid-cols-2 gap-x-4 gap-y-1">
          <li v-if="loot.sand">Sand: {{ loot.sand }}</li>
          <li v-if="loot.crab">Crab: {{ loot.crab }}</li>
          <li v-for="(count, name) in loot.items" :key="name">
            {{ name }}: {{ count }}
          </li>
        </ul>
        <p v-if="!loot.sand && !loot.crab && !Object.keys(loot.items).length" class="text-base-content/50">
          No items recorded on dug tiles.
        </p>
      </div>
    </div>

    <div id="comments" class="divider">Comments</div>

    <div class="space-y-4 max-w-lg">
      <ul v-if="comments.length" class="space-y-3 text-sm">
        <li v-for="c in comments" :key="c.id" class="card bg-base-200">
          <div class="card-body py-3">
            <p>
              <span class="font-medium text-primary">{{ c.displayName }}</span>
              <span v-if="c.owned" class="badge badge-success badge-xs ml-1">verified</span>
            </p>
            <p class="text-base-content/80 mt-1">{{ c.body }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="text-base-content/50 text-sm">No comments yet.</p>

      <GoogleSignIn @signed-in="onSignedIn" />

      <form v-if="signedIn" class="space-y-3" @submit.prevent="submitComment">
        <textarea
          v-model="commentBody"
          placeholder="Add a comment…"
          maxlength="500"
          rows="3"
          class="textarea textarea-bordered w-full textarea-sm"
        />
        <button type="submit" class="btn btn-primary btn-sm" :disabled="!commentBody.trim()">
          Post comment
        </button>
      </form>
      <p v-else class="text-sm text-base-content/60">
        Sign in with Google to join the conversation.
      </p>

      <p v-if="error && snapshot" class="text-error text-sm">{{ error }}</p>
    </div>
  </section>
</template>
