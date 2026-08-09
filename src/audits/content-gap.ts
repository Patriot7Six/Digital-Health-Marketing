import type { CrawlResult, Finding, QuerySet } from "../types.js";
import { plural } from "../util.js";

const CAP = "Content direction to drive qualified traffic; AEO readiness";

/** Words that carry no topical signal when matching a query to a page. */
const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "is", "are",
  "do", "does", "did", "what", "how", "when", "where", "why", "who", "can", "i",
  "my", "me", "you", "your", "we", "it", "its", "with", "near", "get", "be", "have",
  "has", "if", "there", "their", "much", "many", "long", "will", "would", "should",
]);

export interface ContentGap {
  queryId: string;
  query: string;
  stage: string;
  bestUrl?: string;
  score: number;
}

/**
 * Scores each query against the crawled corpus using term overlap against
 * title, headings, and body length. This is a coverage check, not a ranking
 * prediction: it answers "is there a page that even tries to answer this",
 * which is the question that matters before an AEO push.
 */
export function auditContentGap(
  crawl: CrawlResult,
  querySet: QuerySet,
  threshold = 0.34,
): { findings: Finding[]; gaps: ContentGap[]; covered: ContentGap[] } {
  const pages = crawl.pages.filter(
    (p) => p.status === 200 && !p.error && p.wordCount > 80,
  );

  const indexed = pages.map((p) => ({
    url: p.finalUrl,
    terms: new Set(
      tokenize(
        [p.title ?? "", p.h1.join(" "), p.h2.join(" "), p.metaDescription ?? ""].join(" "),
      ),
    ),
  }));

  const results: ContentGap[] = [];

  for (const q of querySet.queries) {
    const qTerms = tokenize(q.query);
    if (qTerms.length === 0) {
      results.push({ queryId: q.id, query: q.query, stage: q.stage, score: 0 });
      continue;
    }

    let bestUrl: string | undefined;
    let bestScore = 0;
    for (const page of indexed) {
      let hits = 0;
      for (const t of qTerms) if (page.terms.has(t)) hits++;
      const score = hits / qTerms.length;
      if (score > bestScore) {
        bestScore = score;
        bestUrl = page.url;
      }
    }
    results.push({
      queryId: q.id,
      query: q.query,
      stage: q.stage,
      bestUrl: bestScore >= threshold ? bestUrl : undefined,
      score: Number(bestScore.toFixed(2)),
    });
  }

  const gaps = results.filter((r) => r.score < threshold);
  const covered = results.filter((r) => r.score >= threshold);

  const findings: Finding[] = [];

  if (gaps.length > 0) {
    const byStage = new Map<string, number>();
    for (const g of gaps) byStage.set(g.stage, (byStage.get(g.stage) ?? 0) + 1);

    findings.push({
      id: "content-gap-uncovered",
      module: "content-gap",
      severity: gaps.length > querySet.queries.length / 2 ? "high" : "medium",
      title: `${gaps.length} of ${querySet.queries.length} family-intent questions have no page that addresses them`,
      detail:
        `By funnel stage: ${[...byStage.entries()].map(([s, n]) => `${s} ${n}`).join(", ")}. ` +
        "These are questions a parent types before they know which provider to call. A page that answers the question is what an answer engine quotes and what an informational search result ranks.",
      evidence: gaps.slice(0, 10).map((g) => g.query),
      urls: [],
      recommendation:
        "Publish one page per uncovered question, written to be quoted: the answer in the first 60 words, then the detail. Prioritise decision-stage and local-stage gaps first, since those sit closest to an intake call.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  if (covered.length > 0) {
    findings.push({
      id: "content-gap-covered",
      module: "content-gap",
      severity: "info",
      title: `${plural(covered.length, "question")} with a plausible matching page`,
      detail:
        "Term-overlap match against titles and headings only. It confirms a page exists on the topic; it does not confirm the page ranks or that the answer is good.",
      evidence: covered.slice(0, 8).map((c) => `${c.query} -> ${c.bestUrl} (${c.score})`),
      urls: covered.map((c) => c.bestUrl).filter((u): u is string => Boolean(u)),
      recommendation:
        "Check these against real ranking data in Search Console once inside, and rewrite any that rank but do not convert.",
      capability: CAP,
      confidence: "low",
    });
  }

  return { findings, gaps, covered };
}

function tokenize(s: string): string[] {
  return [
    ...new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map((t) => t.replace(/^-+|-+$/g, ""))
        .filter((t) => t.length > 2 && !STOP.has(t)),
    ),
  ];
}
