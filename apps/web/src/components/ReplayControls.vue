<script setup lang="ts">
import { onUnmounted, watch } from "vue";

const props = defineProps<{
  step: number;
  maxStep: number;
  playing: boolean;
  speed: number;
}>();

const emit = defineEmits<{
  "update:step": [number];
  "update:playing": [boolean];
  "update:speed": [number];
}>();

let timer: ReturnType<typeof setInterval> | null = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

watch(
  () => [props.playing, props.speed, props.maxStep] as const,
  () => {
    clearTimer();
    if (!props.playing || props.maxStep < 0) return;
    const ms = Math.max(200, 1200 / props.speed);
    timer = setInterval(() => {
      if (props.step >= props.maxStep) {
        emit("update:playing", false);
        clearTimer();
        return;
      }
      emit("update:step", props.step + 1);
    }, ms);
  },
);

onUnmounted(clearTimer);

function stepBack() {
  emit("update:playing", false);
  emit("update:step", Math.max(-1, props.step - 1));
}

function stepForward() {
  emit("update:playing", false);
  emit("update:step", Math.min(props.maxStep, props.step + 1));
}

function togglePlay() {
  if (props.step >= props.maxStep) emit("update:step", -1);
  emit("update:playing", !props.playing);
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 justify-center">
    <button
      type="button"
      class="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-sm"
      @click="stepBack"
    >
      Step back
    </button>
    <button
      type="button"
      class="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-medium"
      @click="togglePlay"
    >
      {{ playing ? "Pause" : "Play" }}
    </button>
    <button
      type="button"
      class="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-sm"
      @click="stepForward"
    >
      Step forward
    </button>
    <label class="flex items-center gap-2 text-sm text-stone-400">
      Speed
      <select
        :value="speed"
        class="bg-stone-800 border border-stone-700 rounded px-2 py-1"
        @change="emit('update:speed', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="0.5">0.5×</option>
        <option :value="1">1×</option>
        <option :value="2">2×</option>
        <option :value="4">4×</option>
      </select>
    </label>
    <span class="text-sm text-stone-500 w-full text-center">
      Dig {{ step + 1 }} / {{ maxStep + 1 }}
    </span>
  </div>
</template>
