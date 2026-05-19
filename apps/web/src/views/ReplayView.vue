<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { DigEntry, SnapshotPublic } from "@sfl-digging-hub/shared";
import {
  getComments,
  getSnapshot,
  postComment,
  type Comment,
} from "@/api/client";
import GoogleSignIn from "@/components/GoogleSignIn.vue";
import ReplayGrid from "@/components/ReplayGrid.vue";
import ReplayControls from "@/components/ReplayControls.vue";

const props = defineProps<{ id: string }>();

const snapshot = ref<SnapshotPublic | null>(null);
const error = ref<string | null>(null);
const step = ref(-1);
const playing = ref(false);
const speed = ref(1);
const comments = ref<Comment[]>([]);
const commentName = ref("");
const commentBody = ref("");
const commentDigRef = ref<number | "">("");
const sessionEmail = ref<string | null>(null);

const digs = computed<DigEntry[]>(() => snapshot.value?.digs ?? []);
const maxStep = computed(() => Math.max(0, digs.value.length - 1));

const currentDig = computed(() => {
  if (step.value < 0 || step.value >= digs.value.length) return null;
  return digs.value[step.value];
});

async function load() {
  error.value = null;
  snapshot.value = null;
  try {
    snapshot.value = await getSnapshot(props.id);
    const c = await getComments(props.id);
    comments.value = c.comments;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to load replay";
  }
}

async function submitComment() {
  if (!commentName.value.trim() || !commentBody.value.trim()) return;
  try {
    const created = await postComment(props.id, {
      displayName: commentName.value.trim(),
      body: commentBody.value.trim(),
      digRef: commentDigRef.value === "" ? undefined : Number(commentDigRef.value),
    });
    comments.value = [...comments.value, created];
    commentBody.value = "";
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Comment failed";
  }
}

function onSignedIn(email: string) {
  sessionEmail.value = email;
  const prefix = email.split("@")[0]?.slice(0, 32);
  if (prefix && !commentName.value.trim()) commentName.value = prefix;
}

onMounted(load);
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
        {{ snapshot.utcDate }} · {{ snapshot.digs.length }} digs
      </p>
    </header>

    <ReplayGrid :digs="digs" :current-step="step" />

    <ReplayControls
      v-model:step="step"
      v-model:playing="playing"
      v-model:speed="speed"
      :max-step="maxStep"
    />

    <div v-if="currentDig" class="card bg-base-200 text-sm">
      <div class="card-body py-4 space-y-2">
        <p class="font-medium text-primary">Dig #{{ currentDig.order }}</p>
        <ul class="text-base-content/70">
          <li v-for="(tile, i) in currentDig.tiles" :key="i">
            ({{ tile.x }}, {{ tile.y }}) · {{ tile.tool }}
            <span v-if="Object.keys(tile.items).length">
              — {{ JSON.stringify(tile.items) }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div class="divider">Comments</div>

    <div class="space-y-4">
      <GoogleSignIn @signed-in="onSignedIn" />
      <p class="text-xs text-base-content/60">
        Sign in with Google to verify your comments. You can still post anonymously.
      </p>

      <ul v-if="comments.length" class="space-y-3 text-sm">
        <li v-for="c in comments" :key="c.id" class="card bg-base-200">
          <div class="card-body py-3">
            <p>
              <span class="font-medium text-primary">{{ c.displayName }}</span>
              <span v-if="c.owned" class="badge badge-success badge-xs ml-1">verified</span>
              <span v-if="c.digRef != null" class="text-base-content/50">
                · dig #{{ c.digRef }}
              </span>
            </p>
            <p class="text-base-content/80 mt-1">{{ c.body }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="text-base-content/50 text-sm">No comments yet.</p>

      <form class="space-y-3 max-w-md" @submit.prevent="submitComment">
        <input
          v-model="commentName"
          type="text"
          placeholder="Nickname"
          maxlength="32"
          class="input input-bordered w-full input-sm"
        />
        <textarea
          v-model="commentBody"
          placeholder="Comment…"
          maxlength="500"
          rows="2"
          class="textarea textarea-bordered w-full textarea-sm"
        />
        <input
          v-model.number="commentDigRef"
          type="number"
          min="1"
          placeholder="Dig # (optional)"
          class="input input-bordered w-full input-sm"
        />
        <button type="submit" class="btn btn-primary btn-sm">Post comment</button>
      </form>
      <p v-if="error && snapshot" class="text-error text-sm">{{ error }}</p>
    </div>
  </section>
</template>
