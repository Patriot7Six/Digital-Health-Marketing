import type { Finding, Severity } from "../types.js";
import type { ReportInput } from "./markdown.js";

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const CONFIDENCE: Array<Finding["confidence"]> = ["high", "moderate", "low"];

const SEV: Record<Severity, { color: string; tint: string; note: string }> = {
  critical: { color: "#A4243B", tint: "#F7E9EC", note: "Blocks acquisition or creates regulatory exposure" },
  high: { color: "#B3541E", tint: "#FAEDE4", note: "Measurably suppresses qualified traffic or conversion" },
  medium: { color: "#8A6D1F", tint: "#F8F2E1", note: "Degrades performance, fix in the normal cycle" },
  low: { color: "#3F6B4F", tint: "#EAF1EC", note: "Hygiene" },
  info: { color: "#5A6472", tint: "#EFF1F4", note: "Observation, no action attached" },
};

/**
 * A single self-contained HTML file. No build step, no network, no fonts to
 * fetch: it has to open from a double-click on a machine that has never seen
 * this repo.
 *
 * The organising idea is that severity alone is not the whole story. Every
 * finding also carries how sure the tool is, because an audit run from
 * outside an account has real limits, and a report that hides that is
 * pretending. The matrix near the top plots both axes at once, which is the
 * one view this report has that a conventional site audit does not.
 */
export function renderHtml(input: ReportInput): string {
  const { config, crawl, findings } = input;
  const ok = crawl.pages.filter((p) => p.status === 200 && !p.error).length;
  const actionable = findings.filter((f) => f.severity !== "info");
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  const indexGroups = ORDER.map((sev) => {
    const items = findings.filter((f) => f.severity === sev);
    if (items.length === 0) return "";
    const links = items
      .map(
        (f) =>
          `<li><a href="#${esc(f.id)}" title="${esc(f.title)}" style="border-left-color:${
            SEV[sev].color
          }33">${esc(shorten(f.title, 62))}</a></li>`,
      )
      .join("\n          ");
    return `<div class="grp">
        <div class="grp-label" style="color:${SEV[sev].color}"><span>${sev}</span><span class="n">${items.length}</span></div>
        <ol>
          ${links}
        </ol>
      </div>`;
  })
    .filter(Boolean)
    .join("\n      ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Acquisition audit &mdash; ${esc(config.name)}</title>
<style>
:root{
  --ink:#10151C; --paper:#FBFBF9; --panel:#FFFFFF;
  --rule:#DDE1E6; --rule-soft:#ECEEF1; --muted:#5A6472;
  --accent:#0F6E7D;
  --mono: ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --sans: ui-sans-serif, -apple-system, "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--paper);color:var(--ink);font:400 16px/1.62 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{max-width:78rem;margin:0 auto;padding:0 2rem 6rem}
a{color:var(--accent)}
a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

header.mast{padding:4rem 0 2rem;border-bottom:3px solid var(--ink)}
.eyebrow{font:600 11px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent);margin-bottom:1.4rem}
h1{margin:0 0 .5rem;font-size:clamp(2.1rem,4.6vw,3.4rem);font-weight:760;letter-spacing:-.032em;line-height:1.02}
.subject{font-size:1.05rem;color:var(--muted);margin:0 0 1.6rem}
.origin{font-family:var(--mono);font-size:.85rem;color:var(--ink)}
.standfirst{max-width:44rem;margin:0;font-size:1.02rem;color:var(--muted);border-left:2px solid var(--rule);padding-left:1.1rem}

ul.scope{display:flex;flex-wrap:wrap;gap:0;margin:0;padding:0;list-style:none;border-bottom:1px solid var(--rule)}
ul.scope li{flex:1 1 9rem;padding:1.25rem 1.25rem 1.25rem 0}
ul.scope dt{font:600 10px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:.5rem}
ul.scope dd{margin:0;font-size:1.6rem;font-weight:680;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
ul.scope dd small{display:block;font-size:.76rem;font-weight:400;color:var(--muted);letter-spacing:0;margin-top:.15rem}

.matrix-sec{padding:3rem 0 0}
h2.sec{font:600 11px/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin:0 0 .5rem}
.sec-note{margin:0 0 1.5rem;color:var(--muted);font-size:.92rem;max-width:42rem}
table.matrix{border-collapse:collapse;width:100%;max-width:46rem;font-variant-numeric:tabular-nums}
table.matrix th{font:600 10px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);text-align:center;padding:.5rem .4rem}
table.matrix th.row{text-align:left;width:9rem;padding-left:0}
table.matrix td{text-align:center;padding:0;border:1px solid var(--rule-soft);height:3.1rem}
table.matrix td .n{font-size:1.05rem;font-weight:680}
table.matrix td.zero{color:#C3C8CE;background:#FCFCFB}
table.matrix td.zero .n{font-weight:400}
.axis-note{margin:.9rem 0 0;font-size:.8rem;color:var(--muted);max-width:42rem}

.cols{display:grid;grid-template-columns:15rem 1fr;gap:3.5rem;margin-top:3.5rem;align-items:start}
nav.index{position:sticky;top:2rem;font-size:.8rem;max-height:calc(100vh - 4rem);overflow-y:auto;overscroll-behavior:contain}
nav.index::-webkit-scrollbar{width:3px}
nav.index::-webkit-scrollbar-thumb{background:var(--rule);border-radius:2px}
nav.index .idx-head{display:flex;align-items:baseline;justify-content:space-between;margin:0 0 1.1rem;padding-bottom:.55rem;border-bottom:1px solid var(--rule)}
nav.index .idx-head h3{font:600 10px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase;color:var(--ink);margin:0}
nav.index .idx-head .total{font:400 10px/1 var(--mono);color:var(--muted)}
nav.index .grp{margin:0 0 1.25rem}
nav.index .grp:last-child{margin-bottom:0}
nav.index .grp-label{display:flex;align-items:center;gap:.5rem;margin:0 0 .5rem;font:700 9px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase}
nav.index .grp-label::after{content:"";flex:1;height:1px;background:currentColor;opacity:.22}
nav.index .grp-label .n{opacity:.65;font-weight:400}
nav.index ol{list-style:none;margin:0;padding:0}
nav.index li{margin:0}
nav.index a{
  display:block;text-decoration:none;color:#4A5462;line-height:1.42;
  padding:.34rem 0 .34rem .75rem;border-left:2px solid transparent;
  transition:color .12s ease,border-color .12s ease,background .12s ease;
}
nav.index a:hover{color:var(--ink);background:#F3F4F6}
nav.index a.on{color:var(--ink);font-weight:560;background:#F1F3F4}
@media (prefers-reduced-motion:reduce){nav.index a{transition:none}}

.group{margin:0 0 3rem}
.group-head{display:flex;align-items:baseline;gap:.75rem;border-bottom:2px solid var(--ink);padding-bottom:.5rem;margin-bottom:1.5rem}
.group-head .label{font:700 13px/1 var(--mono);letter-spacing:.13em;text-transform:uppercase}
.group-head .desc{font-size:.84rem;color:var(--muted)}
.group-head .count{font:400 12px/1 var(--mono);color:var(--muted);margin-left:auto}

article.finding{background:var(--panel);border:1px solid var(--rule);border-left-width:4px;padding:1.5rem 1.75rem;margin:0 0 1rem;scroll-margin-top:2rem}
article.finding h3{margin:0 0 .7rem;font-size:1.16rem;font-weight:680;letter-spacing:-.014em;line-height:1.3}
.tags{display:flex;flex-wrap:wrap;gap:.45rem;margin-bottom:.85rem}
.tag{font:600 10px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;padding:.34rem .5rem;border:1px solid var(--rule);color:var(--muted)}
.tag.sev{color:#fff;border-color:transparent}
.tag.conf-high{border-color:#3F6B4F;color:#3F6B4F}
.tag.conf-moderate{border-color:#8A6D1F;color:#8A6D1F}
.tag.conf-low{border-color:var(--muted);color:var(--muted);font-style:italic}
.detail{margin:0 0 1rem;color:#232A33}
pre{font:400 12px/1.65 var(--mono);background:#F5F6F7;border:1px solid var(--rule-soft);border-left:2px solid var(--rule);padding:.85rem 1rem;overflow-x:auto;margin:0 0 1rem;white-space:pre-wrap;word-break:break-word;color:#2A313A}
details{margin:0 0 1rem;border-top:1px solid var(--rule-soft);padding-top:.7rem}
summary{cursor:pointer;font:600 11px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
summary:hover{color:var(--accent)}
ul.urls{margin:.8rem 0 0;padding:0;list-style:none;font:400 12px/1.7 var(--mono);word-break:break-all}
ul.urls li{padding-left:1rem;text-indent:-1rem;color:#3A424C}
.rec{border-top:1px solid var(--rule);padding-top:.9rem}
.rec b{font:600 10px/1 var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--accent);display:block;margin-bottom:.4rem}
.cap{margin-top:.75rem;margin-bottom:0;font-size:.78rem;color:var(--muted)}

.limits{margin-top:4rem;border-top:3px solid var(--ink);padding-top:2rem}
.limits h2{font-size:1.5rem;font-weight:720;letter-spacing:-.02em;margin:0 0 .8rem}
.limits p,.limits ul{max-width:44rem;color:var(--muted)}
.limits ul{padding-left:1.1rem}
.limits li{margin-bottom:.35rem}
footer.credit{margin-top:2.5rem;font:400 12px/1.6 var(--mono);color:var(--muted)}

@media (max-width:64rem){
  .cols{grid-template-columns:1fr;gap:1.5rem}
  .wrap{padding:0 1.25rem 4rem}
  /* A 20-item list above the content pushes the findings off the first
     screen. Collapse it and let the reader open it if they want it. */
  nav.index{position:static;max-height:none;overflow:visible;border:1px solid var(--rule);border-radius:6px;background:var(--panel)}
  nav.index details{margin:0;border:0;padding:0}
  nav.index summary{list-style:none;padding:.9rem 1rem;display:flex;justify-content:space-between;align-items:center}
  nav.index summary::-webkit-details-marker{display:none}
  nav.index summary::after{content:"\\25BE";font-size:.9rem;color:var(--muted)}
  nav.index details[open] summary::after{content:"\\25B4"}
  nav.index .idx-body{padding:0 1rem 1rem}
  nav.index .idx-head{display:none}
}
@media (min-width:64.01rem){
  nav.index summary{display:none}
}
@media print{
  body{background:#fff}
  nav.index{display:none}
  .cols{grid-template-columns:1fr}
  article.finding{break-inside:avoid;border-color:#ccc}
  details{display:none}
  a{color:var(--ink);text-decoration:none}
}
</style>
</head>
<body>
<div class="wrap">

<header class="mast">
  <p class="eyebrow">Digital acquisition audit &middot; public data only</p>
  <h1>${esc(config.name)}</h1>
  <p class="subject"><span class="origin">${esc(crawl.origin)}</span> &nbsp;&middot;&nbsp; generated ${generated} UTC</p>
  <p class="standfirst">Collected from pages any visitor can load, logged out. No account access, no
  analytics, no advertising data. Every finding is reproducible by anyone who runs the same crawl, and
  carries how sure the tool is about it.</p>
</header>

<ul class="scope">
  <li><dt>Pages read</dt><dd>${ok}<small>of ${crawl.pages.length} crawled</small></dd></li>
  <li><dt>Sitemap URLs</dt><dd>${crawl.sitemapUrls.length}<small>${
    crawl.robotsTxt ? "robots.txt respected" : "no robots.txt found"
  }</small></dd></li>
  <li><dt>Findings</dt><dd>${findings.length}<small>${actionable.length} actionable</small></dd></li>
  <li><dt>Answer engines</dt><dd>${input.aeoRan ? "Measured" : "&mdash;"}<small>${
    input.aeoRan ? "share of answer sampled" : "module not run"
  }</small></dd></li>
</ul>

<section class="matrix-sec">
  <h2 class="sec">Severity against confidence</h2>
  <p class="sec-note">Severity is a judgement about revenue impact. Confidence is how far the evidence
  actually supports it. Reading both together is the point: a critical finding at low confidence is a
  question, not an instruction.</p>
  ${matrix(findings)}
  <p class="axis-note">Confidence drops where the evidence is indirect. A tag inventory built from
  server-rendered markup cannot see what a tag manager injects at runtime, so it is a floor rather than
  a census, and it says so.</p>
</section>

<div class="cols">
  <nav class="index" aria-label="Findings index">
    <details open>
      <summary><span style="font:600 10px/1 var(--mono);letter-spacing:.15em;text-transform:uppercase">Findings</span><span style="font:400 10px/1 var(--mono);color:var(--muted)">${findings.length}</span></summary>
      <div class="idx-body">
        <div class="idx-head"><h3>Findings</h3><span class="total">${findings.length}</span></div>
        ${indexGroups}
      </div>
    </details>
  </nav>

  <main>
    ${ORDER.map((sev) => group(sev, findings.filter((f) => f.severity === sev))).join("\n")}

    <section class="limits">
      <h2>What this audit cannot see</h2>
      <p>Everything above came from the public web. The following require account access and stay unknown
      until then. No finding infers any of them.</p>
      <ul>
        <li>Traffic, sessions, and conversion rates</li>
        <li>Query-level impressions, clicks, and position from Search Console</li>
        <li>Spend, cost per click, cost per acquisition, and conversion volume by campaign</li>
        <li>Tags injected client-side through a tag manager container</li>
        <li>Business Profile insights, review volume, and listing accuracy against the real record</li>
        <li>Which enquiries became scheduled appointments, and which became patients</li>
      </ul>
      <footer class="credit">digital-health-marketing &middot; github.com/Patriot7Six/Digital-Health-Marketing</footer>
    </section>
  </main>
</div>

</div>
<script>
(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll("nav.index a"));
  if (!links.length || !("IntersectionObserver" in window)) return;

  var byId = {};
  links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });

  var current = null;
  var setActive = function (a) {
    if (a === current) return;
    if (current) current.classList.remove("on");
    if (a) a.classList.add("on");
    current = a;
  };

  // Track which findings are on screen; the topmost one wins.
  var visible = {};
  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) visible[e.target.id] = e.boundingClientRect.top;
        else delete visible[e.target.id];
      });
      var best = null;
      var bestTop = Infinity;
      Object.keys(visible).forEach(function (id) {
        if (visible[id] < bestTop) { bestTop = visible[id]; best = id; }
      });
      if (best && byId[best]) setActive(byId[best]);
    },
    { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
  );

  Object.keys(byId).forEach(function (id) {
    var el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
</script>
</body>
</html>`;
}

/** The signature view: how many findings sit at each severity and confidence. */
function matrix(findings: Finding[]): string {
  const rows = ORDER.map((s) => {
    const cells = CONFIDENCE.map((c) => {
      const n = findings.filter((f) => f.severity === s && f.confidence === c).length;
      const style =
        n === 0 ? "" : ` style="background:${SEV[s].tint};box-shadow:inset 3px 0 0 ${SEV[s].color}"`;
      return `<td class="${n === 0 ? "zero" : ""}"${style}><span class="n">${n || "&middot;"}</span></td>`;
    }).join("");
    return `<tr><th class="row" style="color:${SEV[s].color}">${s}</th>${cells}</tr>`;
  }).join("\n    ");

  return `<table class="matrix">
    <tr><th class="row"></th>${CONFIDENCE.map((c) => `<th>${c} confidence</th>`).join("")}</tr>
    ${rows}
  </table>`;
}

function group(sev: Severity, items: Finding[]): string {
  if (items.length === 0) return "";
  return `<section class="group">
  <div class="group-head">
    <span class="label" style="color:${SEV[sev].color}">${sev}</span>
    <span class="desc">${SEV[sev].note}</span>
    <span class="count">${items.length}</span>
  </div>
  ${items.map(card).join("\n  ")}
</section>`;
}

function card(f: Finding): string {
  const evidence =
    f.evidence.length > 0
      ? `<pre>${esc(f.evidence.slice(0, 10).join("\n"))}${
          f.evidence.length > 10 ? `\n&hellip; ${f.evidence.length - 10} more` : ""
        }</pre>`
      : "";

  const urls =
    f.urls.length > 0
      ? `<details><summary>${f.urls.length} affected URL${f.urls.length === 1 ? "" : "s"}</summary>
    <ul class="urls">${f.urls
      .slice(0, 40)
      .map((u) => `<li>${esc(u)}</li>`)
      .join("")}${f.urls.length > 40 ? `<li>&hellip; ${f.urls.length - 40} more</li>` : ""}</ul></details>`
      : "";

  return `<article class="finding" id="${esc(f.id)}" style="border-left-color:${SEV[f.severity].color}">
    <div class="tags">
      <span class="tag sev" style="background:${SEV[f.severity].color}">${f.severity}</span>
      <span class="tag">${esc(f.module)}</span>
      <span class="tag conf-${f.confidence}">${f.confidence} confidence</span>
    </div>
    <h3>${esc(f.title)}</h3>
    <p class="detail">${esc(f.detail)}</p>
    ${evidence}
    ${urls}
    <div class="rec"><b>What to do</b>${esc(f.recommendation)}</div>
    ${f.capability ? `<p class="cap">Capability: ${esc(f.capability)}</p>` : ""}
  </article>`;
}

/** Keep index entries to one or two lines; the full text is in the title attribute. */
function shorten(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "\u2026";
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
