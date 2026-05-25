function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export function formatDayLabel(utcDate: string): string {
  if (utcDate === todayUtc()) return "Today";
  if (utcDate === yesterdayUtc()) return "Yesterday";
  return utcDate;
}

/** Group an already-newest-first list into preserve-order [{ day, items }] sections. */
export function groupByUtcDate<T>(items: T[], pick: (item: T) => string): Array<{ day: string; items: T[] }> {
  const out: Array<{ day: string; items: T[] }> = [];
  let current: { day: string; items: T[] } | null = null;
  for (const item of items) {
    const day = pick(item);
    if (!current || current.day !== day) {
      current = { day, items: [] };
      out.push(current);
    }
    current.items.push(item);
  }
  return out;
}
