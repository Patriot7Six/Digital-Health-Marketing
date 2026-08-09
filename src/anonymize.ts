import type { CrawlResult, Finding, TargetConfig } from "./types.js";

/**
 * Rewrites a report so it can be published as a work sample without naming
 * the site it was run against.
 *
 * The findings themselves are not sensitive: anyone can reproduce them by
 * running the tool. The target's identity is a courtesy question, not a
 * security one. An unsolicited audit with a company's name on it reads
 * differently from a demonstration of method.
 *
 * The design lesson that shaped this file: a scrubber without verification is
 * a scrubber that fails silently. The first version matched configured
 * aliases as whole strings and missed three separate spellings of the same
 * brand — a slugified finding id, a sibling staging host, and a logo filename
 * using the British spelling that appeared in no alias list. So the work is
 * split in two. `anonymize` replaces what it can find, and `findLeaks`
 * independently checks the rendered output, so the caller can refuse to write
 * a file that still names the target.
 */

export interface AnonymizeOptions {
  /** Display name substituted for the target, e.g. "Regional ABA provider". */
  label: string;
  /** Host substituted for the real one. Defaults to a reserved example domain. */
  host?: string;
  /** Extra strings to redact, for anything the token derivation cannot infer. */
  extra?: string[];
}

export interface Anonymized {
  config: TargetConfig;
  crawl: CrawlResult;
  findings: Finding[];
  /** Distinctive tokens this pass tried to remove. Feed to `findLeaks`. */
  tokens: string[];
}

/** Word to substitute for a distinctive brand token found inside a longer string. */
const TOKEN_REPLACEMENT = "Provider";

/**
 * Industry and geography vocabulary. These appear in a brand name without
 * identifying it, and redacting them would make the report unreadable while
 * protecting nothing.
 */
const GENERIC = new Set([
  "health", "healthcare", "behavioral", "behavioural", "therapy", "therapies",
  "clinic", "clinics", "center", "centers", "centre", "centres", "group",
  "medical", "care", "services", "service", "autism", "pediatric", "pediatrics",
  "children", "child", "family", "partners", "associates", "network",
  "company", "corp", "corporation", "incorporated", "holdings", "limited",
  "texas", "america", "american", "national", "regional", "www", "com", "net",
  "org", "https", "http",
]);

export function anonymize(
  config: TargetConfig,
  crawl: CrawlResult,
  findings: Finding[],
  opts: AnonymizeOptions,
): Anonymized {
  const host = opts.host ?? "provider.example";
  const tokens = deriveTokens(config, crawl, opts.extra ?? []);
  const hostPatterns = buildHostPatterns(config, crawl, host);
  const tokenPatterns = tokens.map(
    (t) => [new RegExp(escapeRe(t), "gi"), TOKEN_REPLACEMENT] as const,
  );

  /** Hosts first, so a full domain becomes the placeholder rather than a stub. */
  const scrub = (s: string): string => {
    let out = s;
    for (const [re, to] of hostPatterns) out = out.replace(re, to);
    for (const [re, to] of tokenPatterns) out = out.replace(re, to);
    return out;
  };

  const scrubOpt = (s: string | undefined) => (s === undefined ? undefined : scrub(s));

  return {
    tokens,
    config: {
      ...config,
      name: opts.label,
      origin: `https://${host}`,
      seeds: config.seeds.map(scrub),
      brandAliases: [opts.label],
    },
    crawl: {
      ...crawl,
      origin: `https://${host}`,
      robotsTxt: crawl.robotsTxt === null ? null : scrub(crawl.robotsTxt),
      robotsSitemaps: crawl.robotsSitemaps.map(scrub),
      sitemapUrls: crawl.sitemapUrls.map(scrub),
      skipped: crawl.skipped.map((s) => ({ ...s, url: scrub(s.url) })),
      pages: crawl.pages.map((p) => ({
        ...p,
        url: scrub(p.url),
        finalUrl: scrub(p.finalUrl),
        canonical: scrubOpt(p.canonical),
        title: scrubOpt(p.title),
        metaDescription: scrubOpt(p.metaDescription),
        h1: p.h1.map(scrub),
        h2: p.h2.map(scrub),
        internalLinks: p.internalLinks.map(scrub),
        externalLinks: p.externalLinks.map(scrub),
        redirectChain: p.redirectChain.map(scrub),
        images: p.images.map((i) => ({ ...i, src: scrub(i.src) })),
        openGraph: Object.fromEntries(
          Object.entries(p.openGraph).map(([k, v]) => [k, scrub(v)]),
        ),
        tags: p.tags.map((t) => ({ ...t, evidence: scrub(t.evidence) })),
      })),
    },
    findings: findings.map((f) => ({
      ...f,
      // Ids are slugified from titles and hosts at creation time, so they
      // carry the brand in a hyphenated form no alias list would match.
      id: reslug(scrub(f.id)),
      title: scrub(f.title),
      detail: scrub(f.detail),
      evidence: f.evidence.map(scrub),
      urls: f.urls.map(scrub),
      recommendation: scrub(f.recommendation),
    })),
  };
}

/**
 * Distinctive words that identify the target: everything in its name, aliases,
 * and host, minus industry and geography vocabulary that identifies nobody.
 *
 * For "Empower Behavioral Health" at empowerbh.com this yields "empower" and
 * "empowerbh", which between them cover the hyphenated slug, the sibling
 * staging host, and the logo filename.
 */
export function deriveTokens(
  config: TargetConfig,
  crawl: CrawlResult,
  extra: string[] = [],
): string[] {
  const raw = new Set<string>();

  for (const source of [config.name, ...config.brandAliases, ...extra]) {
    for (const word of String(source).split(/[^A-Za-z0-9]+/)) {
      if (word.length >= 4 && !GENERIC.has(word.toLowerCase())) {
        raw.add(word.toLowerCase());
      }
    }
  }

  for (const origin of [config.origin, crawl.origin]) {
    const host = hostOf(origin);
    if (!host) continue;
    for (const label of host.replace(/^www\./, "").split(".")) {
      if (label.length >= 4 && !GENERIC.has(label)) raw.add(label);
    }
  }

  // Anything the caller passed verbatim is redacted even if it looks generic.
  for (const e of extra) {
    const t = e.trim().toLowerCase();
    if (t.length >= 3) raw.add(t);
  }

  // Longest first: replacing "empowerbh" before "empower" keeps the result
  // from becoming "redactedbh".
  return [...raw].sort((a, b) => b.length - a.length);
}

/**
 * Independent check that a rendered report no longer names the target.
 * Runs against the final string, not the data model, so it catches anything
 * a renderer reintroduced.
 */
export function findLeaks(rendered: string, tokens: string[]): string[] {
  const hits = new Set<string>();
  const hay = rendered.toLowerCase();
  for (const t of tokens) {
    if (t === TOKEN_REPLACEMENT) continue;
    let from = 0;
    for (;;) {
      const at = hay.indexOf(t, from);
      if (at === -1) break;
      // Report the surrounding run so the caller can see the actual spelling.
      const start = Math.max(0, at - 24);
      hits.add(rendered.slice(start, Math.min(rendered.length, at + t.length + 24)).trim());
      from = at + t.length;
      if (hits.size >= 12) return [...hits];
    }
  }
  return [...hits];
}

function buildHostPatterns(
  config: TargetConfig,
  crawl: CrawlResult,
  host: string,
): Array<readonly [RegExp, string]> {
  const hosts = new Set<string>();
  for (const origin of [config.origin, crawl.origin]) {
    const h = hostOf(origin);
    if (!h) continue;
    hosts.add(h);
    hosts.add(h.replace(/^www\./, ""));
  }
  return [...hosts]
    .sort((a, b) => b.length - a.length)
    .map((h) => [new RegExp(escapeRe(h), "gi"), host] as const);
}

/** Normalise a scrubbed id back into a clean slug. */
function reslug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).host.toLowerCase();
  } catch {
    return null;
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
