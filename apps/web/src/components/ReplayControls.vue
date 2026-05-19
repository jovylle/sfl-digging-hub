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
    <button type="button" class="btn btn-sm btn-ghost" @click="stepBack">Step back</button>
    <button type="button" class="btn btn-sm btn-primary" @click="togglePlay">
      {{ playing ? "Pause" : "Play" }}
    </button>
    <button type="button" class="btn btn-sm btn-ghost" @click="stepForward">Step forward</button>
    <label class="flex items-center gap-2 text-sm text-base-content/70">
      Speed
      <select
        :value="speed"
        class="select select-bordered select-sm"
        @change="emit('update:speed', Number(($event.target as HTMLSelectElement).value))"
      >
        <option :value="0.5">0.5×</option>
        <option :value="1">1×</option>
        <option :value="2">2×</option>
        <option :value="4">4×</option>
      </select>
    </label>
    <span class="text-sm text-base-content/50 w-full text-center">
      Dig {{ step + 1 }} / {{ maxStep + 1 }}
    </span>
  </div>
</template>
