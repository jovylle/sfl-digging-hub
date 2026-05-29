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
