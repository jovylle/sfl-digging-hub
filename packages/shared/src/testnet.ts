/** Query flag on d1g.uk for api-dev (shareable). */
export const TESTNET_QUERY = "testnet";

/** Mainnet farm IDs are typically ≤12 digits; api-dev farms are often longer. */
export const TESTNET_LAND_MIN_DIGITS = 13;

export function isTestnetLandId(landId: string): boolean {
  const id = String(landId || "").trim();
  return /^\d+$/.test(id) && id.length >= TESTNET_LAND_MIN_DIGITS;
}

export function hasTestnetQuery(
  query: Record<string, unknown> | undefined | null,
  searchOrFullPath = "",
): boolean {
  if (query && Object.prototype.hasOwnProperty.call(query, TESTNET_QUERY)) {
    const v = query[TESTNET_QUERY];
    if (v === null || v === undefined || v === "" || v === "1" || v === "true") {
      return true;
    }
    return String(v).toLowerCase() === "true";
  }
  const s = String(searchOrFullPath || "");
  return /[?&]testnet(?=$|[=&])/.test(s);
}

export function testnetLandHubMessage(landId?: string): string {
  const id = landId ? ` (${landId})` : "";
  return `This is a testnet land ID${id}. Use d1g.uk with ?${TESTNET_QUERY} in the URL. Land IDs are not shown on the public digging hub.`;
}

/** Link to open a land on d1g.uk (production or testnet). */
export function buildD1gLandUrl(
  landId: string,
  page: "digging" | "details" = "digging",
  options: { testnet?: boolean; base?: string } = {},
): string {
  const base = (options.base ?? "https://d1g.uk").replace(/\/$/, "");
  const id = String(landId || "").trim();
  const path = page === "digging" ? `/${id}/digging` : `/${id}/details`;
  const url = new URL(`${base}${path}`);
  if (options.testnet ?? isTestnetLandId(id)) {
    url.searchParams.set(TESTNET_QUERY, "");
  }
  return url.toString();
}
