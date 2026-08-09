# Requirements map

Every responsibility in the Digital Acquisition Manager posting, what this repo does about it today with no account access, and what stays unknown until day one.

The third column is the honest part. A tool that pretends outside-in data answers everything is worse than no tool.

| Responsibility (from the posting) | What this repo does now | What needs internal access |
|---|---|---|
| Manage relationships with digital marketing vendors and agency partners | Nothing. This is a people problem. | Current contracts, scope, retainer, who owns which account, and whether account ownership sits with EBH or the agency. That last one decides how fast anything can move. |
| Manage all paid media across Google Ads, Meta, and emerging channels, with HIPAA-compliant targeting | Detects which ad platforms are firing on the public site and flags the pages where advertising pixels sit alongside intake forms (`src/audits/tags.ts`) | Spend, CPC, CPA, impression share, campaign structure, audience definitions, conversion actions, negative keyword lists, and whether customer-match or remarketing audiences are built from patient data |
| Own SEO strategy and organic website performance: technical SEO, on-page, content direction | Full crawl and technical audit: canonicals, titles, descriptions, headings, thin content, broken links, redirect chains, image alt, staging-host leaks (`src/audits/technical-seo.ts`) | Search Console query data, impressions, click-through, and position. Without it, priorities are judgement, not measurement. |
| Lead AI search and answer engine optimization across ChatGPT, Perplexity, Google AI Overviews | Runs a 36-query family-intent set through a live model and scores share of answer, prominence, citation rate, and who wins when EBH is absent (`src/aeo/run.ts`) | Nothing required. This module works entirely from outside, which is why it is the strongest thing in the repo. Cross-platform coverage is the gap: see `docs/03-aeo-methodology.md`. |
| Lead digital analytics and reporting, full-funnel conversion tracking, executive dashboards | Inventories tags visible in markup, measures deployment coverage per page, identifies every lead form as a conversion surface, and proposes the event taxonomy and funnel model (`docs/05-measurement-model.md`) | GA4 property config, GTM container, conversion definitions, CRM and intake outcomes. Whether a lead became a scheduled assessment is invisible from outside and is the only number that matters. |
| Manage local listing accuracy across all clinic locations | Detects clinics stacked on shared URLs, NAP presence and consistency, duplicate location slugs, missing LocalBusiness schema, shared phone numbers across markets (`src/audits/local.ts`) | Google Business Profile access: real listing data, categories, hours, photos, reviews, Q&A, and the insights that show which listings actually generate calls and direction requests |
| Design and execute acquisition strategy for new clinic openings, launch through patient ramp | A repeatable pre-open checklist covering the sequence that has to happen before a clinic opens rather than after (`docs/04-local-seo-playbook.md`) | The opening pipeline: which markets, which dates, capacity per clinic, and which payers are contracted in each market at open |
| Deliver reporting with actionable insight on cost per acquisition and channel efficiency | Defines the funnel, the CPA model, and the attribution position (`docs/05-measurement-model.md`) | Every input. Spend, leads, assessments, starts. |

## What the repo is not

It is not a substitute for the accounts. It is a demonstration that the reasoning, the compliance awareness, and the engineering are already in place, applied to EBH's actual public footprint rather than to a generic case study.

It also does not touch anything non-public. No logged-in scraping, no account access, no attempt at data behind authentication. `robots.txt` is parsed and obeyed, requests are rate-limited and identify themselves, and the crawler is capped. See `docs/06-limitations.md`.
