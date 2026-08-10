#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { Command } from "commander";

import { TargetConfig, QuerySet, type Finding } from "./types.js";
import { crawlSite } from "./crawl.js";
import { auditTechnicalSeo } from "./audits/technical-seo.js";
import { auditTags } from "./audits/tags.js";
import { collectLocations, auditLocal } from "./audits/local.js";
import { auditContentGap } from "./audits/content-gap.js";
import { runAeo, scoreAeo } from "./aeo/run.js";
import { renderMarkdown, type ReportInput } from "./report/markdown.js";
import { renderHtml } from "./report/html.js";
import { anonymize, findLeaks } from "./anonymize.js";

const program = new Command();

program
  .name("recon")
  .description(
    "Outside-in digital acquisition audit for multi-location providers. Public data only.",
  )
  .version("0.1.0");

program
  .command("audit")
  .description("Crawl a target and produce an audit report")
  .requiredOption("-c, --config <path>", "path to the target config JSON")
  .option("-o, --out <dir>", "output directory", "reports")
  .option("--max-pages <n>", "override maxPages from config")
  .option("--aeo", "also run answer-engine visibility (needs ANTHROPIC_API_KEY)", false)
  .option("--aeo-web", "let the AEO model search the live web", false)
  .option("--aeo-limit <n>", "cap the number of AEO queries", "20")
  .option("--json", "also write the raw crawl and findings as JSON", false)
  .option(
    "--anonymize [label]",
    "strip the target's name and domain from the report so it can be published as a work sample",
  )
  .option(
    "--redact <terms>",
    "comma-separated extra strings to remove when anonymising, for spellings the tool cannot infer",
  )
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    if (opts.maxPages) {
      const n = Number.parseInt(opts.maxPages, 10);
      if (Number.isFinite(n) && n > 0) config.maxPages = n;
    }

    log(`Target : ${config.name} (${config.origin})`);
    log(`Budget : ${config.maxPages} pages, ${config.delayMs}ms delay, concurrency ${config.concurrency}`);
    log("");

    const crawl = await crawlSite(config, {
      onProgress: (done, total, url) => {
        if (done % 10 === 0 || done === 1) log(`  [${done}/${total}] ${short(url)}`);
      },
    });

    const ok = crawl.pages.filter((p) => p.status === 200 && !p.error).length;
    log("");
    log(`Crawled ${crawl.pages.length} pages, ${ok} usable. Sitemap listed ${crawl.sitemapUrls.length}.`);
    if (crawl.skipped.length > 0) log(`Skipped ${crawl.skipped.length} URLs (robots.txt or exclusions).`);

    const findings: Finding[] = [];
    findings.push(...auditTechnicalSeo(crawl));
    findings.push(...auditTags(crawl));

    const locations = collectLocations(crawl, config);
    log(`Found ${locations.length} location pages.`);
    findings.push(...auditLocal(crawl, config, locations));

    let querySet: QuerySet | null = null;
    if (config.querySet) {
      querySet = await loadQuerySet(resolvedRelativeTo(opts.config, config.querySet));
      const gap = auditContentGap(crawl, querySet);
      findings.push(...gap.findings);
      log(`Content coverage: ${gap.covered.length}/${querySet.queries.length} questions matched a page.`);
    }

    let aeoRan = false;
    if (opts.aeo) {
      if (!querySet) {
        log("! --aeo requires a querySet in the target config. Skipping.");
      } else {
        log("");
        log("Running answer-engine visibility...");
        const results = await runAeo(config, querySet, {
          useWebSearch: Boolean(opts.aeoWeb),
          limit: Number.parseInt(opts.aeoLimit, 10) || 20,
          onProgress: (d, t, q) => log(`  [${d}/${t}] ${short(q, 70)}`),
        });
        findings.push(...scoreAeo(results, config));
        aeoRan = true;
        if (opts.json) await writeJson(opts.out, "aeo-results.json", results);
      }
    }

    // Several audits build affected-URL lists by concatenating per-item lists,
    // which repeats a URL that matches on more than one item. Deduping once
    // here keeps every module from having to remember.
    for (const f of findings) {
      f.urls = [...new Set(f.urls)];
      f.evidence = [...new Set(f.evidence)];
    }

    let input: ReportInput = { config, crawl, findings, aeoRan };
    let leakTokens: string[] = [];

    if (opts.anonymize) {
      const label =
        typeof opts.anonymize === "string" ? opts.anonymize : "Multi-location provider";
      const extra = String(opts.redact ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const scrubbed = anonymize(config, crawl, findings, { label, extra });
      input = {
        config: scrubbed.config,
        crawl: scrubbed.crawl,
        findings: scrubbed.findings,
        aeoRan,
      };
      leakTokens = scrubbed.tokens;
      log(`Anonymised as "${label}". Redacting: ${scrubbed.tokens.join(", ")}`);
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const slug = input.config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    const md = renderMarkdown(input);
    const html = renderHtml(input);

    // Verification gate. A scrubber without a check is a scrubber that fails
    // silently, so nothing is written if the target's name survived into the
    // rendered output.
    if (leakTokens.length > 0) {
      const leaks = [...findLeaks(md, leakTokens), ...findLeaks(html, leakTokens)];
      if (leaks.length > 0) {
        log("");
        log("Anonymisation failed. These references survived into the report:");
        for (const l of leaks.slice(0, 12)) log(`  ${l.replace(/\s+/g, " ")}`);
        throw new Error(
          "Nothing written. Add the missed spellings with --redact \"term,term\" and run again.",
        );
      }
      log("Verified: no reference to the target survived into the report.");
    }

    await mkdir(opts.out, { recursive: true });
    const mdPath = join(opts.out, `${slug}-${stamp}.md`);
    const htmlPath = join(opts.out, `${slug}-${stamp}.html`);
    await writeFile(mdPath, md, "utf8");
    await writeFile(htmlPath, html, "utf8");

    if (opts.json) {
      await writeJson(opts.out, `${slug}-${stamp}-crawl.json`, input.crawl);
      await writeJson(opts.out, `${slug}-${stamp}-findings.json`, input.findings);
    }

    log("");
    for (const sev of ["critical", "high", "medium", "low", "info"] as const) {
      const n = findings.filter((f) => f.severity === sev).length;
      if (n > 0) log(`  ${sev.padEnd(9)} ${n}`);
    }
    log("");
    log(`Wrote ${mdPath}`);
    log(`Wrote ${htmlPath}`);
  });

program
  .command("aeo")
  .description("Run only the answer-engine visibility check")
  .requiredOption("-c, --config <path>", "path to the target config JSON")
  .option("-o, --out <dir>", "output directory", "reports")
  .option("--web", "let the model search the live web", false)
  .option("--limit <n>", "cap the number of queries", "20")
  .action(async (opts) => {
    const config = await loadConfig(opts.config);
    if (!config.querySet) throw new Error("Target config has no querySet.");
    const querySet = await loadQuerySet(resolvedRelativeTo(opts.config, config.querySet));

    const results = await runAeo(config, querySet, {
      useWebSearch: Boolean(opts.web),
      limit: Number.parseInt(opts.limit, 10) || 20,
      onProgress: (d, t, q) => log(`[${d}/${t}] ${short(q, 70)}`),
    });

    const findings = scoreAeo(results, config);
    await writeJson(opts.out, "aeo-results.json", results);
    log("");
    for (const f of findings) log(`${f.severity.toUpperCase()}: ${f.title}`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

async function loadConfig(path: string): Promise<TargetConfig> {
  const raw = await readFile(resolve(path), "utf8");
  const parsed = TargetConfig.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid target config:\n${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

async function loadQuerySet(path: string): Promise<QuerySet> {
  const raw = await readFile(path, "utf8");
  const parsed = QuerySet.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(`Invalid query set:\n${formatIssues(parsed.error.issues)}`);
  }
  return parsed.data;
}

function formatIssues(issues: Array<{ path: (string | number)[]; message: string }>): string {
  return issues.map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

/** Query-set paths in a config are relative to that config file. */
function resolvedRelativeTo(configPath: string, target: string): string {
  return resolve(dirname(resolve(configPath)), target);
}

async function writeJson(dir: string, name: string, data: unknown): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, name), JSON.stringify(data, null, 2), "utf8");
}

function log(msg: string): void {
  process.stdout.write(msg + "\n");
}

function short(s: string, n = 78): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "\u2026";
}
