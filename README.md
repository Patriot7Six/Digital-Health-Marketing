# digital-health-marketing

An outside-in digital acquisition audit for multi-location healthcare providers. It crawls a public website and reports what is capping organic, local, and answer-engine performance, plus where advertising pixels sit close enough to intake forms to be worth a compliance review.

## What this is, stated up front

A demonstration artifact. It was built to work through the problems a Digital Acquisition Manager at a multi-clinic behavioural health provider would face, using only what any member of the public can see.

There is no privileged information here. No account access, no analytics, no ad platform data, no internal documents, no conversations with anyone at the organisation whose public site is configured as the example target. Every finding it produces comes from pages a browser would load logged out.

That constraint is the interesting part. It forces the tool to say what it does not know, and it means the analysis in [`docs/`](docs/) is reasoning rather than reporting. Where a conclusion depends on data that only exists inside an account, the tool marks it and moves on instead of guessing. [`docs/06-limitations.md`](docs/06-limitations.md) is the longest document in the repo for that reason.

## Why it exists

Most site audits produce a list of technical defects with no argument for why any of them matter. This one ties every finding to the business capability it affects, marks its own confidence, and states plainly which questions public data cannot answer at all. Six of the seven responsibilities in the target role map to a module here; the seventh is managing vendor relationships, which is not a software problem. See [`docs/01-requirements-map.md`](docs/01-requirements-map.md).

## Quick start

```bash
git clone https://github.com/Patriot7Six/Digital-Health-Marketing.git
cd Digital-Health-Marketing
npm install
npm test                                          # 29 assertions, no network
npm run recon -- audit -c config/empowerbh.json   # writes reports/<name>-<date>.{md,html}
```

Answer-engine visibility needs an API key:

```bash
export ANTHROPIC_API_KEY=sk-...
npm run recon -- audit -c config/empowerbh.json --aeo --aeo-web
```

Options: `--max-pages <n>`, `--aeo-limit <n>`, `--json` to dump the raw crawl and findings.

## Modules

| Module | What it finds | Job responsibility it answers |
|---|---|---|
| `audits/technical-seo` | Canonical collisions, duplicate titles and descriptions, missing H1s, thin pages, broken links, redirect chains, missing image alt, staging-host references leaking into production markup | Technical SEO and on-page optimisation |
| `audits/tags` | Which analytics and advertising platforms are firing, per-page deployment coverage, every lead form as a conversion surface, and the pages where ad pixels overlap intake fields | Full-funnel conversion tracking; HIPAA marketing awareness |
| `audits/local` | Multiple clinics stacked on one URL, NAP presence and consistency, duplicate location slugs, missing `LocalBusiness` schema, phone numbers shared across markets | Local listing accuracy across clinic locations |
| `audits/content-gap` | Family-intent questions with no page that targets them, split by funnel stage | Content direction to drive qualified traffic |
| `aeo/run` | Share of answer against a live model: mention, prominence, citation, which competitors win when you are absent, and which domains get cited instead | AI search and answer engine optimisation |

Findings carry a severity calibrated to revenue impact, an evidence list of raw strings pulled from the page, the affected URLs, a recommendation, and a confidence level. Observations and recommendations are separated in the data model, not just in the prose.

## Configuration

A target is one JSON file (`config/empowerbh.json`):

```jsonc
{
  "name": "Empower Behavioral Health",
  "origin": "https://www.empowerbh.com",
  "maxPages": 150,
  "delayMs": 1500,          // minimum gap between requests to a host
  "concurrency": 2,         // capped at 4
  "locationPathPrefixes": ["/location/"],
  "brandAliases": ["Empower Behavioral Health", "EmpowerBH"],
  "competitors": ["Action Behavior Centers", "Hopebridge", "..."],
  "querySet": "query-set.aba-texas.json"
}
```

The query set (`config/query-set.aba-texas.json`) holds 36 questions across four funnel stages, phrased the way a parent asks them rather than the way a keyword tool returns them. It is currently informed judgement, and it says so in its own `notes` field. It gets rebuilt from Search Console data the first week that data is available.

## Collection ethics

- `robots.txt` parsed per RFC 9309 and obeyed, including `Crawl-delay`
- Rate-limited per host, concurrency capped, page count capped, response size capped
- Honest, contactable User-Agent
- Logged out only. No authentication, no bypass of any access control, no CAPTCHA circumvention
- Nothing collected from platforms whose terms prohibit it
- No personal data. Addresses and phone numbers are collected as business NAP records for clinic locations

[`docs/06-limitations.md`](docs/06-limitations.md) lists what public data cannot tell you, which is a longer list than what it can.

## Documentation

- [`00-strategy.md`](docs/00-strategy.md) — the 90-day plan, and the argument against it
- [`01-requirements-map.md`](docs/01-requirements-map.md) — every job responsibility mapped to a module and to what needs account access
- [`02-hipaa-marketing.md`](docs/02-hipaa-marketing.md) — where the line sits after *AHA v. Becerra*, with primary sources
- [`03-aeo-methodology.md`](docs/03-aeo-methodology.md) — how share of answer is measured and why a single run means little
- [`04-local-seo-playbook.md`](docs/04-local-seo-playbook.md) — per-clinic page template and the pre-open launch sequence
- [`05-measurement-model.md`](docs/05-measurement-model.md) — funnel, event taxonomy, attribution position, dashboard
- [`06-limitations.md`](docs/06-limitations.md) — what this cannot see, and the methodological caveats inside the tool

## Stack

TypeScript on Node 20+, `cheerio` for parsing, `zod` for config and contract validation, `commander` for the CLI, the Anthropic SDK for the AEO module. No database, no build step to run it, no framework. Reports are a Markdown file and a single self-contained HTML file that opens from disk.

## Status

Working, tested, and honest about its limits. Not a product.

MIT.
