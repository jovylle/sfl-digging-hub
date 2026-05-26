<script setup lang="ts">
import { computed } from "vue";
import type { DigEntry } from "@sfl-digging-hub/shared";
import {
  GRID_SIZE,
  buildDigResultsGrid,
  getDigItemIconUrl,
  type DigCellResult,
} from "@sfl-digging-hub/shared";

const props = withDefaults(
  defineProps<{
    digs: DigEntry[];
    compact?: boolean;
    showOrder?: boolean;
  }>(),
  { compact: false, showOrder: false },
);

const cells = computed(() => buildDigResultsGrid(props.digs));

function cellClass(cell: DigCellResult): string {
  if (cell.kind === "undug") {
    return "bg-base-300/40 border-base-content/10";
  }
  switch (cell.kind) {
    case "sand":
      return "bg-amber-100/90 border-amber-400/50";
    case "crab":
      return "bg-orange-100/90 border-orange-400/50";
    case "treasure":
      return "bg-yellow-100/90 border-yellow-500/50";
    case "empty":
      return "bg-base-200 border-base-content/25";
    default:
      return "bg-base-200 border-base-content/20";
  }
}

function iconUrl(cell: DigCellResult): string | null {
  return getDigItemIconUrl(cell.kind, cell.label);
}
</script>

<template>
  <div
    class="grid w-full aspect-square"
    :class="props.compact ? 'gap-px' : 'gap-1 max-w-md mx-auto'"
    :style="{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }"
    role="img"
    :aria-label="`${digs.length} digs on desert grid`"
  >
    <div
      v-for="(cell, index) in cells"
      :key="index"
      class="relative aspect-square flex items-center justify-center border"
      :class="[
        cellClass(cell),
        props.compact ? 'rounded-[2px] border-[0.5px]' : 'rounded',
      ]"
      :title="
        cell.kind === 'undug'
          ? 'Not dug'
          : cell.label
            ? `${cell.label} · dig #${cell.order}`
            : cell.order
              ? `Dig #${cell.order}`
              : cell.kind
      "
    >
      <img
        v-if="iconUrl(cell)"
        :src="iconUrl(cell)!"
        alt=""
        class="object-contain pointer-events-none select-none"
        :class="props.compact ? 'w-[72%] h-[72%]' : 'w-[70%] h-[70%]'"
        loading="lazy"
        decoding="async"
      />
      <span
        v-else-if="props.showOrder && cell.kind === 'empty' && cell.order"
        class="text-base-content/35 font-bold"
        :class="props.compact ? 'text-[0.45rem]' : 'text-xs'"
      >
        ·
      </span>

      <span
        v-if="props.showOrder && cell.order"
        class="absolute font-bold leading-none tabular-nums bg-base-100/90 text-base-content border border-base-content/20 shadow-sm"
        :class="
          props.compact
            ? 'top-px right-px min-w-[0.65rem] h-[0.65rem] px-px text-[0.45rem] rounded-[2px]'
            : 'top-0.5 right-0.5 min-w-[1rem] h-4 px-0.5 text-[0.6rem] rounded'
        "
      >
        {{ cell.order }}
      </span>
    </div>
  </div>
</template>
