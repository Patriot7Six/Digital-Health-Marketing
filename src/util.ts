/** "1 page" / "3 pages". */
export function plural(n: number, noun: string, pluralForm?: string): string {
  return `${n} ${n === 1 ? noun : (pluralForm ?? noun + "s")}`;
}

/** Truncate with an ellipsis. */
export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
}

/** Lowercase hyphenated slug, capped, safe for use in a finding id. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
