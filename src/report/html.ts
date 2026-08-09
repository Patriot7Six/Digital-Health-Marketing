import type { Finding, Severity } from "../types.js";
import type { ReportInput } from "./markdown.js";

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const COLOR: Record<Severity, string> = {
  critical: "#8c1c13",
  high: "#b45309",
  medium: "#7c6f1f",
  low: "#3f6212",
  info: "#475569",
};

/** Single-file HTML. No build step, no CDN, opens from disk. */
export function renderHtml(input: ReportInput): string {
  const { config, crawl, findings } = input;
  const ok = crawl.pages.filter((p) => p.status === 200 && !p.error).length;

  const counts = ORDER.map((s) => ({
    severity: s,
    n: findings.filter((f) => f.severity === s).length,
  }));

  const cards = ORDER.flatMap((s) =>
    findings.filter((f) => f.severity === s).map((f) => findingCard(f)),
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Digital acquisition audit &mdash; ${esc(config.name)}</title>
<style>
  :root { --ink:#16181d; --muted:#5b6472; --rule:#e2e5ea; --bg:#fbfbfc; }
  * { box-sizing:border-box; }
  body { margin:0; padding:0 1.25rem 5rem; background:var(--bg); color:var(--ink);
         font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  main { max-width:60rem; margin:0 auto; }
  header { padding:2.5rem 0 1.5rem; border-bottom:2px solid var(--ink); }
  h1 { font-size:1.9rem; margin:0 0 .35rem; letter-spacing:-.015em; }
  .sub { color:var(--muted); font-size:.9rem; }
  h2 { font-size:1.15rem; margin:2.5rem 0 .75rem; letter-spacing:-.01em; }
  table { border-collapse:collapse; width:100%; font-size:.9rem; }
  th,td { text-align:left; padding:.45rem .6rem; border-bottom:1px solid var(--rule); }
  th { color:var(--muted); font-weight:600; }
  .tiles { display:flex; flex-wrap:wrap; gap:.6rem; margin:1rem 0 0; }
  .tile { flex:1 1 7rem; border:1px solid var(--rule); background:#fff; border-radius:6px; padding:.7rem .85rem; }
  .tile b { display:block; font-size:1.5rem; line-height:1.2; }
  .tile span { font-size:.72rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); }
  .card { background:#fff; border:1px solid var(--rule); border-left:5px solid var(--rule);
          border-radius:6px; padding:1.1rem 1.25rem; margin:.85rem 0; }
  .card h3 { margin:0 0 .5rem; font-size:1.02rem; letter-spacing:-.005em; }
  .meta { font-size:.72rem; text-transform:uppercase; letter-spacing:.07em; color:var(--muted); margin-bottom:.6rem; }
  .badge { display:inline-block; padding:.1rem .45rem; border-radius:3px; color:#fff; font-weight:600; }
  pre { background:#f4f5f7; border:1px solid var(--rule); border-radius:4px; padding:.65rem .8rem;
        overflow-x:auto; font-size:.78rem; line-height:1.5; margin:.6rem 0; }
  details { margin:.5rem 0; }
  summary { cursor:pointer; font-size:.85rem; color:var(--muted); }
  ul.urls { margin:.4rem 0 0; padding-left:1.1rem; font-size:.8rem; word-break:break-all; }
  .rec { margin-top:.7rem; padding-top:.7rem; border-top:1px solid var(--rule); font-size:.93rem; }
  .cap { font-size:.75rem; color:var(--muted); font-style:italic; margin-top:.5rem; }
  footer { margin-top:3rem; padding-top:1.25rem; border-top:1px solid var(--rule);
           font-size:.82rem; color:var(--muted); }
</style>
</head>
<body>
<main>
  <header>
    <h1>Digital acquisition audit</h1>
    <div class="sub">${esc(config.name)} &middot; ${esc(crawl.origin)} &middot; generated ${new Date()
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC</div>
    <div class="sub">Public data only. No account access, no analytics, no ad platform data.</div>
  </header>

  <div class="tiles">
    ${counts
      .map(
        (c) =>
          `<div class="tile" style="border-left:4px solid ${COLOR[c.severity]}"><b>${c.n}</b><span>${c.severity}</span></div>`,
      )
      .join("")}
    <div class="tile"><b>${ok}</b><span>pages read</span></div>
  </div>

  <h2>Scope</h2>
  <table>
    <tr><th>Pages crawled</th><td>${crawl.pages.length} (${ok} returned 200)</td></tr>
    <tr><th>Sitemap URLs</th><td>${crawl.sitemapUrls.length}</td></tr>
    <tr><th>robots.txt</th><td>${crawl.robotsTxt ? "present and respected" : "not found"}</td></tr>
    <tr><th>Answer-engine module</th><td>${input.aeoRan ? "run" : "not run"}</td></tr>
  </table>

  <h2>Findings</h2>
  ${cards}

  <footer>
    <strong>What this cannot see.</strong> Traffic and conversion rates, Search Console query data,
    ad spend and CPA, client-side tags fired through a tag manager, Google Business Profile insights,
    and CRM intake outcomes all require account access. Nothing above infers any of them. Findings
    that depend on unobservable data are marked moderate or low confidence.
  </footer>
</main>
</body>
</html>`;
}

function findingCard(f: Finding): string {
  const urls =
    f.urls.length > 0
      ? `<details><summary>${f.urls.length} affected URL${f.urls.length === 1 ? "" : "s"}</summary>
         <ul class="urls">${f.urls.slice(0, 40).map((u) => `<li>${esc(u)}</li>`).join("")}
         ${f.urls.length > 40 ? `<li>&hellip; ${f.urls.length - 40} more</li>` : ""}</ul></details>`
      : "";

  const evidence =
    f.evidence.length > 0
      ? `<pre>${esc(f.evidence.slice(0, 10).join("\n"))}${
          f.evidence.length > 10 ? `\n... ${f.evidence.length - 10} more` : ""
        }</pre>`
      : "";

  return `<div class="card" style="border-left-color:${COLOR[f.severity]}">
  <div class="meta"><span class="badge" style="background:${COLOR[f.severity]}">${f.severity}</span>
    &nbsp;${esc(f.module)} &middot; confidence ${esc(f.confidence)}</div>
  <h3>${esc(f.title)}</h3>
  <p>${esc(f.detail)}</p>
  ${evidence}
  ${urls}
  <div class="rec"><strong>Recommendation.</strong> ${esc(f.recommendation)}</div>
  ${f.capability ? `<div class="cap">Maps to: ${esc(f.capability)}</div>` : ""}
</div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
