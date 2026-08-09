# Strategy: bringing digital acquisition in-house

## What this document is

A proposal written from the outside, with no access to any account, any internal document, or anyone at the organisation. It is reasoning applied to a public job posting and a public website, nothing more. Read every recommendation below as "here is the case for doing this, and here is what would change my mind," not as a decision.

That framing is not modesty. A plan built on public data alone has a specific failure mode, and naming it is the first thing worth doing.

## The counterargument, first

**An outside-in audit can be confidently wrong.** It sees the site, not the accounts. A finding that looks critical from outside can be a known issue with a scheduled fix, a deliberate trade-off someone made for good reasons, or already sitting in an agency's backlog. Prioritising from public data risks spending a first month re-litigating decisions that were already made correctly.

So nothing here earns a mandate. It earns a conversation. Everything in the 30-day column below is a question, and the plan changes the moment real data contradicts it.

## The shape of the problem

The posting describes a function in transition. Paid and organic run through vendors and agency partners today, and the stated direction is to bring the capability fully in-house while adding an AI search visibility strategy. That transition, not campaign management, is the actual job.

Read that way, the first year has three problems in sequence: find out what is actually running, fix the structural things that cap every channel's ceiling, then take ownership without dropping performance during the handover.

## Days 1 to 30: find the truth

**Access and ownership.** Who owns each account: Google Ads, Meta, GA4, Google Tag Manager, Search Console, Business Profile, the CMS, and the call tracking. If any of those sit in an agency's account rather than EBH's, migrating ownership is the first project, because everything else is reversible and that is not. An agency relationship that ends with EBH losing its conversion history is an avoidable disaster that happens routinely.

**Baseline the numbers nobody has.** Cost per assessment scheduled by channel and by clinic. Not cost per lead. If that number does not exist yet, building it is the first deliverable, and it will require the intake system, not the ad platforms. See `docs/05-measurement-model.md`.

**Compliance read.** Which advertising pixels fire on which pages, what they receive, whether any form posts to a vendor without a BAA. `src/audits/tags.ts` gets this started from outside; finishing it takes the browser network tab and the GTM container. `docs/02-hipaa-marketing.md` sets out the regulatory position, including which part of the OCR tracking bulletin was vacated in *AHA v. Becerra* and what that does not clear.

**Capacity map.** Which clinics have open slots and which are full. Spend flowing into a clinic at capacity is the most common way a multi-site marketing budget is wasted, and it is invisible if reporting rolls up to the brand level.

## Days 31 to 90: fix what caps the ceiling

The audit in this repo, run against the live site, points at three structural items. Each caps the return on everything spent above it, which is why they come before campaign optimisation.

**One clinic, one URL.** Several clinics currently share a single location page, distinguished only by an anchor fragment. A fragment cannot be a Google Business Profile landing page, cannot rank on its own, cannot be a paid landing page, and cannot be measured separately. Every clinic after the first on a shared page is invisible to local search on its own terms. Splitting them is unglamorous and it is the highest-return work available. Highest-volume markets first.

**Structured data per clinic.** `MedicalClinic` JSON-LD with address, geo, hours, telephone, area served, and specialty. This is simultaneously the largest local-search gap and the largest AEO input, because it states facts in a form that needs no inference.

**Measurement integrity.** One event taxonomy, one book of record, one definition of a lead shared by GA4, Google Ads, and Meta. Until that exists, channel efficiency comparisons are guesses with decimal places.

Paid media in this window is defensive: keep it running, fix obvious waste, do not restructure accounts you have owned for six weeks.

## Days 91 to 180: take the wheel

- Migrate account ownership and reduce agency scope where in-house capability now exists, keeping vendors for genuinely specialised work rather than for everything
- Restructure paid search around clinic-level geo targeting against per-clinic landing pages, which the day-31-to-90 work makes possible for the first time
- Ship the content programme against the family-intent question set: the questions in `config/query-set.aba-texas.json` that currently have no page
- Weekly AEO measurement running as a tracked metric with a trend, not a one-off audit
- New-clinic launch playbook operational, running to the pre-open timeline in `docs/04-local-seo-playbook.md` rather than starting at opening day

## Two market observations from the public footprint

**The insurance mix points at a specific underserved audience.** The site names TRICARE and CHAMPVA among accepted plans, and the clinic map sits on top of Texas military geography: San Antonio (Joint Base San Antonio), El Paso (Fort Bliss), Harker Heights (Fort Cavazos), Corpus Christi (NAS Corpus Christi). TRICARE covers ABA through the Comprehensive Autism Care Demonstration, which is authorised as a demonstration programme rather than as a standard benefit and carries its own referral, authorisation, and network rules ([tricare.mil/autism](https://www.tricare.mil/autism)).

Military families are a distinct acquisition audience with a distinct problem: PCS moves break continuity of care, and a family arriving at a new duty station is searching for a provider under time pressure with an existing authorisation in hand. Nothing on the public site speaks to that search. Content and campaigns built around the PCS transition, aimed at families inbound to those four markets, address a high-intent, time-boxed, geographically predictable audience that generic "ABA therapy near me" campaigns reach late.

Confidence: moderate. The clinic footprint and payer mix are verified from the public site and TRICARE's own documentation. Whether military families are actually an under-penetrated segment for EBH is unknown from outside and is answerable in an afternoon with intake data.

**Spanish-language search in the Rio Grande Valley.** Six clinics sit in Brownsville, Edinburg, Harlingen, McAllen, and Mission. No Spanish-language content was found in the crawl. Whether that is a gap depends on the actual language mix of inquiries in those markets, which intake data would answer immediately. Confidence: low on the opportunity size, high on the absence of the content.

## How this repo gets used

It is a working tool, not a slide. `npm install && npm run recon -- audit -c config/empowerbh.json` produces a dated report against the live public site. Anyone can run it and check the findings against the pages themselves; nothing in the output depends on information the reader cannot independently verify.

Re-run it after the structural fixes above and the findings should shrink. That delta is the argument for the work, and it is measurable from outside, which is unusual for marketing recommendations.

What the tool cannot do is stated as plainly as what it can. `docs/06-limitations.md` lists every category of data that requires account access, and every finding carries a confidence level for exactly that reason.
