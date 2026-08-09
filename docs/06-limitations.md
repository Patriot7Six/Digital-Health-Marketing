# Limitations and collection ethics

## What this tool collects

Only what a browser loading the public site would receive:

- `robots.txt`, parsed and obeyed
- XML sitemaps referenced by `robots.txt` or found at conventional paths
- Public HTML pages, logged out, no authentication
- Optionally, generated answers from the Anthropic API for a fixed query set

## What it does not do

- No authenticated access, ever. No login, no session, no credentials.
- No bypass of any technical access control, rate limit, or bot protection.
- No scraping of platforms whose terms prohibit it. There is no LinkedIn, Google SERP, or Meta collection in this repo.
- No personal data. Phone numbers and street addresses are collected because they are business NAP records for clinic locations, not because they identify a person.
- No unbounded crawling. Page count, request rate, per-host concurrency, and response size are all capped in config.

The crawler identifies itself honestly in its User-Agent, sends no more than a couple of requests per second per host by default, and honours any `Crawl-delay` the site declares.

This restraint is a design requirement, not politeness. A tool built to demonstrate professional judgement to a prospective employer that quietly ignores `robots.txt` demonstrates the opposite.

## What outside-in data genuinely cannot tell you

Findings in the report depend on data that is not observable from outside, and every one of them is marked with a confidence level. The unknowns:

**Traffic and behaviour.** Sessions, bounce, engaged sessions, conversion rate. Nothing here estimates them.

**Search performance.** Impressions, clicks, position, query mix. All of it is in Search Console.

**Paid media.** Spend, CPC, CPA, quality score, impression share, audience definitions, negative keyword lists, creative performance.

**Client-side tags.** A static fetch sees markup, not runtime. Anything injected by a tag manager after page load is invisible. The tag inventory is a floor, not a census, and is marked moderate confidence for exactly that reason.

**What pixels actually transmit.** The HIPAA finding identifies where advertising pixels sit alongside intake forms. It cannot see the payload. That check requires the browser network tab and the container.

**Google Business Profile reality.** The tool reads the website's version of an address. Whether the listing matches, whether it is verified, whether it is suspended, how many reviews it has, and how many calls it generates all require profile access.

**Business outcomes.** Which inquiries became assessments, which assessments became starts, what a start is worth, and which clinics have capacity. The most important numbers in the entire model are the ones furthest out of reach from here.

## Methodological caveats inside the tool

- **Content-gap matching is IDF-weighted term overlap against titles, headings, and meta descriptions**, not semantic similarity and not body text. Terms are weighted by how rare they are in the corpus, because on a site with a narrow vocabulary an unweighted match reports near-total coverage regardless of what the pages answer. It still answers "does a page target this question", not "does this page rank". False gaps are expected where a page answers something in prose without saying so in a heading.
- **Address and phone extraction are regex-based** against US formats. Anything rendered inside an image, a canvas, or a JavaScript-hydrated component is missed, which will produce false "no address found" results on JS-heavy sites.
- **Clinic counting** cross-references navigation fragments against served pages, and falls back to counting distinct street addresses. A site that stacks clinics with neither anchors nor distinct addresses will undercount.
- **AEO results are a single-provider sample** and non-deterministic. See `docs/03-aeo-methodology.md`.
- **Severity is a judgement about revenue impact**, calibrated for a multi-location healthcare provider. It is not a standard, and someone else's audit tool will score the same site differently.

## Provenance

Findings state what was observed and where. Recommendations are separated from observations throughout, in the data model and in the report. Where something is inferred rather than measured, the confidence field says so.
