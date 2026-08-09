import type { CrawlResult, Finding, PageRecord, TargetConfig } from "../types.js";
import { plural } from "../util.js";

const CAP =
  "Manage local listing accuracy across all clinic locations, treating Google Business Profile and other directories as lead generation assets";

export interface LocationRecord {
  url: string;
  title?: string;
  /** Anchor IDs on the page, each of which usually marks a distinct clinic. */
  anchors: string[];
  /**
   * How `anchors` was derived. Anchor evidence is reliable; the address
   * fallback demonstrably is not, since a footer address or a suite number
   * can be parsed as a second clinic. The two are reported separately.
   */
  detection: "anchor" | "address" | "none";
  phones: string[];
  addresses: string[];
  hasLocalBusinessSchema: boolean;
  wordCount: number;
}

export function collectLocations(
  crawl: CrawlResult,
  config: TargetConfig,
): LocationRecord[] {
  const prefixes = config.locationPathPrefixes;

  // Fragments are declared on the pages that link to a location (the nav),
  // so build a site-wide pathname -> fragments index first.
  const fragmentsByPath = new Map<string, Set<string>>();
  for (const p of crawl.pages) {
    for (const target of p.fragmentTargets) {
      const hashAt = target.indexOf("#");
      if (hashAt <= 0) continue;
      const path = normalisePath(target.slice(0, hashAt));
      const frag = target.slice(hashAt + 1);
      if (!frag) continue;
      const set = fragmentsByPath.get(path) ?? new Set<string>();
      set.add(frag);
      fragmentsByPath.set(path, set);
    }
  }

  const out: LocationRecord[] = [];
  // Several crawled URLs can redirect to one page. Keyed on the final URL so
  // a single clinic page is not counted once per alias.
  const seen = new Set<string>();

  for (const p of crawl.pages) {
    if (p.status !== 200 || p.error) continue;

    let path: string;
    try {
      path = new URL(p.finalUrl).pathname;
    } catch {
      continue;
    }
    if (!prefixes.some((pre) => path.startsWith(pre))) continue;

    const key = normalisePath(path);
    if (seen.has(key)) continue;
    seen.add(key);

    const { anchors, detection } = clinicAnchors(p, fragmentsByPath);
    out.push({
      url: p.finalUrl,
      title: p.title,
      anchors,
      detection,
      phones: p.phones,
      addresses: p.addressLines,
      hasLocalBusinessSchema: hasLocalSchema(p),
      wordCount: p.wordCount,
    });
  }

  return out;
}

export function auditLocal(
  crawl: CrawlResult,
  config: TargetConfig,
  locations: LocationRecord[],
): Finding[] {
  const out: Finding[] = [];

  if (locations.length === 0) {
    out.push({
      id: "local-no-pages",
      module: "local",
      severity: "info",
      title: "No location pages matched the configured path prefixes",
      detail: `Looked for pages under: ${config.locationPathPrefixes.join(", ")}`,
      evidence: [],
      urls: [],
      recommendation: "Adjust locationPathPrefixes in the target config.",
      capability: CAP,
      confidence: "high",
    });
    return out;
  }

  // --- multiple clinics stacked on one URL ---------------------------------
  // This is the single most expensive local-SEO pattern for a multi-site
  // provider: Google wants one landing page per Business Profile.
  //
  // Only anchor evidence counts here. Address-derived counts go into a
  // separate, lower-confidence finding below, because a footer address or a
  // suite number parses as a second clinic often enough to be untrustworthy.
  const stacked = locations.filter(
    (l) => l.detection === "anchor" && l.anchors.length > 1,
  );
  if (stacked.length > 0) {
    const extraClinics = stacked.reduce((n, l) => n + l.anchors.length - 1, 0);
    out.push({
      id: "local-stacked-clinics",
      module: "local",
      severity: "critical",
      title: `${plural(stacked.length, "URL")} hosting more than one clinic, leaving roughly ${plural(extraClinics, "clinic")} with no page of their own`,
      detail:
        "Each clinic appears as an anchor fragment on a shared page. A Google Business Profile landing page must be a distinct URL: a fragment does not qualify, so every clinic after the first on a shared page has no page to point its profile at, cannot rank for its own neighbourhood query, and cannot be measured separately in analytics or paid landing-page reporting.",
      evidence: stacked
        .slice(0, 8)
        .map((l) => `${l.url} - ${l.anchors.length} clinics: ${l.anchors.join(", ")}`),
      urls: stacked.map((l) => l.url),
      recommendation:
        "Split each clinic onto its own indexable URL with unique title, address, phone, hours, staff, and LocalBusiness schema. Then repoint the matching Business Profile to it. Do the highest-volume markets first.",
      capability: CAP,
      confidence: "high",
    });
  }

  // Pages with several parsed addresses but no clinic anchors. Flagged for a
  // human to check rather than counted, because address parsing picks up
  // corporate footers and suite numbers.
  const addressOnly = locations.filter(
    (l) => l.detection === "address" && l.anchors.length > 1,
  );
  if (addressOnly.length > 0) {
    out.push({
      id: "local-possible-stacked-clinics",
      module: "local",
      severity: "medium",
      title: `${plural(addressOnly.length, "location page")} may host more than one clinic, needs a manual check`,
      detail:
        "These pages carry several parseable street addresses but no clinic anchor to confirm the structure. Address parsing also matches corporate footers and suite numbers, so the count below is a prompt to look, not a measurement.",
      evidence: addressOnly
        .slice(0, 8)
        .map((l) => `${l.url} - addresses parsed: ${l.anchors.join(" | ")}`),
      urls: addressOnly.map((l) => l.url),
      recommendation:
        "Open each page and confirm how many clinics it serves. If more than one, it belongs with the critical finding above.",
      capability: CAP,
      confidence: "low",
    });
  }

  // --- URL slug inconsistency ----------------------------------------------
  // e.g. /location/kyle/ and /location/kyle-tx/ both existing or both linked.
  const slugMap = new Map<string, string[]>();
  for (const l of locations) {
    const slug = pathSlug(l.url);
    if (!slug) continue;
    const stem = slug.replace(/-tx$/, "");
    const list = slugMap.get(stem) ?? [];
    list.push(l.url);
    slugMap.set(stem, list);
  }
  const inconsistent = [...slugMap.entries()].filter(([, urls]) => urls.length > 1);
  if (inconsistent.length > 0) {
    out.push({
      id: "local-slug-variants",
      module: "local",
      severity: "high",
      title: `${plural(inconsistent.length, "market")} resolving to more than one location URL`,
      detail:
        "Two live URLs for one clinic split link equity and rankings between them, and whichever one a Business Profile points at, the other keeps collecting traffic that is not measured against it.",
      evidence: inconsistent.slice(0, 6).map(([stem, urls]) => `${stem}: ${urls.join(" | ")}`),
      urls: inconsistent.flatMap(([, urls]) => urls),
      recommendation:
        "Pick one canonical slug pattern, 301 the variants to it, and update every internal link including the header and footer menus.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- NAP presence ---------------------------------------------------------
  const noPhone = locations.filter((l) => l.phones.length === 0);
  if (noPhone.length > 0) {
    out.push({
      id: "local-no-phone",
      module: "local",
      severity: "high",
      title: `${plural(noPhone.length, "location page")} without a phone number in body text`,
      detail:
        "For a parent on a phone at 9pm, the call is the conversion. A number rendered only inside an image or an icon component is invisible to both the visitor scanning the page and to citation-consistency checks.",
      evidence: [],
      urls: noPhone.map((l) => l.url),
      recommendation:
        "Render a clinic-specific tel: link in text on every location page and use that same number in the matching Business Profile.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  const noAddress = locations.filter((l) => l.addresses.length === 0);
  if (noAddress.length > 0) {
    out.push({
      id: "local-no-address",
      module: "local",
      severity: "high",
      title: `${plural(noAddress.length, "location page")} without a parseable street address`,
      detail:
        "Name, address, and phone consistency between the site and each directory listing is the base signal for local pack ranking. An address that is not in crawlable text cannot be matched.",
      evidence: [],
      urls: noAddress.map((l) => l.url),
      recommendation:
        "Render the full street address as text and mirror it exactly, character for character, in Google Business Profile, Apple Business Connect, and Bing Places.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- shared phone numbers across markets ---------------------------------
  const phoneToPages = new Map<string, string[]>();
  for (const l of locations) {
    for (const raw of l.phones) {
      const digits = raw.replace(/\D/g, "");
      if (digits.length !== 10) continue;
      const list = phoneToPages.get(digits) ?? [];
      list.push(l.url);
      phoneToPages.set(digits, list);
    }
  }
  const shared = [...phoneToPages.entries()].filter(([, urls]) => urls.length >= 3);
  if (shared.length > 0) {
    out.push({
      id: "local-shared-phone",
      module: "local",
      severity: "medium",
      title: `${plural(shared.length, "phone number")} appearing across three or more location pages`,
      detail:
        "A single central intake number is a reasonable operational choice, but it removes per-clinic call attribution and weakens the NAP signal for each individual profile.",
      evidence: shared.slice(0, 5).map(([d, urls]) => `${formatPhone(d)} on ${urls.length} pages`),
      urls: shared.flatMap(([, urls]) => urls).slice(0, 30),
      recommendation:
        "Keep central intake, but add per-clinic tracking numbers with call-tracking that preserves the real number in the Business Profile, so calls can be attributed to clinic and channel without breaking NAP.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- schema ---------------------------------------------------------------
  const noSchema = locations.filter((l) => !l.hasLocalBusinessSchema);
  if (noSchema.length > 0) {
    out.push({
      id: "local-no-schema",
      module: "local",
      severity: "high",
      title: `${noSchema.length} of ${locations.length} location pages carry no LocalBusiness or MedicalBusiness schema`,
      detail:
        "Structured data is how a page states its address, hours, geo coordinates, and accepted insurance in a form that search engines and answer engines read without inference. Its absence is one of the largest gaps between a site that ranks locally and one that does not.",
      evidence: [],
      urls: noSchema.map((l) => l.url),
      recommendation:
        "Add MedicalBusiness (or MedicalClinic) JSON-LD per clinic with name, address, geo, telephone, openingHoursSpecification, areaServed, and medicalSpecialty. Template it from the CMS so it stays correct as clinics open.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- thin location pages --------------------------------------------------
  const thin = locations.filter((l) => l.wordCount > 0 && l.wordCount < 350);
  if (thin.length > 0) {
    out.push({
      id: "local-thin",
      module: "local",
      severity: "medium",
      title: `${plural(thin.length, "location page")} under 350 words`,
      detail:
        "Near-identical thin location pages compete with each other and give the local algorithm little to distinguish one market from the next.",
      evidence: thin.slice(0, 6).map((l) => `${l.url} - ${l.wordCount} words`),
      urls: thin.map((l) => l.url),
      recommendation:
        "Add genuinely local content per clinic: the staff, the building, nearby districts and referring pediatric practices, parking, and the insurance plans that actually pay in that market.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  return out;
}

/**
 * Anchor ids that name a clinic. The positive tokens are broad, so a denylist
 * of interface vocabulary carries the weight: a site-wide widget with an id
 * like "get_my_location_menu" matches "location" and would otherwise be
 * counted as a clinic on every page it appears.
 */
const CLINIC_TOKENS = /(clinic|center|centre|campus)/i;
const UI_NOISE =
  /(menu|nav|navigation|button|btn|search|filter|modal|popup|dropdown|toggle|tab|header|footer|sidebar|widget|slider|carousel|overlay|drawer|accordion|form)/i;

function looksLikeClinicAnchor(id: string): boolean {
  return CLINIC_TOKENS.test(id) && !UI_NOISE.test(id);
}

/**
 * Counts how many distinct clinics a single URL is carrying.
 *
 * Two independent signals, unioned:
 *  1. fragments other pages (usually the nav) link to on this pathname
 *  2. `id` attributes on this page that name a clinic
 *
 * Falls back to distinct street addresses found in body text, which catches
 * pages that stack clinics without any anchor at all.
 */
function clinicAnchors(
  p: PageRecord,
  fragmentsByPath: Map<string, Set<string>>,
): { anchors: string[]; detection: "anchor" | "address" | "none" } {
  const found = new Set<string>();

  let path = "";
  try {
    path = normalisePath(new URL(p.finalUrl).pathname);
  } catch {
    /* keep empty */
  }

  for (const frag of fragmentsByPath.get(path) ?? []) {
    if (looksLikeClinicAnchor(frag)) found.add(frag);
  }
  for (const id of p.anchorIds) {
    if (looksLikeClinicAnchor(id)) found.add(id);
  }

  if (found.size > 0) return { anchors: [...found], detection: "anchor" };

  // No anchors: fall back to distinct addresses. Weak evidence, reported
  // separately and never inside the critical finding.
  const addresses = [...new Set(p.addressLines)];
  return {
    anchors: addresses,
    detection: addresses.length > 0 ? "address" : "none",
  };
}

function normalisePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function hasLocalSchema(p: PageRecord): boolean {
  const wanted = /(LocalBusiness|MedicalBusiness|MedicalClinic|Physician|MedicalOrganization|Dentist|HealthAndBeautyBusiness)/i;
  const walk = (node: unknown): boolean => {
    if (node === null || node === undefined) return false;
    if (Array.isArray(node)) return node.some(walk);
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const t = obj["@type"];
      if (typeof t === "string" && wanted.test(t)) return true;
      if (Array.isArray(t) && t.some((x) => typeof x === "string" && wanted.test(x))) return true;
      return Object.values(obj).some(walk);
    }
    return false;
  };
  return p.jsonLd.some(walk);
}

function pathSlug(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function formatPhone(digits: string): string {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
