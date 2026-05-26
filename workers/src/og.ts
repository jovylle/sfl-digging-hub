import type { DigEntry } from "@sfl-digging-hub/shared";
import { summarizeDigLoot } from "@sfl-digging-hub/shared";
import { renderOgPng, type OgCardData } from "./og/card";
import { getSnapshotById, type SnapshotRow } from "./snapshots";

const PNG_CACHE_HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
};

function snapshotToCard(row: SnapshotRow): OgCardData {
  const digs = JSON.parse(row.digs_json) as DigEntry[];
  const stats = JSON.parse(row.stats_json) as Record<string, unknown>;
  const loot = summarizeDigLoot(digs);
  const treasureCount =
    typeof stats.treasureCount === "number"
      ? (stats.treasureCount as number)
      : loot.treasures;
  const title =
    row.visibility === "public" ? "Desert dig" : row.display_name?.trim() || "Desert dig";
  return {
    title,
    subtitle: row.utc_date,
    primary: `${digs.length} digs · ${treasureCount} treasures`,
    secondary:
      loot.sand || loot.crab
        ? `${loot.sand ? `${loot.sand} sand` : ""}${
            loot.sand && loot.crab ? " · " : ""
          }${loot.crab ? `${loot.crab} crab` : ""}`
        : undefined,
    footer: "hub.d1g.uk",
  };
}

function defaultCard(kind: "home" | "community"): OgCardData {
  if (kind === "community") {
    return {
      title: "Community digs",
      subtitle: "Daily desert digs from the community",
      primary: "Browse today's shared digs",
      footer: "hub.d1g.uk/community",
    };
  }
  return {
    title: "SFL Digging Hub",
    subtitle: "Save, replay, share desert digs",
    primary: "When the game API only shows today",
    footer: "hub.d1g.uk",
  };
}

async function pngResponseFromCache(request: Request): Promise<Response | null> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cached = await cache.match(request);
  return cached ?? null;
}

async function pngResponseToCache(
  request: Request,
  response: Response,
): Promise<void> {
  const cache = (caches as unknown as { default: Cache }).default;
  await cache.put(request, response.clone());
}

export async function handleSnapshotOgPng(
  db: D1Database,
  request: Request,
  id: string,
  cors: HeadersInit,
): Promise<Response> {
  const cached = await pngResponseFromCache(request);
  if (cached) return cached;

  const row = await getSnapshotById(db, id);
  if (!row || (row.visibility !== "public" && row.visibility !== "unlisted")) {
    return new Response("Not found", { status: 404, headers: cors });
  }

  const png = await renderOgPng(snapshotToCard(row));
  const response = new Response(png, {
    status: 200,
    headers: { ...PNG_CACHE_HEADERS, ...cors },
  });
  await pngResponseToCache(request, response.clone());
  return response;
}

export async function handleStaticOgPng(
  request: Request,
  kind: "home" | "community",
  cors: HeadersInit,
): Promise<Response> {
  const cached = await pngResponseFromCache(request);
  if (cached) return cached;

  const png = await renderOgPng(defaultCard(kind));
  const response = new Response(png, {
    status: 200,
    headers: { ...PNG_CACHE_HEADERS, ...cors },
  });
  await pngResponseToCache(request, response.clone());
  return response;
}

type MetaTags = {
  title: string;
  description: string;
  image: string;
  url: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function metaTagsHtml(tags: MetaTags): string {
  const t = escapeHtml(tags.title);
  const d = escapeHtml(tags.description);
  const img = escapeHtml(tags.image);
  const url = escapeHtml(tags.url);
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="SFL Digging Hub" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
  ].join("\n    ");
}

class HeadInjector {
  constructor(private readonly html: string) {}
  element(el: Element) {
    el.append(this.html, { html: true });
  }
}

class TitleSetter {
  constructor(private readonly title: string) {}
  element(el: Element) {
    el.setInnerContent(escapeHtml(this.title));
  }
}

class DescriptionSetter {
  constructor(private readonly description: string) {}
  element(el: Element) {
    el.setAttribute("content", this.description);
  }
}

export type OgInjection = {
  tags: MetaTags;
};

export function injectOgIntoHtml(
  htmlResponse: Response,
  injection: OgInjection,
): Response {
  const tagsHtml = metaTagsHtml(injection.tags);
  return new HTMLRewriter()
    .on("head", new HeadInjector(`\n    ${tagsHtml}\n  `))
    .on("title", new TitleSetter(injection.tags.title))
    .on('meta[name="description"]', new DescriptionSetter(injection.tags.description))
    .transform(htmlResponse);
}

export function buildSnapshotMeta(
  row: SnapshotRow,
  hubBase: string,
  apiBase: string,
): MetaTags {
  const digs = JSON.parse(row.digs_json) as DigEntry[];
  const stats = JSON.parse(row.stats_json) as Record<string, unknown>;
  const loot = summarizeDigLoot(digs);
  const treasureCount =
    typeof stats.treasureCount === "number"
      ? (stats.treasureCount as number)
      : loot.treasures;
  const name =
    row.visibility === "public" ? "Desert dig" : row.display_name?.trim() || "Desert dig";
  return {
    title: `${name} — ${row.utc_date} · SFL Digging Hub`,
    description: `${digs.length} digs, ${treasureCount} treasures on ${row.utc_date}. Replay the dig on hub.d1g.uk.`,
    image: `${apiBase.replace(/\/$/, "")}/v1/snapshots/${row.id}/og.png`,
    url: `${hubBase.replace(/\/$/, "")}/dig/${row.id}`,
  };
}

export function buildHomeMeta(hubBase: string, apiBase: string): MetaTags {
  return {
    title: "SFL Digging Hub — save, replay, and share desert digs",
    description:
      "Save, replay, and share desert digs when the game API only shows today.",
    image: `${apiBase.replace(/\/$/, "")}/v1/og/home.png`,
    url: hubBase.replace(/\/$/, "") + "/",
  };
}

export function buildCommunityMeta(hubBase: string, apiBase: string): MetaTags {
  return {
    title: "SFL Digging Hub — community digs",
    description:
      "Browse today's desert digs from the community. Comment, compare, and share your runs.",
    image: `${apiBase.replace(/\/$/, "")}/v1/og/community.png`,
    url: hubBase.replace(/\/$/, "") + "/community",
  };
}
