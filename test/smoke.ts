/**
 * Minimal assertion harness. No test framework dependency: this repo is a
 * portfolio artifact and should clone-and-run with nothing but npm install.
 *   npm run test
 */
import { parseRobots, isAllowed } from "../src/net/robots.js";
import { detectTags, extractPage } from "../src/extract.js";
import { auditContentGap } from "../src/audits/content-gap.js";
import { auditTechnicalSeo } from "../src/audits/technical-seo.js";
import { collectLocations } from "../src/audits/local.js";
import { anonymize, deriveTokens, findLeaks } from "../src/anonymize.js";
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

// --- staging-host detection must not fire on partner domains --------------
// Regression: "pediatricpsychologytesting.com" contains "test" and
// "paradigmdevelopmentcenter.com" contains "dev". Neither is a staging host.
function pageWithLinks(url: string, links: string[]) {
  const anchors = links.map((l) => `<a href="${l}">x</a>`).join("");
  const doc = `<!doctype html><html><head><title>t</title></head><body><h1>t</h1><p>${"word ".repeat(
    120,
  )}</p>${anchors}</body></html>`;
  return extractPage(
    {
      url,
      finalUrl: url,
      status: 200,
      redirectChain: [],
      contentType: "text/html",
      body: doc,
      bytes: doc.length,
      elapsedMs: 1,
    },
    "https://ex.com",
  );
}

const stagingCrawl: CrawlResult = {
  origin: "https://ex.com",
  startedAt: "",
  finishedAt: "",
  robotsTxt: "User-agent: *\nDisallow:\nSitemap: https://ex.com/sitemap.xml",
  robotsSitemaps: ["https://ex.com/sitemap.xml"],
  sitemapUrls: [],
  skipped: [],
  pages: [
    pageWithLinks("https://ex.com/a", [
      "https://www.pediatricpsychologytesting.com/",
      "https://www.paradigmdevelopmentcenter.com/",
      "https://www.stuartdevelopmentalpediatrics.com/",
      "https://exstg.wpengine.com/asset.png",
      "https://staging.ex.com/x",
    ]),
  ],
};

const stagingFindings = auditTechnicalSeo(stagingCrawl)
  .filter((f) => f.id.startsWith("seo-staging-leak-"))
  .map((f) => f.evidence[0])
  .sort();

check(
  "staging: partner domains not flagged, real ones are",
  stagingFindings,
  ["exstg.wpengine.com", "staging.ex.com"],
);

// --- content gap must not report coverage from high-frequency terms --------
// Every page shares "aba therapy autism texas"; only one is about insurance.
const narrowPages = [
  "ABA Therapy for Autism in Waco Texas",
  "ABA Therapy for Autism in Kyle Texas",
  "ABA Therapy for Autism in Spring Texas",
  "ABA Therapy for Autism in Victoria Texas",
  "Accepted Insurance Coverage for ABA Therapy in Texas",
].map((title, i) => {
  const doc = `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>${"word ".repeat(
    120,
  )}</p></body></html>`;
  return extractPage(
    {
      url: `https://ex.com/p${i}`,
      finalUrl: `https://ex.com/p${i}`,
      status: 200,
      redirectChain: [],
      contentType: "text/html",
      body: doc,
      bytes: doc.length,
      elapsedMs: 1,
    },
    "https://ex.com",
  );
});

const narrowCrawl: CrawlResult = {
  origin: "https://ex.com",
  startedAt: "",
  finishedAt: "",
  robotsTxt: null,
  robotsSitemaps: [],
  sitemapUrls: [],
  skipped: [],
  pages: narrowPages,
};

const narrowGap = auditContentGap(narrowCrawl, {
  name: "narrow",
  queries: [
    { id: "g1", stage: "consideration", query: "Does insurance cover ABA therapy for autism in Texas?" },
    { id: "g2", stage: "consideration", query: "What questions should I ask an ABA provider before enrolling my child?" },
    { id: "g3", stage: "awareness", query: "What are the early signs of autism in toddlers?" },
  ],
});

check(
  "content-gap: distinctive-term query is covered",
  narrowGap.covered.map((c) => c.queryId),
  ["g1"],
);
check(
  "content-gap: shared brand vocabulary alone is not coverage",
  narrowGap.gaps.map((g) => g.queryId).sort(),
  ["g2", "g3"],
);

// --- clinic detection must ignore site-wide UI widgets --------------------
// Regression: an id like "get_my_location_menu" contains "location" and was
// counted as a clinic on every page carrying the nav widget.
const locPage = (() => {
  const doc = `<!doctype html><html><head><title>San Antonio</title></head><body>
<h1>San Antonio</h1>
<div id="get_my_location_menu"></div>
<div id="location_search_form"></div>
<div id="stone_oak_aba_clinic"></div>
<div id="far_west_san_antonio_aba_clinic"></div>
<p>${"word ".repeat(200)}</p>
<p>Call (210) 346-8696. 6222 I-10 Suite 104, San Antonio, TX 78201.</p>
</body></html>`;
  return extractPage(
    {
      url: "https://ex.com/location/san-antonio-tx/",
      finalUrl: "https://ex.com/location/san-antonio-tx/",
      status: 200,
      redirectChain: [],
      contentType: "text/html",
      body: doc,
      bytes: doc.length,
      elapsedMs: 1,
    },
    "https://ex.com",
  );
})();

const locCrawl: CrawlResult = {
  origin: "https://ex.com",
  startedAt: "",
  finishedAt: "",
  robotsTxt: null,
  robotsSitemaps: [],
  sitemapUrls: [],
  skipped: [],
  pages: [locPage],
};
const locConfig = {
  name: "t",
  origin: "https://ex.com",
  seeds: [],
  maxPages: 10,
  delayMs: 0,
  concurrency: 1,
  locationPathPrefixes: ["/location/"],
  excludePatterns: [],
  brandAliases: [],
  competitors: [],
};
const locs = collectLocations(locCrawl, locConfig);
check(
  "local: UI widget ids excluded, real clinic anchors kept",
  locs[0]?.anchors.sort(),
  ["far_west_san_antonio_aba_clinic", "stone_oak_aba_clinic"],
);
check("local: anchor detection recorded", locs[0]?.detection, "anchor");

// Regression: a suite number must not yield a second, spurious address.
const suitePage = (() => {
  const doc = `<!doctype html><html><head><title>x</title></head><body><h1>x</h1>
<p>${"word ".repeat(120)}</p>
<p>6222 I-10 Suite #104 San Antonio, TX 78201</p></body></html>`;
  return extractPage(
    {
      url: "https://ex.com/location/hq/",
      finalUrl: "https://ex.com/location/hq/",
      status: 200,
      redirectChain: [],
      contentType: "text/html",
      body: doc,
      bytes: doc.length,
      elapsedMs: 1,
    },
    "https://ex.com",
  );
})();
check("extract: suite number does not create a second address", suitePage.addressLines.length, 1);

// Regression: aliases redirecting to one page must be counted once.
const dupCrawl: CrawlResult = {
  ...locCrawl,
  pages: [locPage, { ...locPage, url: "https://ex.com/location/nw-san-antonio-tx/" }],
};
check("local: redirect aliases counted once", collectLocations(dupCrawl, locConfig).length, 1);

// --- anonymisation ---------------------------------------------------------
// Regression: the first version matched configured aliases as whole strings
// and missed a slugified finding id, a sibling staging host, and a logo
// filename spelled the British way.
const anonConfig = {
  name: "Empower Behavioral Health",
  origin: "https://www.empowerbh.com",
  seeds: [],
  maxPages: 10,
  delayMs: 0,
  concurrency: 1,
  locationPathPrefixes: ["/location/"],
  excludePatterns: [],
  brandAliases: ["EmpowerBH", "Empower BH"],
  competitors: [],
};
const anonCrawl: CrawlResult = {
  origin: "https://www.empowerbh.com",
  startedAt: "",
  finishedAt: "",
  robotsTxt: null,
  robotsSitemaps: [],
  sitemapUrls: [],
  skipped: [],
  pages: [],
};
const anonFindings = [
  {
    id: "seo-dup-title-aba-therapy-for-autism-in-kyle-tx-empower-bh",
    module: "technical-seo" as const,
    severity: "high" as const,
    title: "2 pages sharing the title \"ABA Therapy in Kyle, TX | Empower BH\"",
    detail: "Duplicate titles compete.",
    evidence: [
      "https://empowerbhstg.wpengine.com/wp-content/Empower-Behavioural-Health-Logo.png",
    ],
    urls: ["https://www.empowerbh.com/location/kyle-tx/"],
    recommendation: "Write a distinct title.",
    confidence: "high" as const,
  },
];

const tokens = deriveTokens(anonConfig, anonCrawl);
check("anonymize: derives distinctive tokens only", tokens.includes("empower") && tokens.includes("empowerbh"), true);
check("anonymize: industry words are not tokens", tokens.includes("behavioral") || tokens.includes("health"), false);

const scrubbed = anonymize(anonConfig, anonCrawl, anonFindings, { label: "Example provider" });
const rendered = JSON.stringify(scrubbed.findings) + JSON.stringify(scrubbed.config);
check("anonymize: no target reference survives", findLeaks(rendered, scrubbed.tokens), []);
check("anonymize: slugified finding id is scrubbed", /empower/i.test(scrubbed.findings[0]?.id ?? ""), false);
check("anonymize: finding id stays a clean slug", /^[a-z0-9-]+$/.test(scrubbed.findings[0]?.id ?? ""), true);
check("anonymize: leak detector actually detects", findLeaks("visit empowerbh.com today", tokens).length > 0, true);

// --- crawl-level dedup -----------------------------------------------------
// Regression: /location/kyle-tx/ and /location/kyle/ resolve to one page. Two
// records for that page made the duplicate-title audit report a single page as
// two pages sharing a title.
{
  const html = `<!doctype html><html><head><title>Kyle</title></head><body><h1>Kyle</h1><p>${"word ".repeat(
    120,
  )}</p></body></html>`;
  const mk = (requested: string, final: string) =>
    extractPage(
      {
        url: requested,
        finalUrl: final,
        status: 200,
        redirectChain: requested === final ? [] : [requested, final],
        contentType: "text/html",
        body: html,
        bytes: html.length,
        elapsedMs: 1,
      },
      "https://ex.com",
    );

  const aliasCrawl: CrawlResult = {
    origin: "https://ex.com",
    startedAt: "",
    finishedAt: "",
    robotsTxt: null,
    robotsSitemaps: [],
    sitemapUrls: [],
    skipped: [],
    // Simulates what the crawler produced before dedup: one page, two records.
    pages: [mk("https://ex.com/location/kyle/", "https://ex.com/location/kyle/")],
  };
  const dupTitles = auditTechnicalSeo(aliasCrawl).filter((f) => f.id.startsWith("seo-dup-title"));
  check("technical-seo: one page is not a duplicate of itself", dupTitles.length, 0);
}

// Regression: "EBH" appeared in a slug and survived redaction, because the
// initialism is three letters and appears in no alias.
check(
  "anonymize: initialism is derived and redacted",
  tokens.includes("ebh"),
  true,
);
{
  const withInitialism = anonymize(
    anonConfig,
    anonCrawl,
    [
      {
        ...anonFindings[0]!,
        id: "seo-title-long",
        urls: ["https://www.empowerbh.com/blog/ebh-spectacular-kids-partnership/"],
        evidence: [],
      },
    ],
    { label: "Example provider" },
  );
  check(
    "anonymize: initialism in a slug does not survive",
    /ebh/i.test(withInitialism.findings[0]?.urls[0] ?? ""),
    false,
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
