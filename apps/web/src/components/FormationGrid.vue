<script setup lang="ts">
import { computed } from "vue";
import type { FormationPlacement } from "@sfl-digging-hub/shared";
import { GRID_SIZE } from "@sfl-digging-hub/shared";

const props = withDefaults(
  defineProps<{
    formations: FormationPlacement[];
    compact?: boolean;
  }>(),
  { compact: false },
);

const TILE_COLORS = [
  "bg-blue-200 border-blue-400/60",
  "bg-emerald-200 border-emerald-400/60",
  "bg-rose-200 border-rose-400/60",
  "bg-amber-200 border-amber-400/60",
  "bg-violet-200 border-violet-400/60",
  "bg-cyan-200 border-cyan-400/60",
  "bg-pink-200 border-pink-400/60",
  "bg-lime-200 border-lime-400/60",
];

const DOT_COLORS = [
  "bg-blue-400",
  "bg-emerald-400",
  "bg-rose-400",
  "bg-amber-400",
  "bg-violet-400",
  "bg-cyan-400",
  "bg-pink-400",
  "bg-lime-400",
];

const cellFormation = computed(() => {
  const map = new Array<number>(GRID_SIZE * GRID_SIZE).fill(-1);
  props.formations.forEach((f, fi) => {
    for (const tile of f.tiles) {
      const idx = tile.y * GRID_SIZE + tile.x;
      if (idx >= 0 && idx < map.length) map[idx] = fi;
    }
  });
  return map;
});
</script>

<template>
  <div class="flex flex-col gap-1">
    <div
      class="grid w-full aspect-square"
      :class="compact ? 'gap-px' : 'gap-1 max-w-md mx-auto'"
      :style="{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }"
      role="img"
      :aria-label="`Formation answer key — ${formations.length} formation${formations.length !== 1 ? 's' : ''}`"
    >
      <div
        v-for="(fi, idx) in cellFormation"
        :key="idx"
        class="aspect-square border"
        :class="[
          fi >= 0
            ? TILE_COLORS[fi % TILE_COLORS.length]
            : 'bg-base-300/40 border-base-content/10',
          compact ? 'rounded-[2px] border-[0.5px]' : 'rounded',
        ]"
        :title="fi >= 0 ? formations[fi].key : undefined"
      />
    </div>
    <div v-if="formations.length" class="flex flex-wrap gap-x-2 gap-y-0.5">
      <span
        v-for="(f, fi) in formations"
        :key="f.key"
        class="flex items-center gap-0.5"
        :class="compact ? 'text-[0.5rem]' : 'text-xs'"
      >
        <span
          class="rounded-full shrink-0"
          :class="[DOT_COLORS[fi % DOT_COLORS.length], compact ? 'w-1.5 h-1.5' : 'w-2 h-2']"
        />
        <span class="text-base-content/60 truncate max-w-[5rem]">{{ f.key }}</span>
      </span>
    </div>
  </div>
</template>
