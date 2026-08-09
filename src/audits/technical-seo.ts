import type { CrawlResult, Finding } from "../types.js";
import { plural, slug, truncate } from "../util.js";

const CAP = "Own SEO strategy and organic website performance (technical SEO, on-page optimization)";

export function auditTechnicalSeo(crawl: CrawlResult): Finding[] {
  const out: Finding[] = [];
  const ok = crawl.pages.filter((p) => p.status === 200 && !p.error);

  if (ok.length === 0) return out;

  if (crawl.robotsTxt === null) {
    out.push({
      id: "seo-robots-missing",
      module: "technical-seo",
      severity: "medium",
      title: "No robots.txt served at the origin",
      detail:
        "A request to /robots.txt did not return a usable file. Crawlers fall back to crawling everything, and there is no place to declare sitemap locations.",
      evidence: [`GET ${crawl.origin}/robots.txt`],
      urls: [`${crawl.origin}/robots.txt`],
      recommendation:
        "Publish robots.txt with an explicit Sitemap: directive and disallow rules for search, cart, and parameterised duplicate paths.",
      capability: CAP,
      confidence: "high",
    });
  } else if (crawl.robotsSitemaps.length === 0) {
    out.push({
      id: "seo-robots-no-sitemap",
      module: "technical-seo",
      severity: "low",
      title: "robots.txt does not declare a sitemap",
      detail:
        "robots.txt is present but contains no Sitemap: directive, so discovery depends on manual submission in each search console.",
      evidence: [],
      urls: [`${crawl.origin}/robots.txt`],
      recommendation: "Add a Sitemap: line pointing at the sitemap index.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- canonical collisions -------------------------------------------------
  // Distinct URLs pointing at one canonical means only one can rank.
  const byCanonical = new Map<string, string[]>();
  for (const p of ok) {
    if (!p.canonical) continue;
    const key = normalise(p.canonical);
    const self = normalise(p.finalUrl);
    if (key === self) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(p.finalUrl);
    byCanonical.set(key, list);
  }
  for (const [canonical, urls] of byCanonical) {
    if (urls.length < 2) continue;
    out.push({
      id: `seo-canonical-collision-${slug(canonical)}`,
      module: "technical-seo",
      severity: "high",
      title: `${plural(urls.length, "URL")} sharing one canonical`,
      detail:
        `These pages each declare rel=canonical pointing at ${canonical}. Search engines will consolidate them into that single URL, so the individual pages cannot rank or accrue links on their own.`,
      evidence: [`canonical: ${canonical}`],
      urls,
      recommendation:
        "Give each page a self-referencing canonical, or merge the pages if they are genuinely duplicates.",
      capability: CAP,
      confidence: "high",
    });
  }

  const missingCanonical = ok.filter((p) => !p.canonical).map((p) => p.finalUrl);
  if (missingCanonical.length > 0) {
    out.push({
      id: "seo-canonical-missing",
      module: "technical-seo",
      severity: "medium",
      title: `${plural(missingCanonical.length, "page")} without a canonical tag`,
      detail:
        "Without a canonical, parameterised and trailing-slash variants of the same page can each be indexed separately.",
      evidence: [],
      urls: missingCanonical,
      recommendation: "Emit a self-referencing canonical on every indexable page.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- titles ---------------------------------------------------------------
  const dupTitles = groupBy(ok.filter((p) => p.title), (p) => p.title!.trim().toLowerCase());
  for (const [title, pages] of dupTitles) {
    if (pages.length < 2) continue;
    out.push({
      id: `seo-dup-title-${slug(title)}`,
      module: "technical-seo",
      severity: "high",
      title: `${plural(pages.length, "page")} sharing the title "${truncate(pages[0]!.title!, 60)}"`,
      detail:
        "Duplicate titles across pages compete for the same queries and give searchers no way to tell the results apart.",
      evidence: [pages[0]!.title!],
      urls: pages.map((p) => p.finalUrl),
      recommendation:
        "Write a distinct title per page. For location pages, include the clinic's city and neighbourhood.",
      capability: CAP,
      confidence: "high",
    });
  }

  const noTitle = ok.filter((p) => !p.title).map((p) => p.finalUrl);
  if (noTitle.length > 0) {
    out.push(simple("seo-title-missing", "high", `${plural(noTitle.length, "page")} without a title tag`,
      "The title is the strongest single on-page ranking and click-through signal.",
      noTitle, "Add a unique, descriptive title to every page.", CAP));
  }

  const longTitles = ok.filter((p) => (p.title?.length ?? 0) > 65).map((p) => p.finalUrl);
  if (longTitles.length > 0) {
    out.push(simple("seo-title-long", "low", `${plural(longTitles.length, "title")} over 65 characters`,
      "Longer titles are truncated in results, so the closing words are not seen.",
      longTitles, "Front-load the distinguishing terms; keep titles near 60 characters.", CAP));
  }

  // --- meta descriptions ----------------------------------------------------
  const noDesc = ok.filter((p) => !p.metaDescription).map((p) => p.finalUrl);
  if (noDesc.length > 0) {
    out.push(simple("seo-desc-missing", "medium",
      `${plural(noDesc.length, "page")} without a meta description`,
      "Search engines generate a snippet from body text instead, which is rarely the sentence that converts.",
      noDesc, "Write a description per page ending in the action you want a parent to take.", CAP));
  }

  const dupDesc = groupBy(ok.filter((p) => p.metaDescription), (p) =>
    p.metaDescription!.trim().toLowerCase(),
  );
  for (const [, pages] of dupDesc) {
    if (pages.length < 3) continue;
    out.push({
      id: `seo-dup-desc-${slug(pages[0]!.metaDescription!)}`,
      module: "technical-seo",
      severity: "medium",
      title: `${plural(pages.length, "page")} sharing one meta description`,
      detail: "Repeated descriptions mean every location result reads identically in search.",
      evidence: [truncate(pages[0]!.metaDescription!, 180)],
      urls: pages.map((p) => p.finalUrl),
      recommendation: "Template the description per location with city, services, and insurance.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- headings -------------------------------------------------------------
  const noH1 = ok.filter((p) => p.h1.length === 0).map((p) => p.finalUrl);
  if (noH1.length > 0) {
    out.push(simple("seo-h1-missing", "medium", `${plural(noH1.length, "page")} without an H1`,
      "The H1 states the page topic for both readers and crawlers.", noH1,
      "Add a single H1 that names the service and the market.", CAP));
  }

  const multiH1 = ok.filter((p) => p.h1.length > 1).map((p) => p.finalUrl);
  if (multiH1.length > 0) {
    out.push(simple("seo-h1-multiple", "low", `${plural(multiH1.length, "page")} with more than one H1`,
      "Multiple H1s dilute the topical signal, usually a theme or page-builder artefact.",
      multiH1, "Demote secondary H1s to H2.", CAP));
  }

  // --- thin content ---------------------------------------------------------
  const thin = ok.filter((p) => p.wordCount > 0 && p.wordCount < 300);
  if (thin.length > 0) {
    out.push({
      id: "seo-thin-content",
      module: "technical-seo",
      severity: "medium",
      title: `${plural(thin.length, "page")} under 300 words of body copy`,
      detail:
        "Thin pages rarely rank for competitive terms and give answer engines nothing to quote.",
      evidence: thin.slice(0, 5).map((p) => `${p.finalUrl} - ${p.wordCount} words`),
      urls: thin.map((p) => p.finalUrl),
      recommendation:
        "Expand each page to answer the questions a visitor actually arrives with. Thin pages are also the ones answer engines skip, because there is no substantive passage to quote.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- images ---------------------------------------------------------------
  let missingAlt = 0;
  let unencoded = 0;
  const unencodedSamples: string[] = [];
  const altPages = new Set<string>();
  const unencodedPages = new Set<string>();

  for (const p of ok) {
    for (const img of p.images) {
      if (!img.src) continue;
      if (img.alt === null) {
        missingAlt++;
        altPages.add(p.finalUrl);
      }
      if (/[ \[\]]/.test(img.src)) {
        unencoded++;
        unencodedPages.add(p.finalUrl);
        if (unencodedSamples.length < 5) unencodedSamples.push(img.src);
      }
    }
  }

  if (missingAlt > 0) {
    out.push({
      id: "seo-img-alt",
      module: "technical-seo",
      severity: "medium",
      title: `${plural(missingAlt, "image")} without an alt attribute`,
      detail:
        "Missing alt text is both an accessibility defect under WCAG 1.1.1 and lost image-search context. For a provider serving families with disabilities, the accessibility side is the larger exposure.",
      evidence: [],
      urls: [...altPages],
      recommendation:
        "Add descriptive alt text to content images and alt=\"\" to decorative ones. The empty string is a deliberate signal; a missing attribute is not.",
      capability: CAP,
      confidence: "high",
    });
  }

  if (unencoded > 0) {
    out.push({
      id: "seo-img-unencoded",
      module: "technical-seo",
      severity: "low",
      title: `${plural(unencoded, "image URL")} containing unencoded spaces or brackets`,
      detail:
        "Spaces and square brackets in file paths are encoded inconsistently across clients and CDNs, which produces intermittent broken images.",
      evidence: unencodedSamples,
      urls: [...unencodedPages],
      recommendation: "Rename assets to lowercase hyphenated filenames and update references.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- staging / non-production host references ----------------------------
  const stagingHosts = new Map<string, Set<string>>();
  for (const p of ok) {
    for (const link of [...p.externalLinks, ...p.images.map((i) => i.src)]) {
      const m = /https?:\/\/([a-z0-9.-]*(?:staging|stg|dev|test)[a-z0-9.-]*\.[a-z.]+)/i.exec(link);
      if (!m?.[1]) continue;
      const set = stagingHosts.get(m[1]) ?? new Set<string>();
      set.add(p.finalUrl);
      stagingHosts.set(m[1], set);
    }
  }
  for (const [host, urls] of stagingHosts) {
    out.push({
      id: `seo-staging-leak-${slug(host)}`,
      module: "technical-seo",
      severity: "high",
      title: `Production pages reference the non-production host ${host}`,
      detail:
        "Hard-coded staging URLs in live markup leak internal infrastructure, can serve stale assets, and occasionally get the staging environment crawled and indexed alongside production.",
      evidence: [host],
      urls: [...urls],
      recommendation:
        "Replace absolute staging URLs with relative or production-absolute paths, and confirm the staging environment returns noindex plus HTTP auth.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- errors and redirects -------------------------------------------------
  const broken = crawl.pages.filter((p) => p.status >= 400 || (p.status === 0 && p.error));
  if (broken.length > 0) {
    out.push({
      id: "seo-broken",
      module: "technical-seo",
      severity: "high",
      title: `${plural(broken.length, "linked URL")} failing to return a page`,
      detail: "Internally linked URLs returning an error waste crawl budget and break user paths.",
      evidence: broken.slice(0, 8).map((p) => `${p.status || "ERR"} ${p.url}${p.error ? ` (${p.error})` : ""}`),
      urls: broken.map((p) => p.url),
      recommendation: "Fix or 301 each URL, then correct the internal links pointing at it.",
      capability: CAP,
      confidence: "high",
    });
  }

  const redirected = ok.filter((p) => p.redirectChain.length > 0);
  if (redirected.length > 0) {
    out.push({
      id: "seo-internal-redirects",
      module: "technical-seo",
      severity: "low",
      title: `${plural(redirected.length, "internal link")} resolving through a redirect`,
      detail: "Each hop costs latency and slightly dilutes link signals.",
      evidence: redirected.slice(0, 6).map((p) => `${p.url} -> ${p.finalUrl}`),
      urls: redirected.map((p) => p.url),
      recommendation: "Point internal links at final URLs.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- noindex on pages that should convert --------------------------------
  const noindexed = ok
    .filter((p) => /noindex/i.test(p.metaRobots ?? ""))
    .map((p) => p.finalUrl);
  if (noindexed.length > 0) {
    out.push(simple("seo-noindex", "info", `${plural(noindexed.length, "page")} set to noindex`,
      "Confirm each is deliberate. Location and service pages set to noindex cannot generate organic patients.",
      noindexed, "Review the list and remove noindex from anything intended to rank.", CAP));
  }

  // --- Open Graph image sizing ---------------------------------------------
  const smallOg = ok.filter((p) => {
    const w = Number(p.openGraph["og:image:width"]);
    const h = Number(p.openGraph["og:image:height"]);
    return Number.isFinite(w) && Number.isFinite(h) && (w < 600 || h < 315);
  });
  if (smallOg.length > 0) {
    const first = smallOg[0]!;
    out.push({
      id: "seo-og-image-small",
      module: "technical-seo",
      severity: "low",
      title: `Open Graph image is below the size social platforms render large`,
      detail:
        `og:image is declared at ${first.openGraph["og:image:width"]}x${first.openGraph["og:image:height"]}. Facebook and LinkedIn fall back to a small thumbnail below roughly 600x315, which measurably reduces click-through on shared and paid social links.`,
      evidence: [first.openGraph["og:image"] ?? ""].filter(Boolean),
      urls: smallOg.map((p) => p.finalUrl),
      recommendation: "Publish a 1200x630 share image and set og:image:width/height to match.",
      capability: CAP,
      confidence: "high",
    });
  }

  return out;
}

function simple(
  id: string,
  severity: Finding["severity"],
  title: string,
  detail: string,
  urls: string[],
  recommendation: string,
  capability: string,
): Finding {
  return {
    id,
    module: "technical-seo",
    severity,
    title,
    detail,
    evidence: [],
    urls,
    recommendation,
    capability,
    confidence: "high",
  };
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = m.get(k) ?? [];
    list.push(item);
    m.set(k, list);
  }
  return m;
}

function normalise(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    let path = url.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    return `${url.origin}${path}${url.search}`;
  } catch {
    return u;
  }
}


