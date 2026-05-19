<script setup lang="ts">
import { computed } from "vue";
import type { DigEntry } from "@sfl-digging-hub/shared";
import { GRID_SIZE, tileIndex } from "@sfl-digging-hub/shared";

const props = defineProps<{
  digs: DigEntry[];
  currentStep: number;
}>();

const orderMap = computed(() => {
  const map = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => null as number | null);
  for (const entry of props.digs) {
    for (const tile of entry.tiles) {
      const idx = tileIndex(tile.x, tile.y);
      if (idx >= 0 && idx < map.length) map[idx] = entry.order;
    }
  }
  return map;
});

const visibleOrders = computed(() => {
  const set = new Set<number>();
  for (let i = 0; i <= props.currentStep && i < props.digs.length; i++) {
    set.add(props.digs[i].order);
  }
  return set;
});

function cellClass(index: number): string {
  const order = orderMap.value[index];
  if (order == null) return "bg-base-300 border-base-content/20";
  if (!visibleOrders.value.has(order)) return "bg-base-300 border-base-content/20";
  return "bg-primary/30 border-primary";
}
</script>

<template>
  <div
    class="grid gap-1 w-full max-w-md mx-auto aspect-square"
    :style="{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }"
  >
    <div
      v-for="(order, index) in orderMap"
      :key="index"
      class="relative aspect-square rounded border flex items-center justify-center text-xs font-medium"
      :class="cellClass(index)"
    >
      <span
        v-if="order != null && visibleOrders.has(order)"
        class="text-primary-content font-semibold"
      >
        {{ order }}
      </span>
    </div>
  </div>
</template>
