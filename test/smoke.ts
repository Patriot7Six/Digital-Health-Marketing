/**
 * Minimal assertion harness. No test framework dependency: this repo is a
 * portfolio artifact and should clone-and-run with nothing but npm install.
 *   npm run test
 */
import { parseRobots, isAllowed } from "../src/net/robots.js";
import { detectTags, extractPage } from "../src/extract.js";
import { auditContentGap } from "../src/audits/content-gap.js";
import type { CrawlResult, QuerySet } from "../src/types.js";

let pass = 0;
let fail = 0;

function check(name: string, got: unknown, want: unknown): void {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n         want ${w}\n         got  ${g}`);
  }
}

// --- robots.txt matching precedence (RFC 9309) -----------------------------
const robots = parseRobots(`
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /*.pdf$

User-agent: BadBot
Disallow: /

Sitemap: https://example.com/sitemap_index.xml
`);

check("robots: sitemap parsed", robots.sitemaps, ["https://example.com/sitemap_index.xml"]);
check("robots: plain disallow", isAllowed(robots, "recon", "/wp-admin/"), false);
check("robots: longer allow wins", isAllowed(robots, "recon", "/wp-admin/admin-ajax.php"), true);
check("robots: $ anchor matches", isAllowed(robots, "recon", "/doc.pdf"), false);
check("robots: $ anchor respects query", isAllowed(robots, "recon", "/doc.pdf?v=1"), true);
check("robots: unlisted path allowed", isAllowed(robots, "recon", "/location/kyle/"), true);
check("robots: agent-specific group wins", isAllowed(robots, "BadBot/1.0", "/anything"), false);
check("robots: null robots allows all", isAllowed(null, "recon", "/wp-admin/"), true);

// --- tag detection ---------------------------------------------------------
const tags = detectTags(`
<script src="https://www.googletagmanager.com/gtm.js?id=GTM-MS7VW9N"></script>
<script>fbq('init', '1234567890123');</script>
<script>gtag('config','AW-987654321');</script>
<script>gtag('config','G-ABC123XYZ');</script>
`);
const byKey = Object.fromEntries(tags.map((t) => [t.key, t.id]));
check("tags: GTM id", byKey["gtm"], "GTM-MS7VW9N");
check("tags: GA4 id", byKey["ga4"], "G-ABC123XYZ");
check("tags: Meta pixel id", byKey["meta-pixel"], "1234567890123");
check("tags: Google Ads id", byKey["google-ads"], "AW-987654321");
check(
  "tags: adtech flagged correctly",
  tags.filter((t) => t.thirdPartyAdTech).map((t) => t.key).sort(),
  ["google-ads", "meta-pixel"],
);

// --- extraction ------------------------------------------------------------
const html = `<!doctype html><html lang="en"><head>
<title>Clinic A</title>
<link rel="canonical" href="https://ex.com/location/a/">
<meta name="description" content="desc">
<script type="application/ld+json">{"@type":"MedicalClinic","name":"A"}</script>
</head><body>
<h1>Clinic A</h1>
<div id="north_aba_clinic"></div><div id="south_aba_clinic"></div>
<p>Call (210) 346-8696. We are at 6222 I-10 Suite 104, San Antonio, TX 78201.</p>
<a href="/location/a/#north_aba_clinic">North</a>
<a href="/location/a/#south_aba_clinic">South</a>
<a href="https://other.com/x">out</a>
<img src="/a b [c].png">
<img src="/ok.png" alt="">
<form action="/submit" method="post"><input name="child_dob"><input name="insurance_id"></form>
</body></html>`;

const page = extractPage(
  {
    url: "https://ex.com/location/a/",
    finalUrl: "https://ex.com/location/a/",
    status: 200,
    redirectChain: [],
    contentType: "text/html",
    body: html,
    bytes: html.length,
    elapsedMs: 1,
  },
  "https://ex.com",
);

check("extract: title", page.title, "Clinic A");
check("extract: canonical", page.canonical, "https://ex.com/location/a/");
check("extract: h1", page.h1, ["Clinic A"]);
check("extract: json-ld parsed", page.jsonLd.length, 1);
check("extract: phone found", page.phones, ["(210) 346-8696"]);
check("extract: address found", page.addressLines, ["6222 I-10 Suite 104, San Antonio, TX 78201"]);
check("extract: fragments captured", page.fragmentTargets.length, 2);
check("extract: clinic anchor ids", page.anchorIds.includes("south_aba_clinic"), true);
check("extract: external link separated", page.externalLinks, ["https://other.com/x"]);
check("extract: missing alt is null, empty alt is ''", page.images.map((i) => i.alt), [null, ""]);
check("extract: form fields", page.forms[0]?.fields, ["child_dob", "insurance_id"]);

// --- content gap -----------------------------------------------------------
const crawl: CrawlResult = {
  origin: "https://ex.com",
  startedAt: "",
  finishedAt: "",
  robotsTxt: null,
  robotsSitemaps: [],
  sitemapUrls: [],
  skipped: [],
  pages: [{ ...page, wordCount: 500 }],
};
const qs: QuerySet = {
  name: "t",
  queries: [
    { id: "q1", stage: "local", query: "Clinic A location" },
    { id: "q2", stage: "awareness", query: "how much does hydroponic gardening cost" },
  ],
};
const gap = auditContentGap(crawl, qs);
check("content-gap: matched query covered", gap.covered.map((c) => c.queryId), ["q1"]);
check("content-gap: unrelated query is a gap", gap.gaps.map((g) => g.queryId), ["q2"]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
