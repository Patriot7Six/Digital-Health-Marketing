import type { CrawlResult, Finding, PageRecord } from "../types.js";
import { plural } from "../util.js";

const CAP =
  "Lead digital analytics and performance reporting, maintaining full-funnel conversion tracking";
const CAP_HIPAA = "HIPAA marketing awareness and what is permitted in healthcare advertising";

/**
 * Field names that suggest a form is collecting information about an
 * identifiable person's health or care needs. When advertising pixels fire
 * on a page carrying one of these, that combination is worth a human review
 * with counsel. See docs/02-hipaa-marketing.md for the regulatory position,
 * including the parts of the OCR bulletin vacated in AHA v. Becerra.
 */
const SENSITIVE_FIELD_HINTS = [
  "diagnos",
  "condition",
  "symptom",
  "insurance",
  "member_id",
  "memberid",
  "policy",
  "dob",
  "birth",
  "patient",
  "child",
  "referral",
  "provider",
  "medicaid",
  "medicare",
  "therapy",
  "treatment",
];

export function auditTags(crawl: CrawlResult): Finding[] {
  const out: Finding[] = [];
  const ok = crawl.pages.filter((p) => p.status === 200 && !p.error);
  if (ok.length === 0) return out;

  // --- inventory ------------------------------------------------------------
  const inventory = new Map<string, { name: string; ids: Set<string>; pages: Set<string>; adTech: boolean }>();
  for (const p of ok) {
    for (const t of p.tags) {
      const entry =
        inventory.get(t.key) ??
        { name: t.name, ids: new Set<string>(), pages: new Set<string>(), adTech: t.thirdPartyAdTech };
      if (t.id) entry.ids.add(t.id);
      entry.pages.add(p.finalUrl);
      inventory.set(t.key, entry);
    }
  }

  if (inventory.size === 0) {
    out.push({
      id: "tag-none-detected",
      module: "tags",
      severity: "info",
      title: "No analytics or advertising tags found in server-rendered markup",
      detail:
        "This does not prove none are running. Tags injected client-side by a tag manager, or through a server-side container, are invisible to a static fetch.",
      evidence: [],
      urls: [],
      recommendation:
        "Verify with a live tag inspection in the browser and, once inside, against the tag manager container itself.",
      capability: CAP,
      confidence: "low",
    });
  } else {
    out.push({
      id: "tag-inventory",
      module: "tags",
      severity: "info",
      title: `${plural(inventory.size, "tracking platform")} detected in markup`,
      detail: [...inventory.entries()]
        .map(([key, v]) => {
          const ids = v.ids.size ? ` (${[...v.ids].join(", ")})` : "";
          return `${v.name}${ids} on ${v.pages.size}/${ok.length} pages [${key}]`;
        })
        .join("; "),
      evidence: [...inventory.values()].flatMap((v) => [...v.ids]),
      urls: [],
      recommendation:
        "Reconcile this list against the tag manager container. Anything in the container but not firing, or firing but not in the container, is drift worth closing.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- coverage gaps --------------------------------------------------------
  for (const [key, v] of inventory) {
    const coverage = v.pages.size / ok.length;
    if (coverage >= 0.9 || v.pages.size < 2) continue;
    const missing = ok.filter((p) => !v.pages.has(p.finalUrl)).map((p) => p.finalUrl);
    out.push({
      id: `tag-coverage-${key}`,
      module: "tags",
      severity: coverage < 0.5 ? "high" : "medium",
      title: `${v.name} is present on only ${Math.round(coverage * 100)}% of crawled pages`,
      detail:
        "Inconsistent tag deployment produces attribution gaps: sessions that cross an untagged page lose channel attribution and any conversion after it is misattributed or lost.",
      evidence: [],
      urls: missing,
      recommendation:
        "Deploy the tag through a single site-wide container in the theme header rather than per-template, then verify coverage.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- GA4 present without a manager, or vice versa -------------------------
  const hasGtm = inventory.has("gtm");
  const hasGa4 = inventory.has("ga4");
  if (hasGtm && !hasGa4) {
    out.push({
      id: "tag-gtm-no-ga4",
      module: "tags",
      severity: "info",
      title: "Google Tag Manager found, GA4 measurement ID not visible in markup",
      detail:
        "This is the expected pattern when GA4 is configured inside the container rather than hard-coded. It cannot be confirmed from outside.",
      evidence: [...(inventory.get("gtm")?.ids ?? [])],
      urls: [],
      recommendation: "Confirm the GA4 configuration tag and its measurement ID inside the container.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // --- conversion surfaces --------------------------------------------------
  const formPages = ok.filter((p) => p.forms.some((f) => f.fields.length >= 2));
  if (formPages.length > 0) {
    out.push({
      id: "tag-conversion-surfaces",
      module: "tags",
      severity: "info",
      title: `${plural(formPages.length, "page")} carrying a lead form`,
      detail:
        "These are the conversion surfaces the funnel model depends on. Each needs a distinct, deduplicated conversion event with a stable name across GA4, Google Ads, and Meta.",
      evidence: formPages
        .slice(0, 6)
        .map((p) => `${p.finalUrl} - fields: ${firstForm(p)?.fields.slice(0, 8).join(", ") ?? "n/a"}`),
      urls: formPages.map((p) => p.finalUrl),
      recommendation:
        "Define the event taxonomy in docs/05-measurement-model.md before adding tags, so paid and organic report against one definition of a lead.",
      capability: CAP,
      confidence: "high",
    });
  }

  // --- the HIPAA-relevant intersection -------------------------------------
  const adTechKeys = [...inventory.entries()].filter(([, v]) => v.adTech).map(([k]) => k);
  if (adTechKeys.length > 0) {
    const flagged: string[] = [];
    const evidence: string[] = [];

    for (const p of ok) {
      const pixels = p.tags.filter((t) => t.thirdPartyAdTech);
      if (pixels.length === 0) continue;
      const sensitive = sensitiveFieldsOn(p);
      if (sensitive.length === 0) continue;
      flagged.push(p.finalUrl);
      if (evidence.length < 6) {
        evidence.push(
          `${p.finalUrl} - ${pixels.map((t) => t.name).join(", ")} + fields: ${sensitive.join(", ")}`,
        );
      }
    }

    if (flagged.length > 0) {
      out.push({
        id: "tag-adtech-on-intake",
        module: "tags",
        severity: "critical",
        title: `Advertising pixels present on ${plural(flagged.length, "page")} that collect intake information`,
        detail:
          "Third-party advertising pixels fire on pages whose forms request insurance, diagnosis, referral, or patient identity details. Where a form submission carrying that information reaches an ad platform, it is a disclosure of protected health information to a vendor that is not acting as a business associate. Note the scope: in AHA v. Becerra (N.D. Tex., June 20 2024) the court vacated the portion of OCR's tracking bulletin treating an IP address plus a visit to an unauthenticated health page as PHI, and OCR withdrew its appeal on August 29 2024. That vacatur covers passive page-view metadata. It does not reach information a person types into a form about themselves or their child.",
        evidence,
        urls: flagged,
        recommendation:
          "Review with counsel and privacy before changing anything. The usual remediation is to move conversion measurement server-side, strip form-field payloads from client-side pixel events, send only a non-identifying conversion signal, and execute BAAs where a vendor genuinely needs regulated data.",
        capability: CAP_HIPAA,
        confidence: "moderate",
      });
    } else {
      out.push({
        id: "tag-adtech-inventory",
        module: "tags",
        severity: "medium",
        title: `${plural(adTechKeys.length, "third-party advertising platform")} tracking site visitors`,
        detail:
          `Detected: ${adTechKeys.map((k) => inventory.get(k)!.name).join(", ")}. No intake form was found on the same pages in this crawl, which is the good case. The exposure to check next is what these pixels receive after a form is submitted, which is not observable from outside.`,
        evidence: [],
        urls: [],
        recommendation:
          "Audit the post-submission event payloads and confirm no form values, URL parameters, or referrer strings carrying health context reach an ad platform.",
        capability: CAP_HIPAA,
        confidence: "moderate",
      });
    }
  }

  // --- form action leaving the origin --------------------------------------
  const offsite: string[] = [];
  for (const p of ok) {
    for (const f of p.forms) {
      if (!f.action) continue;
      try {
        const target = new URL(f.action, p.finalUrl);
        if (target.origin !== crawl.origin && f.fields.length > 0) offsite.push(`${p.finalUrl} -> ${target.origin}`);
      } catch {
        /* ignore unparseable action */
      }
    }
  }
  if (offsite.length > 0) {
    out.push({
      id: "tag-form-offsite",
      module: "tags",
      severity: "high",
      title: `${plural(offsite.length, "form")} posting to a third-party origin`,
      detail:
        "Form submissions leaving the origin land with a vendor. If any field carries health or identity information, that vendor needs a business associate agreement in place.",
      evidence: offsite.slice(0, 8),
      urls: [],
      recommendation: "Inventory each destination and confirm a signed BAA covers it.",
      capability: CAP_HIPAA,
      confidence: "moderate",
    });
  }

  return out;
}

function firstForm(p: PageRecord) {
  return p.forms.find((f) => f.fields.length >= 2);
}

function sensitiveFieldsOn(p: PageRecord): string[] {
  const hits = new Set<string>();
  for (const f of p.forms) {
    for (const field of f.fields) {
      const lower = field.toLowerCase();
      if (SENSITIVE_FIELD_HINTS.some((h) => lower.includes(h))) hits.add(field);
    }
  }
  return [...hits];
}
