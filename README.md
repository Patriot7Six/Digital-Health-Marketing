# digital-health-marketing

An outside-in digital acquisition audit for multi-location healthcare providers. Point it at a public website and it reports what is capping organic, local, and answer-engine performance, plus where advertising pixels sit close enough to intake forms to be worth a compliance review.

Public data only: no account access, no analytics, no advertising data, no authenticated requests.

## What this is

A working tool and a method note. It exists because most site audits produce a list of technical defects with no argument for why any of them matter, and no admission of what the auditor could not see.

This one does three things differently. Every finding names the business capability it affects. Every finding carries a confidence level, because an audit run from outside an account has real limits. And the report opens with a severity-against-confidence matrix, so a reader can tell at a glance which findings are instructions and which are questions.

The design constraint is the interesting part: working only from what any visitor can load forces the tool to be explicit about its own blind spots. [`docs/06-limitations.md`](docs/06-limitations.md) is the longest document in the repo for that reason.

## Sample output

**[View the rendered report →](https://patriot7six.github.io/Digital-Health-Marketing/samples/multi-location-aba-provider-2026-08-09.html)**

[`samples/`](samples/) holds a report generated against a real multi-location provider, run through the anonymiser so it demonstrates method without naming anyone.

## Quick start

```bash
git clone https://github.com/Patriot7Six/Digital-Health-Marketing.git
cd Digital-Health-Marketing
npm install
npm test                                              # 40 assertions, no network

cp config/example.target.json config/my-target.local.json
# edit origin, name, brandAliases, competitors
npm run recon -- audit -c config/my-target.local.json
```

Reports land in `reports/` as a Markdown file and a single self-contained HTML file that opens from disk.

Answer-engine visibility needs an API key:

```bash
export ANTHROPIC_API_KEY=sk-...
npm run recon -- aeo -c config/my-target.local.json --web --limit 36
```

Useful flags: `--max-pages <n>`, `--json` to dump the raw crawl and findings, and `--anonymize "Label"` to strip the target from the output so a report can be published as a work sample. Anonymised runs are verified before anything is written: if any reference to the target survives into the rendered report, the tool prints what leaked and writes nothing. Use `--redact "term,term"` for spellings it cannot infer.

Configs matching `config/*.local.json` are gitignored. Real audit targets stay out of the repo.

## Modules

| Module | What it finds | Capability it covers |
|---|---|---|
| `audits/technical-seo` | Canonical collisions, duplicate titles and descriptions, missing headings, thin pages, broken links, redirect chains, missing image alt text, non-production hosts referenced in live markup | Technical SEO and on-page optimisation |
| `audits/tags` | Which analytics and advertising platforms are firing, per-page deployment coverage, every lead form as a conversion surface, and the pages where advertising pixels overlap intake fields | Conversion tracking; healthcare marketing compliance |
| `audits/local` | Multiple clinics stacked on one URL, name/address/phone consistency, duplicate location slugs, missing structured data, phone numbers shared across markets | Local listing accuracy across locations |
| `audits/content-gap` | Family-intent questions with no page targeting them, split by funnel stage | Content direction |
| `aeo/run` | Share of answer against a live model: mention, prominence, citation, which competitors win when the brand is absent, and which domains get cited instead | Answer engine optimisation |

Findings separate observation from recommendation in the data model, not just in the prose, and each carries the raw strings it matched on. That last detail matters more than it sounds: it is what makes the tool auditable by its own author, and it is how several false positives in early versions were caught.

## Collection ethics

- `robots.txt` parsed per RFC 9309 and obeyed, including `Crawl-delay`
- Rate-limited per host, concurrency capped, page count capped, response size capped
- Honest, contactable User-Agent
- Logged out only. No authentication, no bypass of any access control
- No personal data. Addresses and phone numbers are collected as business location records

A tool built to demonstrate professional judgement that quietly ignored `robots.txt` would demonstrate the opposite.

## Documentation

- [`00-approach.md`](docs/00-approach.md) — how to sequence acquisition work at a clinic group, and why
- [`01-capability-map.md`](docs/01-capability-map.md) — each capability mapped to a module and to what needs account access
- [`02-hipaa-marketing.md`](docs/02-hipaa-marketing.md) — where the line sits after *AHA v. Becerra*, with primary sources
- [`03-aeo-methodology.md`](docs/03-aeo-methodology.md) — how share of answer is measured, and why one run means little
- [`04-local-seo-playbook.md`](docs/04-local-seo-playbook.md) — per-location page template and pre-open launch sequence
- [`05-measurement-model.md`](docs/05-measurement-model.md) — funnel, event taxonomy, attribution position, dashboard
- [`06-limitations.md`](docs/06-limitations.md) — what this cannot see, and the caveats inside the tool

## Stack

TypeScript on Node 20+. `cheerio` for parsing, `zod` for config validation, `commander` for the CLI, the Anthropic SDK for the answer-engine module. No database, no build step to run it, no framework. Tests are a plain assertion script so the repo clones and runs with nothing but `npm install`.

MIT.
