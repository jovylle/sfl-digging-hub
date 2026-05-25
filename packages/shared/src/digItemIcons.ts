import type { CellKind } from "./digResults.js";

/** Sunflower Land open assets (GitHub + public game-assets CDN). */
const SFL_GH =
  "https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/assets";
const SFL_CDN = "https://sunflower-land.com/game-assets";

function gh(path: string): string {
  return `${SFL_GH}/${path}`;
}

function cdn(path: string): string {
  return `${SFL_CDN}/${path}`;
}

/** Display names from digs_json → icon URL (aligned with SFL images.ts / sunnyside). */
const ITEM_ICON_URLS: Record<string, string> = {
  Sand: gh("resources/sand.webp"),
  Crab: cdn("resources/treasures/crab.png"),
  "Old Bottle": gh("sfts/treasure/old_bottle.png"),
  "Sea Cucumber": cdn("resources/treasures/sea_cucumber.png"),
  Vase: gh("resources/vase.webp"),
  Seaweed: gh("sfts/treasure/seaweed.webp"),
  "Cockle Shell": gh("resources/cockle_shell.webp"),
  Starfish: cdn("resources/treasures/starfish.png"),
  "Wooden Compass": gh("sfts/treasure/wooden_compass.webp"),
  "Iron Compass": gh("sfts/treasure/iron_compass.webp"),
  "Emerald Compass": gh("sfts/treasure/emerald_compass.webp"),
  Pipi: gh("sfts/treasure/pipi.webp"),
  Hieroglyph: gh("resources/hieroglyph.webp"),
  "Clam Shell": cdn("resources/treasures/clam_shell.webp"),
  Coral: cdn("resources/treasures/coral.png"),
  Pearl: gh("sfts/treasure/pearl.webp"),
  "Pirate Bounty": cdn("resources/treasures/pirate_bounty.webp"),
  Scarab: gh("resources/scarab.webp"),
  "Cow Skull": gh("resources/cow_skull.png"),
  "Ancient Clock": gh("icons/ancient_clock.png"),
  "Broken Pillar": gh("icons/broken_pillar.webp"),
  Coprolite: gh("icons/coprolite.webp"),
  "Moon Crystal": gh("icons/moon_crystal.webp"),
  "Ammonite Shell": gh("icons/ammonite_shell.webp"),
  "Salt Dino Egg": gh("icons/salt_dino_egg.webp"),
  "Camel Bone": gh("resources/camel_bone.webp"),
};

function slugifyItemName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const SLUG_ICON_CANDIDATES = (slug: string): string[] => [
  gh(`icons/${slug}.webp`),
  gh(`icons/${slug}.png`),
  gh(`resources/${slug}.webp`),
  gh(`resources/${slug}.png`),
  gh(`sfts/treasure/${slug}.webp`),
  gh(`sfts/treasure/${slug}.png`),
  `https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/public/world/${slug}.webp`,
  cdn(`resources/treasures/${slug}.webp`),
  cdn(`resources/treasures/${slug}.png`),
];

/**
 * Icon URL for a dug tile. Returns null for undug / empty-without-label cells.
 */
export function getDigItemIconUrl(
  kind: CellKind,
  label?: string,
): string | null {
  if (kind === "undug") return null;
  if (kind === "sand") return ITEM_ICON_URLS.Sand;
  if (kind === "crab") return ITEM_ICON_URLS.Crab;
  if (kind === "treasure" && label) {
    const known = ITEM_ICON_URLS[label];
    if (known) return known;
    const slug = slugifyItemName(label);
    return SLUG_ICON_CANDIDATES(slug)[0] ?? null;
  }
  return null;
}
