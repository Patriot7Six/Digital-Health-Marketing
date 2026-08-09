/**
 * Minimal robots.txt parser implementing the matching rules from RFC 9309:
 * - group selection by most specific matching user-agent
 * - `*` wildcard and `$` end-anchor in paths
 * - longest matching rule wins; Allow wins ties
 *
 * This tool respects robots.txt. That is not decoration. Anything that
 * ignores it is not something you can put in front of a prospective employer.
 */

export interface RobotsRule {
  type: "allow" | "disallow";
  pattern: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelaySec?: number;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
  raw: string;
}

export function parseRobots(raw: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];

  let current: RobotsGroup | null = null;
  // A run of consecutive User-agent lines forms one group.
  let lastLineWasAgent = false;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (!line) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastLineWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastLineWasAgent = true;
      continue;
    }

    lastLineWasAgent = false;

    if (field === "sitemap") {
      if (value) sitemaps.push(value);
      continue;
    }

    if (!current) continue;

    if (field === "allow" || field === "disallow") {
      // An empty Disallow means "allow everything" and carries no pattern.
      if (field === "disallow" && value === "") continue;
      current.rules.push({ type: field, pattern: value });
    } else if (field === "crawl-delay") {
      const n = Number.parseFloat(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelaySec = n;
    }
  }

  return { groups, sitemaps, raw };
}

/** Pick the group whose user-agent token is the longest match for ours. */
function selectGroup(robots: ParsedRobots, userAgent: string): RobotsGroup | null {
  const ua = userAgent.toLowerCase();
  let best: RobotsGroup | null = null;
  let bestLen = -1;

  for (const group of robots.groups) {
    for (const agent of group.agents) {
      if (agent === "*") {
        if (bestLen < 0) {
          best = group;
          bestLen = 0;
        }
        continue;
      }
      if (ua.includes(agent) && agent.length > bestLen) {
        best = group;
        bestLen = agent.length;
      }
    }
  }
  return best;
}

/** Convert a robots path pattern into a regex anchored at the path start. */
function patternToRegex(pattern: string): RegExp {
  let src = "";
  let anchorEnd = false;
  const body = pattern.endsWith("$")
    ? ((anchorEnd = true), pattern.slice(0, -1))
    : pattern;

  for (const ch of body) {
    if (ch === "*") {
      src += ".*";
    } else {
      src += ch.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp("^" + src + (anchorEnd ? "$" : ""));
}

/**
 * @param pathAndQuery e.g. "/location/kyle-tx/?utm_source=x"
 */
export function isAllowed(
  robots: ParsedRobots | null,
  userAgent: string,
  pathAndQuery: string,
): boolean {
  if (!robots) return true;
  const group = selectGroup(robots, userAgent);
  if (!group || group.rules.length === 0) return true;

  let bestLen = -1;
  let bestType: "allow" | "disallow" | null = null;

  for (const rule of group.rules) {
    if (!patternToRegex(rule.pattern).test(pathAndQuery)) continue;
    const len = rule.pattern.length;
    if (len > bestLen) {
      bestLen = len;
      bestType = rule.type;
    } else if (len === bestLen && rule.type === "allow") {
      // Ties resolve in favour of Allow.
      bestType = "allow";
    }
  }

  return bestType !== "disallow";
}

export function crawlDelayFor(
  robots: ParsedRobots | null,
  userAgent: string,
): number | undefined {
  if (!robots) return undefined;
  return selectGroup(robots, userAgent)?.crawlDelaySec;
}
