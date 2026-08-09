import type { CrawlResult, Finding, TargetConfig } from "./types.js";

/**
 * Rewrites a report so it can be published as a work sample without naming
 * the site it was run against.
 *
 * Every audit finding is reproducible by anyone who runs the tool, so the
 * findings themselves are not sensitive. The target's identity is a courtesy
 * question, not a security one: an unsolicited audit with a company's name on
 * it reads differently from a demonstration of method.
 *
 * Replacement is done on whole strings across names, URLs, and evidence, and
 * covers the bare registrable domain as well as the full host, so a reference
 * like "empowerbhstg.wpengine.com" does not survive by being spelled
 * differently from the origin.
 */
export interface AnonymizeOptions {
  /** Display name substituted for the target, e.g. "Regional ABA Provider". */
  label: string;
  /** Host substituted for the real one. Uses a reserved example domain. */
  host?: string;
}

export interface Anonymized {
  config: TargetConfig;
  crawl: CrawlResult;
  findings: Finding[];
}

export function anonymize(
  config: TargetConfig,
  crawl: CrawlResult,
  findings: Finding[],
  opts: AnonymizeOptions,
): Anonymized {
  const host = opts.host ?? "provider.example";
  const patterns = buildPatterns(config, crawl, host, opts.label);
  const scrub = (s: string): string =>
    patterns.reduce((acc, [re, to]) => acc.replace(re, to), s);

  return {
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
      robotsTxt: crawl.robotsTxt ? scrub(crawl.robotsTxt) : null,
      robotsSitemaps: crawl.robotsSitemaps.map(scrub),
      sitemapUrls: crawl.sitemapUrls.map(scrub),
      skipped: crawl.skipped.map((s) => ({ ...s, url: scrub(s.url) })),
      pages: crawl.pages.map((p) => ({
        ...p,
        url: scrub(p.url),
        finalUrl: scrub(p.finalUrl),
        canonical: p.canonical ? scrub(p.canonical) : p.canonical,
        title: p.title ? scrub(p.title) : p.title,
        metaDescription: p.metaDescription ? scrub(p.metaDescription) : p.metaDescription,
        h1: p.h1.map(scrub),
        h2: p.h2.map(scrub),
        internalLinks: p.internalLinks.map(scrub),
        externalLinks: p.externalLinks.map(scrub),
        redirectChain: p.redirectChain.map(scrub),
      })),
    },
    findings: findings.map((f) => ({
      ...f,
      title: scrub(f.title),
      detail: scrub(f.detail),
      evidence: f.evidence.map(scrub),
      urls: f.urls.map(scrub),
      recommendation: scrub(f.recommendation),
    })),
  };
}

function buildPatterns(
  config: TargetConfig,
  crawl: CrawlResult,
  host: string,
  label: string,
): Array<[RegExp, string]> {
  const hosts = new Set<string>();
  const originHost = hostOf(config.origin) ?? hostOf(crawl.origin);
  if (originHost) {
    hosts.add(originHost);
    hosts.add(originHost.replace(/^www\./, ""));
    // The registrable domain on its own catches sibling hosts such as
    // staging environments, which would otherwise survive the pass.
    const bare = originHost.replace(/^www\./, "").split(".").slice(-2).join(".");
    hosts.add(bare);
  }

  const names = new Set<string>([config.name, ...config.brandAliases]);

  const patterns: Array<[RegExp, string]> = [];

  // Longest first, so "www.example.com" is replaced before "example.com".
  for (const h of [...hosts].sort((a, b) => b.length - a.length)) {
    if (!h) continue;
    patterns.push([new RegExp(`[A-Za-z0-9.-]*${escapeRe(h)}`, "gi"), host]);
  }
  for (const n of [...names].sort((a, b) => b.length - a.length)) {
    if (!n || n.length < 3) continue;
    patterns.push([new RegExp(escapeRe(n), "gi"), label]);
  }

  return patterns;
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
