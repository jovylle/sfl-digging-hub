/** Farm titles synced as "Land 12345" / "Land #12345" — never show on public hub. */
export function isLandLeakingDisplayName(name: string | null | undefined): boolean {
  const n = name?.trim() ?? "";
  if (!n) return false;
  return /^Land\s#?\d{1,20}$/i.test(n);
}

/** Strip public and land-ID-shaped display names (legacy rows before migrations). */
export function sanitizeDisplayName(
  displayName: string | null | undefined,
  visibility: string,
  landId?: string | null,
): string | null {
  if (visibility === "public") return null;
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return null;
  if (isLandLeakingDisplayName(trimmed)) return null;
  const lid = landId?.trim();
  if (
    lid &&
    (trimmed === lid ||
      trimmed === `Land ${lid}` ||
      trimmed === `Land #${lid}`)
  ) {
    return null;
  }
  return trimmed;
}
