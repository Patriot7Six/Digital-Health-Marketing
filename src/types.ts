import { z } from "zod";

/**
 * Severity is about revenue impact, not technical purity.
 * critical - blocks acquisition or creates regulatory exposure
 * high     - measurably suppresses qualified traffic or conversion
 * medium   - degrades performance, fix in normal cycle
 * low      - hygiene
 * info     - observation with no action attached
 */
export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

export const Module = z.enum([
  "technical-seo",
  "tags",
  "schema",
  "local",
  "content-gap",
  "aeo",
]);
export type Module = z.infer<typeof Module>;

/**
 * Every finding cites the job requirement it answers. This is deliberate:
 * an audit that cannot say why a finding matters to the business is noise.
 */
export const Finding = z.object({
  id: z.string(),
  module: Module,
  severity: Severity,
  title: z.string(),
  /** What was observed. Facts only. */
  detail: z.string(),
  /** Raw strings pulled from the page that prove the finding. */
  evidence: z.array(z.string()).default([]),
  /** Pages the finding applies to. Truncated in reports past 10. */
  urls: z.array(z.string()).default([]),
  /** What to do about it. */
  recommendation: z.string(),
  /** Which capability area this maps to. */
  capability: z.string().optional(),
  /**
   * How sure we are, given outside-in data only.
   * Nothing here is inferred from analytics we do not have.
   */
  confidence: z.enum(["high", "moderate", "low"]).default("high"),
});
export type Finding = z.infer<typeof Finding>;

export interface PageRecord {
  url: string;
  status: number;
  /** Final URL after redirects, if different. */
  finalUrl: string;
  redirectChain: string[];
  contentType: string;
  bytes: number;
  fetchedAt: string;
  /** Milliseconds to first byte through full body read. */
  elapsedMs: number;
  error?: string;

  title?: string;
  metaDescription?: string;
  metaRobots?: string;
  canonical?: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  lang?: string;

  /** Parsed JSON-LD blocks. Invalid JSON is recorded in jsonLdErrors. */
  jsonLd: unknown[];
  jsonLdErrors: string[];

  images: Array<{ src: string; alt: string | null }>;
  internalLinks: string[];
  externalLinks: string[];

  /** `id` attributes present on this page, e.g. "stone_oak_aba_clinic". */
  anchorIds: string[];
  /**
   * Same-origin links that carry a fragment, normalised to "pathname#fragment".
   * Multiple clinics stacked on one URL show up here as several fragments
   * against the same pathname.
   */
  fragmentTargets: string[];

  /** Marketing/analytics tags detected in markup. */
  tags: DetectedTag[];

  /** Phone numbers and postal-address-looking strings found in body text. */
  phones: string[];
  addressLines: string[];

  /** Forms found on the page, with field names. Drives the HIPAA tag check. */
  forms: Array<{ action: string | null; method: string; fields: string[] }>;

  openGraph: Record<string, string>;
}

export interface DetectedTag {
  /** Stable key, e.g. "gtm", "ga4", "meta-pixel". */
  key: string;
  /** Human name for the report. */
  name: string;
  /** Container/measurement/pixel ID when one is recoverable from markup. */
  id?: string;
  /**
   * Whether this vendor receives data that could describe a health
   * interest when it fires on a clinical page. Drives HIPAA findings.
   */
  thirdPartyAdTech: boolean;
  evidence: string;
}

export interface CrawlResult {
  origin: string;
  startedAt: string;
  finishedAt: string;
  robotsTxt: string | null;
  robotsSitemaps: string[];
  sitemapUrls: string[];
  pages: PageRecord[];
  skipped: Array<{ url: string; reason: string }>;
}

export const TargetConfig = z.object({
  /** Display name used in report headings. */
  name: z.string(),
  origin: z.string().url(),
  /** Seed URLs beyond the origin. Sitemap discovery usually makes this unnecessary. */
  seeds: z.array(z.string().url()).default([]),
  maxPages: z.number().int().positive().default(120),
  /** Milliseconds between requests to the same host. Be polite. */
  delayMs: z.number().int().nonnegative().default(1200),
  concurrency: z.number().int().positive().max(4).default(2),
  /** URL path prefixes treated as clinic location pages. */
  locationPathPrefixes: z.array(z.string()).default(["/location/"]),
  /** Paths excluded from the crawl (regex, matched against pathname). */
  excludePatterns: z.array(z.string()).default([]),
  /** Brand strings the AEO module looks for in generated answers. */
  brandAliases: z.array(z.string()).default([]),
  /** Known competitors, for share-of-answer comparison. */
  competitors: z.array(z.string()).default([]),
  /** Path to the AEO query set JSON. */
  querySet: z.string().optional(),
});
export type TargetConfig = z.infer<typeof TargetConfig>;

export const QueryItem = z.object({
  id: z.string(),
  /** The question a prospective patient/family would actually ask. */
  query: z.string(),
  /** Funnel stage: awareness | consideration | decision | local */
  stage: z.enum(["awareness", "consideration", "decision", "local"]),
  /** Geography the query implies, if any. */
  market: z.string().optional(),
});
export type QueryItem = z.infer<typeof QueryItem>;

export const QuerySet = z.object({
  name: z.string(),
  notes: z.string().optional(),
  queries: z.array(QueryItem),
});
export type QuerySet = z.infer<typeof QuerySet>;

export interface AeoResult {
  queryId: string;
  query: string;
  stage: string;
  market?: string;
  answer: string;
  /** Brand named anywhere in the answer. */
  brandMentioned: boolean;
  /** Brand named in the first third of the answer. */
  brandProminent: boolean;
  competitorsMentioned: string[];
  /** URLs the model cited, when web search was enabled. */
  citations: string[];
  brandCited: boolean;
  error?: string;
}
