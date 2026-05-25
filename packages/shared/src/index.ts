export * from "./googleOAuth";
export * from "./testnet";
export * from "./practice";
export * from "./digResults";
export * from "./digItemIcons";
export * from "./reactions";

export type Visibility = "private" | "unlisted" | "public";

export type DigTool = "Sand Shovel" | "Sand Drill";

export type DigTile = {
  x: number;
  y: number;
  dugAt: number;
  items: Record<string, number>;
  tool: DigTool;
};

/** One chronological dig step (grouped Sand Drill tiles share one order). */
export type DigEntry = {
  order: number;
  dugAt: number;
  tiles: DigTile[];
};

export type SnapshotStats = Record<string, unknown>;

export type CreateSnapshotBody = {
  landId: string;
  utcDate: string;
  displayName?: string;
  patterns?: unknown[];
  digs: DigEntry[];
  stats?: SnapshotStats;
  marks?: unknown[];
  visibility?: Visibility;
};

export type SnapshotPublic = {
  id: string;
  utcDate: string;
  landId: string | null;
  displayName: string | null;
  patterns: unknown[];
  digs: DigEntry[];
  stats: SnapshotStats;
  marks: unknown[] | null;
  visibility: Visibility;
  screenshotKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateSnapshotResponse = SnapshotPublic & {
  editToken: string;
  replayUrl: string;
};

type RawGridEntry = DigTile | DigTile[];

function normalizeTile(raw: Record<string, unknown>): DigTile | null {
  const x = raw.x;
  const y = raw.y;
  const dugAt = raw.dugAt;
  if (typeof x !== "number" || typeof y !== "number" || typeof dugAt !== "number") {
    return null;
  }
  const items =
    raw.items && typeof raw.items === "object" && !Array.isArray(raw.items)
      ? (raw.items as Record<string, number>)
      : {};
  const tool =
    raw.tool === "Sand Drill" || raw.tool === "Sand Shovel"
      ? raw.tool
      : "Sand Shovel";
  return { x, y, dugAt, items, tool };
}

/**
 * Matches sfl-crab Digging.vue ordering: flatten grid, sort by dugAt,
 * assign 1-based order; grouped entries (same timestamp batch) share one order.
 */
export function buildDigTimeline(rawGrid: RawGridEntry[]): DigEntry[] {
  const entries = rawGrid.map((entry) => {
    if (Array.isArray(entry)) {
      const tiles = entry
        .map((t) => normalizeTile(t as Record<string, unknown>))
        .filter((t): t is DigTile => t !== null);
      return { dugAt: tiles[0]?.dugAt ?? 0, tiles };
    }
    const tile = normalizeTile(entry as Record<string, unknown>);
    return { dugAt: tile?.dugAt ?? 0, tiles: tile ? [tile] : [] };
  });

  entries.sort((a, b) => a.dugAt - b.dugAt);

  return entries
    .filter((e) => e.tiles.length > 0)
    .map((entry, index) => ({
      order: index + 1,
      dugAt: entry.dugAt,
      tiles: entry.tiles,
    }));
}

export const GRID_SIZE = 10;

export function tileIndex(x: number, y: number, size = GRID_SIZE): number {
  return y * size + x;
}
