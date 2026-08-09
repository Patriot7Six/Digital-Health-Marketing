import type { CrawlResult, Finding, Severity, TargetConfig } from "../types.js";

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export interface ReportInput {
  config: TargetConfig;
  crawl: CrawlResult;
  findings: Finding[];
  aeoRan: boolean;
}

export function renderMarkdown(input: ReportInput): string {
  const { config, crawl, findings } = input;
  const counts = countBy(findings);
  const ok = crawl.pages.filter((p) => p.status === 200 && !p.error);
  const lines: string[] = [];

  lines.push(`# Digital acquisition audit: ${config.name}`);
  lines.push("");
  lines.push(
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC from publicly available data only. No account access, no analytics, no ad platform data.`,
  );
  lines.push("");

  lines.push("## Scope");
  lines.push("");
  lines.push(`| | |`);
  lines.push(`|---|---|`);
  lines.push(`| Origin | ${crawl.origin} |`);
  lines.push(`| Pages crawled | ${crawl.pages.length} (${ok.length} returned 200) |`);
  lines.push(`| URLs in sitemap | ${crawl.sitemapUrls.length} |`);
  lines.push(`| robots.txt | ${crawl.robotsTxt ? "present" : "not found"} |`);
  lines.push(`| Skipped by robots.txt | ${crawl.skipped.filter((s) => s.reason.includes("robots")).length} |`);
  lines.push(`| Answer-engine module | ${input.aeoRan ? "run" : "not run"} |`);
  lines.push("");

  lines.push("## Findings by severity");
  lines.push("");
  lines.push("| Severity | Count |");
  lines.push("|---|---|");
  for (const s of ORDER) lines.push(`| ${s} | ${counts[s] ?? 0} |`);
  lines.push("");

  const actionable = findings.filter((f) => f.severity !== "info");
  if (actionable.length > 0) {
    lines.push("## What to fix first");
    lines.push("");
    const top = [...actionable]
      .sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
      .slice(0, 5);
    top.forEach((f, i) => {
      lines.push(`${i + 1}. **${f.title}** (${f.severity}) - ${f.recommendation}`);
    });
    lines.push("");
  }

  for (const severity of ORDER) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;

    lines.push(`## ${severity.toUpperCase()}`);
    lines.push("");

    for (const f of group) {
      lines.push(`### ${f.title}`);
      lines.push("");
      lines.push(`\`${f.module}\` · confidence: ${f.confidence}`);
      lines.push("");
      lines.push(f.detail);
      lines.push("");

      if (f.evidence.length > 0) {
        lines.push("Evidence:");
        lines.push("");
        lines.push("```");
        for (const e of f.evidence.slice(0, 10)) lines.push(e);
        if (f.evidence.length > 10) lines.push(`... ${f.evidence.length - 10} more`);
        lines.push("```");
        lines.push("");
      }

      if (f.urls.length > 0) {
        lines.push(`Affected URLs (${f.urls.length}):`);
        lines.push("");
        for (const u of f.urls.slice(0, 10)) lines.push(`- ${u}`);
        if (f.urls.length > 10) lines.push(`- ... ${f.urls.length - 10} more`);
        lines.push("");
      }

      lines.push(`**Recommendation.** ${f.recommendation}`);
      lines.push("");
      if (f.capability) {
        lines.push(`*Maps to: ${f.capability}*`);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }
  }

  lines.push("## What this audit cannot see");
  lines.push("");
  lines.push(
    "Everything above was collected from the public web. The following require account access and are unknown until then:",
  );
  lines.push("");
  for (const item of [
    "Actual traffic, sessions, and conversion rates (GA4)",
    "Query-level impressions, clicks, and position (Search Console)",
    "Ad spend, CPC, CPA, and conversion volume by campaign (Google Ads, Meta)",
    "Which tags fire client-side through the tag manager container",
    "Google Business Profile insights, review volume, and listing accuracy against the real record",
    "CRM and intake outcomes: which leads became scheduled assessments and which became patients",
    "Call volume and call quality by clinic",
  ]) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push(
    "Nothing in this report infers any of those. Where a finding depends on data not observable from outside, its confidence is marked moderate or low.",
  );
  lines.push("");

  return lines.join("\n");
}

function countBy(findings: Finding[]): Partial<Record<Severity, number>> {
  const out: Partial<Record<Severity, number>> = {};
  for (const f of findings) out[f.severity] = (out[f.severity] ?? 0) + 1;
  return out;
}
