/** Matches legacy synced titles like "Land 178961" or "Land #178961". */
export function isLandLeakingDisplayName(name: string | null | undefined): boolean {
  const n = name?.trim() ?? "";
  if (!n) return false;
  return /^Land\s#?\d{1,20}$/i.test(n);
}

export function publicDigTitle(
  visibility: string | undefined,
  displayName: string | null | undefined,
): string {
  if (visibility === "public" || isLandLeakingDisplayName(displayName)) {
    return "Desert dig";
  }
  return displayName?.trim() || "Desert dig";
}
