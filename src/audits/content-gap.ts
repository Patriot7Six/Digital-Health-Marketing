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
 * Scores each query against the crawled corpus.
 *
  * Scoring runs on the query terms that are distinctive in the corpus, because
 * not work on a site with a narrow vocabulary. On a Texas ABA provider's site
 * the words "aba", "therapy", "autism", and "texas" appear in nearly every
 * title, so an unweighted match reports almost total coverage regardless of
 * what the pages actually answer. IDF pushes the score onto the distinctive
 * terms in each question, which is what coverage means.
 *
 * This is still a coverage check, not a ranking prediction: it answers "is
 * there a page that even tries to answer this".
 */
export function auditContentGap(
  crawl: CrawlResult,
  querySet: QuerySet,
  threshold = 0.4,
): { findings: Finding[]; gaps: ContentGap[]; covered: ContentGap[] } {
  const pages = crawl.pages.filter(
    (p) => p.status === 200 && !p.error && p.wordCount > 80,
  );

  const indexed = pages.map((p) => ({
    url: p.finalUrl,
    // Title and H1 identify what a page is about; H2 and description support it.
    strong: new Set(tokenize([p.title ?? "", p.h1.join(" ")].join(" "))),
    weak: new Set(tokenize([p.h2.join(" "), p.metaDescription ?? ""].join(" "))),
  }));

  // Document frequency across the corpus.
  const df = new Map<string, number>();
  for (const page of indexed) {
    for (const t of new Set([...page.strong, ...page.weak])) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  const N = Math.max(indexed.length, 1);

  /**
   * A term is distinctive when the corpus contains it but does not contain it
   * everywhere. Terms absent from the corpus entirely cannot discriminate
   * between pages, and terms on every page ("aba", "therapy", "texas" on an
   * ABA provider's site) carry no information about which page answers what.
   * Scoring on the remainder is what makes coverage mean something.
   */
  const ubiquityCeiling = Math.max(1, N / 2);
  const isDistinctive = (t: string): boolean => {
    const n = df.get(t) ?? 0;
    return n >= 1 && n <= ubiquityCeiling;
  };
  /**
   * Smoothed IDF with a floor. The floor only binds on corpora too small for
   * document frequency to mean anything (a one-page crawl gives every term an
   * IDF of zero), where it keeps a distinctive term countable instead of
   * collapsing the whole query to zero weight.
   */
  const idf = (t: string): number =>
    Math.max(Math.log((N + 1) / ((df.get(t) ?? 0) + 1)), 0.01);

  const results: ContentGap[] = [];

  for (const q of querySet.queries) {
    const qTerms = tokenize(q.query).filter(isDistinctive);
    const totalWeight = qTerms.reduce((sum, t) => sum + idf(t), 0);

    // No distinctive vocabulary means the corpus has nothing specific on this
    // question, however many generic words it shares with every page.
    if (qTerms.length === 0 || totalWeight <= 0) {
      results.push({ queryId: q.id, query: q.query, stage: q.stage, score: 0 });
      continue;
    }

    let bestUrl: string | undefined;
    let bestScore = 0;
    for (const page of indexed) {
      let hit = 0;
      for (const t of qTerms) {
        if (page.strong.has(t)) hit += idf(t);
        else if (page.weak.has(t)) hit += idf(t) * 0.5;
      }
      const score = hit / totalWeight;
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
        "IDF-weighted match against titles, headings, and meta descriptions. It confirms a page exists on the topic; it does not confirm the page ranks, or that the answer on it is any good.",
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
