import type { DigEntry, DigTool } from "./dig";

const GRID_SIZE = 10;

function tileIndex(x: number, y: number, size = GRID_SIZE): number {
  return y * size + x;
}

export type CellKind = "undug" | "sand" | "crab" | "treasure" | "empty";

export type DigCellResult = {
  kind: CellKind;
  /** Treasure item name when kind is treasure. */
  label?: string;
  tool?: DigTool;
  /** 1-based dig order for this tile (from timeline). */
  order?: number;
};

export type DigLootSummary = {
  sand: number;
  crab: number;
  treasures: number;
  /** Non-sand/crab items aggregated by name. */
  items: Record<string, number>;
  totalDigs: number;
};

function classifyTile(items: Record<string, number>): Pick<DigCellResult, "kind" | "label"> {
  if (items.Crab) return { kind: "crab" };
  if (items.Sand) return { kind: "sand" };
  const treasureKey = Object.keys(items).find((k) => k !== "Crab" && k !== "Sand");
  if (treasureKey) return { kind: "treasure", label: treasureKey };
  return { kind: "empty" };
}

/** Final desert board from all dig steps (no player marks). */
export function buildDigResultsGrid(
  digs: DigEntry[],
  size = GRID_SIZE,
): DigCellResult[] {
  const cells: DigCellResult[] = Array.from({ length: size * size }, () => ({
    kind: "undug",
  }));

  for (const entry of digs) {
    for (const tile of entry.tiles) {
      const idx = tileIndex(tile.x, tile.y, size);
      if (idx < 0 || idx >= cells.length) continue;
      const items =
        tile.items && typeof tile.items === "object" ? tile.items : {};
      cells[idx] = {
        ...classifyTile(items),
        tool: tile.tool,
        order: entry.order,
      };
    }
  }

  return cells;
}

export function summarizeDigLoot(digs: DigEntry[]): DigLootSummary {
  const items: Record<string, number> = {};
  let sand = 0;
  let crab = 0;
  let treasures = 0;

  for (const entry of digs) {
    for (const tile of entry.tiles) {
      const tileItems = tile.items ?? {};
      for (const [name, count] of Object.entries(tileItems)) {
        const n = Number(count) || 0;
        if (n <= 0) continue;
        if (name === "Sand") {
          sand += n;
        } else if (name === "Crab") {
          crab += n;
        } else {
          treasures += n;
          items[name] = (items[name] ?? 0) + n;
        }
      }
    }
  }

  return {
    sand,
    crab,
    treasures,
    items,
    totalDigs: digs.length,
  };
}
