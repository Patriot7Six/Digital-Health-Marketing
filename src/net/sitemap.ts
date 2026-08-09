import * as cheerio from "cheerio";
import type { PoliteFetcher } from "./fetcher.js";

/** Conventional locations to probe when robots.txt names no sitemap. */
const COMMON_PATHS = [
  "/sitemap_index.xml",
  "/sitemap.xml",
  "/wp-sitemap.xml",
  "/sitemap-index.xml",
];

export interface SitemapHarvest {
  /** Sitemap documents actually fetched. */
  sitemapsFetched: string[];
  /** Page URLs discovered. Deduped, order preserved. */
  urls: string[];
  errors: string[];
}

/**
 * Expands sitemap indexes recursively. Depth-capped because a
 * self-referential index would otherwise loop.
 */
export async function harvestSitemaps(
  fetcher: PoliteFetcher,
  origin: string,
  declared: string[],
  maxDocs = 40,
): Promise<SitemapHarvest> {
  const queue: string[] = [];
  const seenDoc = new Set<string>();
  const urls: string[] = [];
  const seenUrl = new Set<string>();
  const sitemapsFetched: string[] = [];
  const errors: string[] = [];

  const enqueue = (u: string) => {
    const norm = safeUrl(u, origin);
    if (norm && !seenDoc.has(norm)) {
      seenDoc.add(norm);
      queue.push(norm);
    }
  };

  for (const d of declared) enqueue(d);
  if (queue.length === 0) for (const p of COMMON_PATHS) enqueue(origin + p);

  while (queue.length > 0 && sitemapsFetched.length < maxDocs) {
    const docUrl = queue.shift()!;
    const res = await fetcher.get(docUrl);

    if (res.error || res.status !== 200) {
      // A missing conventional path is expected, not an error worth surfacing.
      if (declared.includes(docUrl)) {
        errors.push(`${docUrl}: ${res.error ?? `HTTP ${res.status}`}`);
      }
      continue;
    }

    const looksXml =
      res.contentType.includes("xml") || res.body.trimStart().startsWith("<?xml");
    if (!looksXml && !res.body.includes("<urlset") && !res.body.includes("<sitemapindex")) {
      continue;
    }

    sitemapsFetched.push(docUrl);
    const $ = cheerio.load(res.body, { xmlMode: true });

    $("sitemapindex > sitemap > loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc) enqueue(loc);
    });

    $("urlset > url > loc").each((_, el) => {
      const loc = safeUrl($(el).text().trim(), origin);
      if (loc && !seenUrl.has(loc)) {
        seenUrl.add(loc);
        urls.push(loc);
      }
    });
  }

  return { sitemapsFetched, urls, errors };
}

function safeUrl(raw: string, base: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}
