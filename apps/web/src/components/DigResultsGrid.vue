<script setup lang="ts">
import { computed } from "vue";
import type { DigEntry } from "@sfl-digging-hub/shared";
import { GRID_SIZE, buildDigResultsGrid, type DigCellResult } from "@sfl-digging-hub/shared";

const props = withDefaults(
  defineProps<{
    digs: DigEntry[];
    compact?: boolean;
  }>(),
  { compact: false },
);

const cells = computed(() => buildDigResultsGrid(props.digs));

function cellClass(cell: DigCellResult): string {
  switch (cell.kind) {
    case "sand":
      return "bg-amber-200/80 border-amber-400/60 text-amber-950";
    case "crab":
      return "bg-orange-300/90 border-orange-500/70 text-orange-950";
    case "treasure":
      return "bg-yellow-300/90 border-yellow-500/70 text-yellow-950";
    case "empty":
      return "bg-base-200 border-base-content/30 text-base-content/50";
    default:
      return "bg-base-300 border-base-content/20";
  }
}

function cellLabel(cell: DigCellResult): string {
  switch (cell.kind) {
    case "sand":
      return "Sand";
    case "crab":
      return "Crab";
    case "treasure":
      return abbreviate(cell.label ?? "?");
    case "empty":
      return "·";
    default:
      return "";
  }
}

function abbreviate(name: string): string {
  if (name.length <= 8) return name;
  const words = name.split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => w[0]?.toUpperCase() ?? "").join("");
  }
  return `${name.slice(0, 7)}…`;
}
</script>

<template>
  <div
    class="grid w-full aspect-square"
    :class="props.compact ? 'gap-px' : 'gap-1 max-w-md mx-auto'"
    :style="{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }"
  >
    <div
      v-for="(cell, index) in cells"
      :key="index"
      class="relative aspect-square flex items-center justify-center font-semibold leading-tight text-center"
      :class="[
        cellClass(cell),
        props.compact
          ? 'rounded-[2px] border-[0.5px]'
          : 'rounded border text-[0.55rem] sm:text-xs px-0.5',
      ]"
      :title="cell.label ?? cell.kind"
    >
      <span v-if="!props.compact && cell.kind !== 'undug'">{{ cellLabel(cell) }}</span>
    </div>
  </div>
</template>
