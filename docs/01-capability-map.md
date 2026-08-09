# Capability map

The capabilities a digital acquisition function needs at a multi-location healthcare provider, what this repo covers from public data, and what stays unknown without account access.

The third column is the honest part. A tool that pretends outside-in data answers everything is worse than no tool.

| Capability | What this repo does from public data | What needs account access |
|---|---|---|
| Vendor and agency management | Nothing. This is a people problem, not a software one. | Contracts, scope, retainer, and who owns which account. Whether account ownership sits with the company or the agency decides how fast anything can move. |
| Paid media across search and social, with compliant targeting | Detects which advertising platforms are firing on the public site, and flags pages where advertising pixels sit alongside intake forms (`src/audits/tags.ts`) | Spend, cost per click, cost per acquisition, impression share, campaign structure, audience definitions, conversion actions, negative keyword lists |
| Technical SEO and organic performance | Full crawl and audit: canonicals, titles, descriptions, headings, thin content, broken links, redirect chains, image alt text, non-production hosts referenced in live markup (`src/audits/technical-seo.ts`) | Search Console query data: impressions, clicks, position, and query mix. Without it, prioritisation is judgement rather than measurement. |
| Answer engine optimisation | Runs a family-intent query set through a live model and scores share of answer, prominence, citation rate, and which competitors appear when the brand does not (`src/aeo/run.ts`) | Nothing required. This works entirely from outside, which is why it is the strongest module here. Cross-platform coverage is the real gap: see [`03-aeo-methodology.md`](03-aeo-methodology.md). |
| Analytics and full-funnel conversion tracking | Inventories tags visible in markup, measures per-page deployment coverage, identifies every lead form as a conversion surface, and proposes the event taxonomy and funnel model ([`05-measurement-model.md`](05-measurement-model.md)) | Analytics property configuration, tag manager container, conversion definitions, and intake outcomes. Whether an enquiry became a scheduled appointment is invisible from outside and is the only number that finally matters. |
| Local listing accuracy across locations | Detects clinics stacked on shared URLs, name/address/phone presence and consistency, duplicate location slugs, missing structured data, phone numbers shared across markets (`src/audits/local.ts`) | Business Profile access: real listing data, categories, hours, photos, reviews, and the insights showing which listings generate calls and direction requests |
| Acquisition for new location openings | A repeatable pre-open sequence covering what has to happen before doors open rather than after ([`04-local-seo-playbook.md`](04-local-seo-playbook.md)) | The opening pipeline: which markets, which dates, capacity per clinic, and which payers are contracted at open |
| Reporting on cost per acquisition and channel efficiency | Defines the funnel, the model, and the attribution position ([`05-measurement-model.md`](05-measurement-model.md)) | Every input |

## What this repo is not

It is not a substitute for the accounts, and it is not an audit of anyone's business. It is a demonstration that the method, the compliance awareness, and the engineering hold up when pointed at a real public footprint instead of a hypothetical one.

It also touches nothing non-public: no authenticated requests, no account access, no attempt at data behind a login. `robots.txt` is parsed and obeyed, requests are rate-limited and identify themselves, and the crawl is capped. See [`06-limitations.md`](06-limitations.md).
