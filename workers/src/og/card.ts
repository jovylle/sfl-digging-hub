import { initWasm as initResvg, Resvg } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import fontData from "./Roboto-Regular.ttf";

const FONT_FAMILY = "Roboto";
const WIDTH = 1200;
const HEIGHT = 630;

let resvgReady: Promise<void> | null = null;
function ensureResvg(): Promise<void> {
  if (!resvgReady) {
    resvgReady = initResvg(resvgWasm as WebAssembly.Module);
  }
  return resvgReady;
}

const fontBytes = new Uint8Array(fontData as unknown as ArrayBuffer);

export type OgCardData = {
  title: string;
  subtitle?: string;
  primary: string;
  secondary?: string;
  footer?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max - 1).trimEnd() + "…";
}

function buildSvg(data: OgCardData): string {
  const title = escapeXml(truncate(data.title, 36));
  const subtitle = data.subtitle ? escapeXml(truncate(data.subtitle, 48)) : "";
  const primary = escapeXml(truncate(data.primary, 32));
  const secondary = data.secondary ? escapeXml(truncate(data.secondary, 48)) : "";
  const footer = escapeXml(data.footer ?? "hub.d1g.uk");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a2236"/>
        <stop offset="100%" stop-color="#2a3a5e"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect x="60" y="60" width="${WIDTH - 120}" height="${HEIGHT - 120}" fill="none" stroke="#3a4a72" stroke-width="2" rx="16"/>
    <text x="80" y="130" font-family="${FONT_FAMILY}" font-size="32" fill="#8fb3ff" letter-spacing="2">SFL DIGGING HUB</text>
    <text x="80" y="260" font-family="${FONT_FAMILY}" font-size="72" font-weight="700" fill="#e6ecf5">${title}</text>
    ${subtitle ? `<text x="80" y="320" font-family="${FONT_FAMILY}" font-size="36" fill="#a8b6d0">${subtitle}</text>` : ""}
    <text x="80" y="450" font-family="${FONT_FAMILY}" font-size="60" font-weight="700" fill="#ffd166">${primary}</text>
    ${secondary ? `<text x="80" y="500" font-family="${FONT_FAMILY}" font-size="32" fill="#a8b6d0">${secondary}</text>` : ""}
    <text x="80" y="570" font-family="${FONT_FAMILY}" font-size="24" fill="#7a89a8">${footer}</text>
    <text x="${WIDTH - 80}" y="570" font-family="${FONT_FAMILY}" font-size="24" fill="#7a89a8" text-anchor="end">Save · Replay · Share</text>
  </svg>`;
}

export async function renderOgPng(data: OgCardData): Promise<Uint8Array> {
  await ensureResvg();
  const svg = buildSvg(data);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
    font: {
      fontBuffers: [fontBytes],
      defaultFontFamily: FONT_FAMILY,
      sansSerifFamily: FONT_FAMILY,
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
}
