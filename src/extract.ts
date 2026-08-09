import * as cheerio from "cheerio";
import type { DetectedTag, PageRecord } from "./types.js";
import type { FetchOutcome } from "./net/fetcher.js";

/**
 * Signatures for marketing and analytics tags that are visible in server-
 * rendered markup. Tags injected client-side by a tag manager will not appear
 * here; that limitation is stated in docs/06-limitations.md and in the report.
 *
 * `thirdPartyAdTech` marks vendors that build advertising profiles. Whether
 * those may fire on a given page of a HIPAA-regulated site is a legal
 * question, not a technical one. See docs/02-hipaa-marketing.md.
 */
interface TagSignature {
  key: string;
  name: string;
  thirdPartyAdTech: boolean;
  /** Each pattern's first capture group, if present, is treated as the ID. */
  patterns: RegExp[];
}

const TAG_SIGNATURES: TagSignature[] = [
  {
    key: "gtm",
    name: "Google Tag Manager",
    thirdPartyAdTech: false,
    patterns: [
      /googletagmanager\.com\/(?:gtm\.js|ns\.html)\?id=(GTM-[A-Z0-9]+)/i,
      /["'](GTM-[A-Z0-9]{4,})["']/,
    ],
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    thirdPartyAdTech: false,
    patterns: [
      /googletagmanager\.com\/gtag\/js\?id=(G-[A-Z0-9]+)/i,
      /gtag\(\s*['"]config['"]\s*,\s*['"](G-[A-Z0-9]+)['"]/i,
    ],
  },
  {
    key: "google-ads",
    name: "Google Ads conversion / remarketing",
    thirdPartyAdTech: true,
    patterns: [
      /gtag\(\s*['"]config['"]\s*,\s*['"](AW-[0-9]+)['"]/i,
      /googleadservices\.com\/pagead\/conversion/i,
      /["'](AW-\d{6,})["']/,
    ],
  },
  {
    key: "meta-pixel",
    name: "Meta (Facebook) Pixel",
    thirdPartyAdTech: true,
    patterns: [
      /fbq\(\s*['"]init['"]\s*,\s*['"](\d{10,})['"]/i,
      /connect\.facebook\.net\/[^"']*\/fbevents\.js/i,
    ],
  },
  {
    key: "tiktok",
    name: "TikTok Pixel",
    thirdPartyAdTech: true,
    patterns: [/analytics\.tiktok\.com\/i18n\/pixel/i, /ttq\.load\(\s*['"]([A-Z0-9]+)['"]/i],
  },
  {
    key: "linkedin",
    name: "LinkedIn Insight Tag",
    thirdPartyAdTech: true,
    patterns: [/snap\.licdn\.com\/li\.lms-analytics/i, /_linkedin_partner_id\s*=\s*["'](\d+)["']/i],
  },
  {
    key: "bing",
    name: "Microsoft Advertising UET",
    thirdPartyAdTech: true,
    patterns: [/bat\.bing\.com\/bat\.js/i, /ti:\s*["']([0-9]+)["']/],
  },
  {
    key: "hotjar",
    name: "Hotjar",
    thirdPartyAdTech: false,
    patterns: [/static\.hotjar\.com/i, /hjid:\s*(\d+)/i],
  },
  {
    key: "clarity",
    name: "Microsoft Clarity",
    thirdPartyAdTech: false,
    patterns: [/clarity\.ms\/tag\/([a-z0-9]+)/i],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    thirdPartyAdTech: false,
    patterns: [/js\.hs-scripts\.com\/(\d+)\.js/i, /js\.hsforms\.net/i],
  },
  {
    key: "callrail",
    name: "CallRail",
    thirdPartyAdTech: false,
    patterns: [/cdn\.callrail\.com\/companies\/([0-9]+)/i],
  },
  {
    key: "reddit",
    name: "Reddit Pixel",
    thirdPartyAdTech: true,
    patterns: [/www\.redditstatic\.com\/ads\/pixel\.js/i],
  },
];

/** US phone numbers in the shapes a clinic site actually uses. */
const PHONE_RE = /\(?\b\d{3}\)?[\s.\u2013\u2014-]\s?\d{3}[\s.\u2013\u2014-]\d{4}\b/g;

/**
 * "1234 Some St Suite 5, City, TX 78201" and near variants.
 * Any US state abbreviation, so the tool is not pinned to one market.
 */
const STATE_ABBR =
  "AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC";
// Two details matter here. '#' belongs in the street class, or an address
// like "6222 I-10 Suite #104 San Antonio, TX 78201" never matches in full.
// And the leading lookbehind stops a match starting mid-address, which is
// what produced a spurious "104 San Antonio, TX 78201" from that same string
// once the full match failed.
const ADDRESS_RE = new RegExp(
  String.raw`(?<![#\w])\d{1,6}\s+[A-Za-z0-9.'#\- ]{2,60}?,?\s+[A-Za-z.'\- ]{2,40},?\s+(?:${STATE_ABBR})\s+\d{5}(?:-\d{4})?`,
  "g",
);

export function extractPage(res: FetchOutcome, origin: string): PageRecord {
  const base: PageRecord = {
    url: res.url,
    finalUrl: res.finalUrl,
    status: res.status,
    redirectChain: res.redirectChain,
    contentType: res.contentType,
    bytes: res.bytes,
    fetchedAt: new Date().toISOString(),
    elapsedMs: res.elapsedMs,
    h1: [],
    h2: [],
    wordCount: 0,
    jsonLd: [],
    jsonLdErrors: [],
    images: [],
    internalLinks: [],
    externalLinks: [],
    anchorIds: [],
    fragmentTargets: [],
    tags: [],
    phones: [],
    addressLines: [],
    forms: [],
    openGraph: {},
  };

  if (res.error) return { ...base, error: res.error };
  if (!res.contentType.includes("html") && !res.body.includes("<html")) return base;

  const $ = cheerio.load(res.body);
  const originHost = safeHost(origin);

  base.title = $("head > title").first().text().trim() || undefined;
  base.metaDescription = attr($, 'meta[name="description"]', "content");
  base.metaRobots = attr($, 'meta[name="robots"]', "content");
  base.canonical = attr($, 'link[rel="canonical"]', "href");
  base.lang = $("html").attr("lang")?.trim() || undefined;

  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) base.openGraph[p] = c;
  });

  $("h1").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) base.h1.push(t);
  });
  $("h2").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) base.h2.push(t);
  });

  // Body text with scripts/styles/nav chrome removed, for an honest word count.
  const $body = $("body").clone();
  $body.find("script, style, noscript, svg").remove();
  const bodyText = $body.text().replace(/\s+/g, " ").trim();
  base.wordCount = bodyText ? bodyText.split(" ").length : 0;

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text().trim();
    if (!raw) return;
    try {
      base.jsonLd.push(JSON.parse(raw));
    } catch (err) {
      base.jsonLdErrors.push(err instanceof Error ? err.message : String(err));
    }
  });

  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    // A missing alt attribute and alt="" are different: the second is a
    // deliberate decorative marker. Preserve the distinction.
    const altAttr = $(el).attr("alt");
    base.images.push({ src, alt: altAttr === undefined ? null : altAttr });
  });

  const seenIds = new Set<string>();
  $("[id]").each((_, el) => {
    const id = $(el).attr("id")?.trim();
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      base.anchorIds.push(id);
    }
  });

  const seenInternal = new Set<string>();
  const seenExternal = new Set<string>();
  const seenFragment = new Set<string>();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Record fragment targets before absolutise() strips the hash. These
    // reveal several clinics sharing one URL.
    try {
      const withHash = new URL(href, res.finalUrl);
      if (
        withHash.hash.length > 1 &&
        safeHost(withHash.toString()) === originHost &&
        (withHash.protocol === "http:" || withHash.protocol === "https:")
      ) {
        const key = `${withHash.pathname}${withHash.hash}`;
        if (!seenFragment.has(key)) {
          seenFragment.add(key);
          base.fragmentTargets.push(key);
        }
      }
    } catch {
      /* not a resolvable URL */
    }

    const abs = absolutise(href, res.finalUrl);
    if (!abs) return;
    const host = safeHost(abs);
    if (host && originHost && host === originHost) {
      if (!seenInternal.has(abs)) {
        seenInternal.add(abs);
        base.internalLinks.push(abs);
      }
    } else if (host) {
      if (!seenExternal.has(abs)) {
        seenExternal.add(abs);
        base.externalLinks.push(abs);
      }
    }
  });

  $("form").each((_, el) => {
    const fields: string[] = [];
    $(el)
      .find("input, select, textarea")
      .each((__, f) => {
        const name = $(f).attr("name") ?? $(f).attr("id");
        const type = $(f).attr("type");
        if (type === "hidden" || type === "submit" || type === "button") return;
        if (name) fields.push(name);
      });
    base.forms.push({
      action: $(el).attr("action") ?? null,
      method: ($(el).attr("method") ?? "get").toLowerCase(),
      fields,
    });
  });

  base.tags = detectTags(res.body);
  base.phones = dedupe(bodyText.match(PHONE_RE) ?? []).map((p) => p.trim());
  base.addressLines = dedupe(bodyText.match(ADDRESS_RE) ?? []).map((a) =>
    a.replace(/\s+/g, " ").trim(),
  );

  return base;
}

export function detectTags(html: string): DetectedTag[] {
  const out: DetectedTag[] = [];
  for (const sig of TAG_SIGNATURES) {
    let id: string | undefined;
    let evidence: string | undefined;
    for (const re of sig.patterns) {
      const m = re.exec(html);
      if (!m) continue;
      evidence ??= m[0].slice(0, 160);
      if (m[1] && !id) id = m[1];
    }
    if (evidence) {
      out.push({
        key: sig.key,
        name: sig.name,
        id,
        thirdPartyAdTech: sig.thirdPartyAdTech,
        evidence,
      });
    }
  }
  return out;
}

function attr(
  $: cheerio.CheerioAPI,
  selector: string,
  name: string,
): string | undefined {
  const v = $(selector).first().attr(name);
  return v?.trim() || undefined;
}

export function absolutise(href: string, base: string): string | null {
  const h = href.trim();
  if (!h || h.startsWith("#")) return null;
  if (/^(mailto:|tel:|javascript:|data:|sms:)/i.test(h)) return null;
  try {
    const u = new URL(h, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
