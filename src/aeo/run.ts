import Anthropic from "@anthropic-ai/sdk";
import type { AeoResult, Finding, QuerySet, TargetConfig } from "../types.js";
import { plural } from "../util.js";

const CAP =
  "Lead AI search and answer engine optimization (AEO) strategy, improving visibility across AI-powered tools";

const MODEL = "claude-sonnet-4-6";

export interface AeoOptions {
  /** Ask the model to search the live web before answering. */
  useWebSearch?: boolean;
  /** How many queries to run. Each is one API call. */
  limit?: number;
  onProgress?: (done: number, total: number, query: string) => void;
}

/**
 * Measures share of answer: for a set of real family-intent questions, how
 * often does the brand appear in a generated answer, how prominently, and
 * who appears instead.
 *
 * This is a sampled proxy, not a rank tracker. Generative answers are
 * non-deterministic and vary by model, by user context, and over time.
 * Read the trend across runs, not any single result. See
 * docs/03-aeo-methodology.md.
 */
export async function runAeo(
  config: TargetConfig,
  querySet: QuerySet,
  opts: AeoOptions = {},
): Promise<AeoResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. The aeo module needs it; every other module runs without credentials.",
    );
  }

  const client = new Anthropic({ apiKey });
  const queries = opts.limit ? querySet.queries.slice(0, opts.limit) : querySet.queries;
  const aliases = dedupeLower([config.name, ...config.brandAliases]);
  const brandHost = safeHost(config.origin);
  const results: AeoResult[] = [];

  for (const [i, q] of queries.entries()) {
    opts.onProgress?.(i + 1, queries.length, q.query);

    const base: AeoResult = {
      queryId: q.id,
      query: q.query,
      stage: q.stage,
      market: q.market,
      answer: "",
      brandMentioned: false,
      brandProminent: false,
      competitorsMentioned: [],
      citations: [],
      brandCited: false,
    };

    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 1000,
        messages: [{ role: "user", content: q.query }],
        ...(opts.useWebSearch
          ? { tools: [{ type: "web_search_20250305", name: "web_search" } as never] }
          : {}),
      });

      const answer = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

      const citations = extractCitations(res.content);
      const lower = answer.toLowerCase();
      // "Prominent" means named in the opening third, where a reader stops.
      const head = lower.slice(0, Math.max(240, Math.floor(lower.length / 3)));

      results.push({
        ...base,
        answer,
        brandMentioned: aliases.some((a) => lower.includes(a)),
        brandProminent: aliases.some((a) => head.includes(a)),
        competitorsMentioned: config.competitors.filter((c) =>
          lower.includes(c.toLowerCase()),
        ),
        citations,
        brandCited: Boolean(
          brandHost && citations.some((c) => safeHost(c) === brandHost),
        ),
      });
    } catch (err) {
      results.push({
        ...base,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Pull cited URLs out of the response.
 *
 * Structured citations are authoritative: they mean the model actually
 * retrieved the page. URLs the model merely typed into prose are weaker
 * evidence and often hallucinated, so they are used only as a fallback when
 * no structured citation exists. Mixing the two inflates the source
 * landscape and makes the report say more than the data supports.
 */
function extractCitations(content: Anthropic.ContentBlock[]): string[] {
  const structured = new Set<string>();
  const inProse = new Set<string>();

  for (const block of content) {
    if (block.type === "text") {
      const cits = (block as { citations?: unknown }).citations;
      if (Array.isArray(cits)) {
        for (const c of cits) {
          const url = (c as { url?: unknown }).url;
          if (typeof url === "string") structured.add(url);
        }
      }
      for (const m of block.text.matchAll(/https?:\/\/[^\s)\]"'<>]+/g)) {
        inProse.add(m[0].replace(/[.,;]+$/, ""));
      }
      continue;
    }

    // Web search results arrive as their own block type; read defensively
    // because the shape is versioned by the tool, not by us.
    const anyBlock = block as unknown as { content?: unknown };
    if (Array.isArray(anyBlock.content)) {
      for (const item of anyBlock.content) {
        const url = (item as { url?: unknown }).url;
        if (typeof url === "string") structured.add(url);
      }
    }
  }

  return structured.size > 0 ? [...structured] : [...inProse];
}

export function scoreAeo(results: AeoResult[], config: TargetConfig): Finding[] {
  const usable = results.filter((r) => !r.error);
  if (usable.length === 0) {
    return [
      {
        id: "aeo-no-results",
        module: "aeo",
        severity: "info",
        title: "No answer-engine results were collected",
        detail: results[0]?.error ?? "All queries failed.",
        evidence: [],
        urls: [],
        recommendation: "Check ANTHROPIC_API_KEY and rerun.",
        capability: CAP,
        confidence: "high",
      },
    ];
  }

  const mentioned = usable.filter((r) => r.brandMentioned);
  const prominent = usable.filter((r) => r.brandProminent);
  const cited = usable.filter((r) => r.brandCited);
  const shareOfAnswer = mentioned.length / usable.length;

  const findings: Finding[] = [];

  findings.push({
    id: "aeo-share-of-answer",
    module: "aeo",
    severity:
      shareOfAnswer < 0.15 ? "high" : shareOfAnswer < 0.4 ? "medium" : "info",
    title: `Share of answer: ${Math.round(shareOfAnswer * 100)}% (${mentioned.length}/${usable.length} queries)`,
    detail:
      `Named anywhere in the answer on ${mentioned.length} queries, named in the opening third on ${prominent.length}, and cited as a source on ${cited.length}. ` +
      "Citation is the strongest of the three: it means the model read the site, not just recalled the brand.",
    evidence: mentioned.slice(0, 6).map((r) => r.query),
    urls: [],
    recommendation:
      "Raise citation rate first. Answer engines quote pages that state a direct answer early, carry structured data, and are corroborated by third-party sources. Ranking in classic search remains the largest input.",
    capability: CAP,
    confidence: "moderate",
  });

  // Where the brand is absent, who is winning instead.
  const absent = usable.filter((r) => !r.brandMentioned);
  if (absent.length > 0) {
    const competitorCount = new Map<string, number>();
    for (const r of absent) {
      for (const c of r.competitorsMentioned) {
        competitorCount.set(c, (competitorCount.get(c) ?? 0) + 1);
      }
    }
    const ranked = [...competitorCount.entries()].sort((a, b) => b[1] - a[1]);

    findings.push({
      id: "aeo-absent-queries",
      module: "aeo",
      severity: "high",
      title: `Absent from answers on ${plural(absent.length, "query", "queries")}`,
      detail: ranked.length
        ? `Named instead, most often: ${ranked.slice(0, 6).map(([c, n]) => `${c} (${n})`).join(", ")}.`
        : "No configured competitor was named either, which usually means the answers stayed generic rather than recommending a specific provider. Generic answers are the easiest to win.",
      evidence: absent.slice(0, 10).map((r) => r.query),
      urls: [],
      recommendation:
        "Take the decision-stage and local-stage absences first. Each one needs a page that answers the question directly, plus citations from sources the model already trusts in this category.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  // Which domains the model does cite, so content can target them.
  const domainCount = new Map<string, number>();
  for (const r of usable) {
    for (const c of new Set(r.citations.map(safeHost).filter(Boolean) as string[])) {
      domainCount.set(c, (domainCount.get(c) ?? 0) + 1);
    }
  }
  const topDomains = [...domainCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (topDomains.length > 0) {
    findings.push({
      id: "aeo-source-landscape",
      module: "aeo",
      severity: "info",
      title: `${plural(domainCount.size, "distinct domain")} cited across the query set`,
      detail: topDomains.map(([d, n]) => `${d} (${n})`).join(", "),
      evidence: [],
      urls: [],
      recommendation:
        "These are the sources that shape the answer. Directory and association listings on this list are the cheapest AEO wins: correct the listing and the citation follows.",
      capability: CAP,
      confidence: "moderate",
    });
  }

  const failed = results.filter((r) => r.error);
  if (failed.length > 0) {
    findings.push({
      id: "aeo-errors",
      module: "aeo",
      severity: "info",
      title: `${plural(failed.length, "query", "queries")} failed, excluded from the score`,
      detail: [...new Set(failed.map((r) => r.error ?? "unknown"))].slice(0, 3).join("; "),
      evidence: [],
      urls: [],
      recommendation: "Rerun the failed subset before reading the trend.",
      capability: CAP,
      confidence: "high",
    });
  }

  return findings;
}

function dedupeLower(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

function safeHost(u: string): string | null {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}
