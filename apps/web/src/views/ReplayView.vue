<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import type { DigEntry, SnapshotPublic } from "@sfl-digging-hub/shared";
import {
  getComments,
  getSnapshot,
  loadJournalCreds,
  postComment,
  type Comment,
} from "@/api/client";
import ReplayGrid from "@/components/ReplayGrid.vue";
import ReplayControls from "@/components/ReplayControls.vue";

const props = defineProps<{ id: string }>();
const route = useRoute();

const snapshot = ref<SnapshotPublic | null>(null);
const error = ref<string | null>(null);
const step = ref(-1);
const playing = ref(false);
const speed = ref(1);
const comments = ref<Comment[]>([]);
const commentName = ref("");
const commentBody = ref("");
const commentDigRef = ref<number | "">("");

const digs = computed<DigEntry[]>(() => snapshot.value?.digs ?? []);
const maxStep = computed(() => Math.max(0, digs.value.length - 1));

const currentDig = computed(() => {
  if (step.value < 0 || step.value >= digs.value.length) return null;
  return digs.value[step.value];
});

async function load() {
  error.value = null;
  snapshot.value = null;
  const editToken =
    (route.query.token as string | undefined) ?? loadJournalCreds()?.editToken;
  try {
    snapshot.value = await getSnapshot(props.id, editToken);
    const c = await getComments(props.id, editToken);
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

onMounted(load);
watch(() => props.id, load);
</script>

<template>
  <section v-if="error" class="text-red-400">{{ error }}</section>
  <section v-else-if="!snapshot" class="text-stone-400">Loading replay…</section>
  <section v-else class="space-y-8">
    <header class="space-y-1">
      <h1 class="text-2xl font-bold text-amber-400">
        {{ snapshot.displayName || "Desert dig" }}
      </h1>
      <p class="text-stone-400 text-sm">
        {{ snapshot.utcDate }} · {{ snapshot.digs.length }} digs ·
        {{ snapshot.visibility }}
      </p>
    </header>

    <ReplayGrid :digs="digs" :current-step="step" />

    <ReplayControls
      v-model:step="step"
      v-model:playing="playing"
      v-model:speed="speed"
      :max-step="maxStep"
    />

    <div
      v-if="currentDig"
      class="rounded-lg border border-stone-800 bg-stone-900/50 p-4 text-sm space-y-2"
    >
      <p class="font-medium text-amber-300">Dig #{{ currentDig.order }}</p>
      <ul class="text-stone-400">
        <li v-for="(tile, i) in currentDig.tiles" :key="i">
          ({{ tile.x }}, {{ tile.y }}) · {{ tile.tool }}
          <span v-if="Object.keys(tile.items).length">
            — {{ JSON.stringify(tile.items) }}
          </span>
        </li>
      </ul>
    </div>

    <div class="border-t border-stone-800 pt-6 space-y-4">
      <h2 class="font-semibold">Comments</h2>
      <ul v-if="comments.length" class="space-y-3 text-sm">
        <li
          v-for="c in comments"
          :key="c.id"
          class="rounded bg-stone-900 border border-stone-800 p-3"
        >
          <span class="font-medium text-amber-300">{{ c.displayName }}</span>
          <span v-if="c.digRef != null" class="text-stone-500"> · dig #{{ c.digRef }}</span>
          <p class="text-stone-300 mt-1">{{ c.body }}</p>
        </li>
      </ul>
      <p v-else class="text-stone-500 text-sm">No comments yet.</p>

      <form class="space-y-2 max-w-md" @submit.prevent="submitComment">
        <input
          v-model="commentName"
          type="text"
          placeholder="Nickname"
          maxlength="32"
          class="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm"
        />
        <textarea
          v-model="commentBody"
          placeholder="Comment…"
          maxlength="500"
          rows="2"
          class="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm"
        />
        <input
          v-model.number="commentDigRef"
          type="number"
          min="1"
          placeholder="Dig # (optional)"
          class="w-full bg-stone-900 border border-stone-700 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          class="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium"
        >
          Post comment
        </button>
      </form>
    </div>
  </section>
</template>
