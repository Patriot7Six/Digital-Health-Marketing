import { PoliteFetcher, sleep } from "./net/fetcher.js";
import { parseRobots, isAllowed, crawlDelayFor, type ParsedRobots } from "./net/robots.js";
import { harvestSitemaps } from "./net/sitemap.js";
import { extractPage } from "./extract.js";
import type { CrawlResult, PageRecord, TargetConfig } from "./types.js";

const DEFAULT_UA =
  "acquisition-recon/0.1 (+https://github.com/; public-data site audit; respects robots.txt)";

export interface CrawlOptions {
  userAgent?: string;
  onProgress?: (done: number, total: number, url: string) => void;
}

export async function crawlSite(
  config: TargetConfig,
  opts: CrawlOptions = {},
): Promise<CrawlResult> {
  const userAgent = opts.userAgent ?? process.env.RECON_USER_AGENT ?? DEFAULT_UA;
  const origin = new URL(config.origin).origin;
  const startedAt = new Date().toISOString();

  // Fetch robots.txt first at a fixed polite delay, then honour any
  // Crawl-delay it declares for the rest of the run.
  const probe = new PoliteFetcher({ userAgent, delayMs: config.delayMs });
  const robotsRes = await probe.get(`${origin}/robots.txt`);

  let robots: ParsedRobots | null = null;
  let robotsTxt: string | null = null;
  if (!robotsRes.error && robotsRes.status === 200 && robotsRes.body.trim()) {
    robotsTxt = robotsRes.body;
    robots = parseRobots(robotsRes.body);
  }

  const declaredDelayMs = (crawlDelayFor(robots, userAgent) ?? 0) * 1000;
  const delayMs = Math.max(config.delayMs, declaredDelayMs);
  const fetcher = new PoliteFetcher({ userAgent, delayMs });

  const harvest = await harvestSitemaps(fetcher, origin, robots?.sitemaps ?? []);

  const excludeRes = config.excludePatterns.map((p) => new RegExp(p));
  const skipped: Array<{ url: string; reason: string }> = [];

  const queued = new Set<string>();
  const frontier: string[] = [];

  const consider = (raw: string): void => {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    u.hash = "";
    // Strip campaign parameters so the same page is not crawled twice.
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid|fbclid|msclkid|_gl$)/i.test(p)) u.searchParams.delete(p);
    }
    const url = u.toString();
    if (queued.has(url)) return;

    if (/\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|zip|mp4|woff2?|ttf|xml)$/i.test(u.pathname)) {
      return;
    }
    if (excludeRes.some((re) => re.test(u.pathname))) {
      skipped.push({ url, reason: "excludePatterns" });
      return;
    }
    if (!isAllowed(robots, userAgent, u.pathname + u.search)) {
      skipped.push({ url, reason: "robots.txt disallow" });
      return;
    }
    queued.add(url);
    frontier.push(url);
  };

  consider(origin + "/");
  for (const s of config.seeds) consider(s);
  for (const s of harvest.urls) consider(s);

  const pages: PageRecord[] = [];
  let cursor = 0;
  // Workers that are mid-fetch and may still push onto the frontier.
  let inFlight = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (pages.length >= config.maxPages) return;

      if (cursor >= frontier.length) {
        // The frontier is empty for now, but a peer that is still fetching
        // may be about to extend it. Exiting here would silently truncate
        // the crawl. Wait for the peer, then re-check.
        if (inFlight === 0) return;
        await sleep(120);
        continue;
      }

      const idx = cursor++;
      const url = frontier[idx];
      if (!url) continue;

      inFlight++;
      try {
        const res = await fetcher.get(url);
        const page = extractPage(res, origin);
        pages.push(page);
        opts.onProgress?.(pages.length, Math.min(frontier.length, config.maxPages), url);

        // Only expand the frontier from same-origin HTML we successfully read.
        if (!page.error && page.status === 200) {
          for (const link of page.internalLinks) consider(link);
        }
      } finally {
        inFlight--;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(config.concurrency, 4) }, () => worker()),
  );

  return {
    origin,
    startedAt,
    finishedAt: new Date().toISOString(),
    robotsTxt,
    robotsSitemaps: robots?.sitemaps ?? [],
    sitemapUrls: harvest.urls,
    pages,
    skipped,
  };
}
