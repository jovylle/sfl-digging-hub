<script setup lang="ts">
import { ref, watch } from "vue";
import { REACTION_EMOJI, type ReactionEmoji } from "@sfl-digging-hub/shared";
import { reactToSnapshot } from "@/api/client";

const props = defineProps<{
  snapshotId: string;
  counts: Record<string, number>;
  userEmoji: ReactionEmoji | null;
  signedIn: boolean;
}>();

const emit = defineEmits<{
  (e: "update", value: { counts: Record<string, number>; userEmoji: ReactionEmoji | null }): void;
  (e: "signin-required"): void;
  (e: "error", message: string): void;
}>();

const localCounts = ref<Record<string, number>>({ ...props.counts });
const localUserEmoji = ref<ReactionEmoji | null>(props.userEmoji);
const busy = ref(false);

watch(
  () => [props.counts, props.userEmoji] as const,
  ([nextCounts, nextUser]) => {
    localCounts.value = { ...nextCounts };
    localUserEmoji.value = nextUser;
  },
);

function applyOptimistic(emoji: ReactionEmoji): {
  counts: Record<string, number>;
  userEmoji: ReactionEmoji | null;
} {
  const counts = { ...localCounts.value };
  const previous = localUserEmoji.value;
  if (previous === emoji) {
    counts[emoji] = Math.max(0, (counts[emoji] ?? 0) - 1);
    return { counts, userEmoji: null };
  }
  if (previous) {
    counts[previous] = Math.max(0, (counts[previous] ?? 0) - 1);
  }
  counts[emoji] = (counts[emoji] ?? 0) + 1;
  return { counts, userEmoji: emoji };
}

async function onClick(emoji: ReactionEmoji): Promise<void> {
  if (!props.signedIn) {
    emit("signin-required");
    return;
  }
  if (busy.value) return;
  const snapshotCounts = { ...localCounts.value };
  const snapshotUser = localUserEmoji.value;
  const optimistic = applyOptimistic(emoji);
  localCounts.value = optimistic.counts;
  localUserEmoji.value = optimistic.userEmoji;
  busy.value = true;
  try {
    const sendEmoji = snapshotUser === emoji ? null : emoji;
    const result = await reactToSnapshot(props.snapshotId, sendEmoji);
    localCounts.value = result.counts;
    localUserEmoji.value = result.userEmoji;
    emit("update", result);
  } catch (err) {
    localCounts.value = snapshotCounts;
    localUserEmoji.value = snapshotUser;
    emit("error", err instanceof Error ? err.message : "Failed to react");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-wrap gap-1">
    <button
      v-for="emoji in REACTION_EMOJI"
      :key="emoji"
      type="button"
      class="btn btn-xs gap-1 px-2"
      :class="localUserEmoji === emoji ? 'btn-primary' : 'btn-ghost'"
      :disabled="!props.signedIn || busy"
      :title="!props.signedIn ? 'Sign in to react' : undefined"
      @click="onClick(emoji)"
    >
      <span class="text-base leading-none">{{ emoji }}</span>
      <span v-if="(localCounts[emoji] ?? 0) > 0" class="text-xs tabular-nums">
        {{ localCounts[emoji] }}
      </span>
    </button>
  </div>
</template>
