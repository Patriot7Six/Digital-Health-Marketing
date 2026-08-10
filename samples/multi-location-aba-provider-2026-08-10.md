# Digital acquisition audit: Multi-location ABA provider

Generated 2026-08-10 22:53 UTC from publicly available data only. No account access, no analytics, no ad platform data.

## Scope

| | |
|---|---|
| Origin | https://provider.example |
| Pages crawled | 151 (150 returned 200) |
| URLs in sitemap | 149 |
| robots.txt | present |
| Skipped by robots.txt | 0 |
| Answer-engine module | not run |

## Findings by severity

| Severity | Count |
|---|---|
| critical | 1 |
| high | 4 |
| medium | 7 |
| low | 4 |
| info | 4 |

## What to fix first

1. **4 URLs hosting more than one clinic, leaving roughly 7 clinics with no page of their own** (critical) - Split each clinic onto its own indexable URL with unique title, address, phone, hours, staff, and LocalBusiness schema. Then repoint the matching Business Profile to it. Do the highest-volume markets first.
2. **2 pages sharing the title "Thank You - Provider Behavioral Health"** (high) - Write a distinct title per page. For location pages, include the clinic's city and neighbourhood.
3. **2 pages sharing the title "ABA Therapy Clinics in Texas | Provider Behavioral Health Lo…"** (high) - Write a distinct title per page. For location pages, include the clinic's city and neighbourhood.
4. **Production pages reference the non-production host Providerstg.wpengine.com** (high) - Replace absolute staging URLs with relative or production-absolute paths, and confirm the staging environment returns noindex plus HTTP auth.
5. **1 linked URL failing to return a page** (high) - Fix or 301 each URL, then correct the internal links pointing at it.

## CRITICAL

### 4 URLs hosting more than one clinic, leaving roughly 7 clinics with no page of their own

`local` · confidence: high

Each clinic appears as an anchor fragment on a shared page. A Google Business Profile landing page must be a distinct URL: a fragment does not qualify, so every clinic after the first on a shared page has no page to point its profile at, cannot rank for its own neighbourhood query, and cannot be measured separately in analytics or paid landing-page reporting.

Evidence:

```
https://provider.example/location/san-antonio-tx/ - 3 clinics: northwest_san_antonio_aba_clinic, far_west_san_antonio_aba_clinic, stone_oak_aba_clinic
https://provider.example/location/mcallen-tx/ - 2 clinics: mcallen_north_aba_clinic, mcallen_south_aba_clinic
https://provider.example/location/corpus-christi-tx/ - 2 clinics: corpus_christi_central_aba_clinic, corpus_christi_south_aba_clinic
https://provider.example/location/el-paso-tx/ - 4 clinics: el_paso_central_aba_clinic, el_paso_west_aba_clinic_, el_paso_east_aba_clinic, el_paso_far_east_aba_clinic
```

Affected URLs (4):

- https://provider.example/location/san-antonio-tx/
- https://provider.example/location/mcallen-tx/
- https://provider.example/location/corpus-christi-tx/
- https://provider.example/location/el-paso-tx/

**Recommendation.** Split each clinic onto its own indexable URL with unique title, address, phone, hours, staff, and LocalBusiness schema. Then repoint the matching Business Profile to it. Do the highest-volume markets first.

*Maps to: Manage local listing accuracy across all clinic locations, treating Google Business Profile and other directories as lead generation assets*

---

## HIGH

### 2 pages sharing the title "Thank You - Provider Behavioral Health"

`technical-seo` · confidence: high

Duplicate titles across pages compete for the same queries and give searchers no way to tell the results apart.

Evidence:

```
Thank You - Provider Behavioral Health
```

Affected URLs (2):

- https://provider.example/thank-you/
- https://provider.example/thank-you-pa/

**Recommendation.** Write a distinct title per page. For location pages, include the clinic's city and neighbourhood.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 2 pages sharing the title "ABA Therapy Clinics in Texas | Provider Behavioral Health Lo…"

`technical-seo` · confidence: high

Duplicate titles across pages compete for the same queries and give searchers no way to tell the results apart.

Evidence:

```
ABA Therapy Clinics in Texas | Provider Behavioral Health Locations
```

Affected URLs (2):

- https://provider.example/locations-draft/
- https://provider.example/locations/

**Recommendation.** Write a distinct title per page. For location pages, include the clinic's city and neighbourhood.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### Production pages reference the non-production host Providerstg.wpengine.com

`technical-seo` · confidence: high

Hard-coded staging URLs in live markup leak internal infrastructure, can serve stale assets, and occasionally get the staging environment crawled and indexed alongside production.

Evidence:

```
Providerstg.wpengine.com
```

Affected URLs (2):

- https://provider.example/partner-agencies/
- https://provider.example/service/full-time-aba-day-program/

**Recommendation.** Replace absolute staging URLs with relative or production-absolute paths, and confirm the staging environment returns noindex plus HTTP auth.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 1 linked URL failing to return a page

`technical-seo` · confidence: high

Internally linked URLs returning an error waste crawl budget and break user paths.

Evidence:

```
404 https://provider.example/blog/what-is-a%EE%80%80ba-therapy/
```

Affected URLs (1):

- https://provider.example/blog/what-is-a%EE%80%80ba-therapy/

**Recommendation.** Fix or 301 each URL, then correct the internal links pointing at it.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

## MEDIUM

### 9 pages without a meta description

`technical-seo` · confidence: high

Search engines generate a snippet from body text instead, which is rarely the sentence that converts.

Affected URLs (9):

- https://provider.example/thank-you/
- https://provider.example/thank-you-pa/
- https://provider.example/notice-of-hipaa-privacy-breach/
- https://provider.example/referral-form-copy/
- https://provider.example/sdk-snippet/
- https://provider.example/parent-resources/
- https://provider.example/parent-resources/page/8/
- https://provider.example/parent-resources/page/2/
- https://provider.example/parent-resources/page/7/

**Recommendation.** Write a description per page ending in the action you want a parent to take.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 7 pages without an H1

`technical-seo` · confidence: high

The H1 states the page topic for both readers and crawlers.

Affected URLs (7):

- https://provider.example/search-locations/
- https://provider.example/thank-you/
- https://provider.example/thank-you-pa/
- https://provider.example/notice-of-hipaa-privacy-breach/
- https://provider.example/sdk-snippet/
- https://provider.example/locations/
- https://provider.example/faq/

**Recommendation.** Add a single H1 that names the service and the market.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 4 pages under 300 words of body copy

`technical-seo` · confidence: moderate

Thin pages rarely rank for competitive terms and give answer engines nothing to quote.

Evidence:

```
https://provider.example/parent-resources/ - 288 words
https://provider.example/parent-resources/page/8/ - 288 words
https://provider.example/parent-resources/page/2/ - 291 words
https://provider.example/parent-resources/page/7/ - 292 words
```

Affected URLs (4):

- https://provider.example/parent-resources/
- https://provider.example/parent-resources/page/8/
- https://provider.example/parent-resources/page/2/
- https://provider.example/parent-resources/page/7/

**Recommendation.** Expand each page to answer the questions a visitor actually arrives with. Thin pages are also the ones answer engines skip, because there is no substantive passage to quote.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 327 images without an alt attribute

`technical-seo` · confidence: high

Missing alt text is both an accessibility defect under WCAG 1.1.1 and lost image-search context. For a provider serving families with disabilities, the accessibility side is the larger exposure.

Affected URLs (150):

- https://provider.example/
- https://provider.example/search-locations/
- https://provider.example/get-started/
- https://provider.example/insurance/
- https://provider.example/blog/
- https://provider.example/blog/how-to-teach-emotional-regulation-in-autism/
- https://provider.example/blog/teaching-kids-with-autism-to-tell-and-understand-jokes/
- https://provider.example/blog/autism-and-electronic-devices/
- https://provider.example/blog/occupational-therapy-vs-aba-therapy/
- https://provider.example/blog/autism-awareness-month/
- ... 140 more

**Recommendation.** Add descriptive alt text to content images and alt="" to decorative ones. The empty string is a deliberate signal; a missing attribute is not.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 1 location page may host more than one clinic, needs a manual check

`local` · confidence: low

These pages carry several parseable street addresses but no clinic anchor to confirm the structure. Address parsing also matches corporate footers and suite numbers, so the count below is a prompt to look, not a measurement.

Evidence:

```
https://provider.example/location/new-braunfels-tx/ - addresses parsed: 457 Landa St. Suite I New Braunfels, TX 78130 | 2115 Stephens Pl. Suite #810 New Braunfels, TX 78130 | 6222 I-10 Suite #104 San Antonio, TX 78201
```

Affected URLs (1):

- https://provider.example/location/new-braunfels-tx/

**Recommendation.** Open each page and confirm how many clinics it serves. If more than one, it belongs with the critical finding above.

*Maps to: Manage local listing accuracy across all clinic locations, treating Google Business Profile and other directories as lead generation assets*

---

### 2 phone numbers appearing across three or more location pages

`local` · confidence: moderate

A single central intake number is a reasonable operational choice, but it removes per-clinic call attribution and weakens the NAP signal for each individual profile.

Evidence:

```
(210) 346-8696 on 22 pages
(210) 579-7100 on 22 pages
```

Affected URLs (22):

- https://provider.example/location/harkerheights-tx/
- https://provider.example/location/san-antonio-tx/
- https://provider.example/location/missouri-city/
- https://provider.example/location/kingwood-tx/
- https://provider.example/location/mcallen-tx/
- https://provider.example/location/san-angelo-tx/
- https://provider.example/location/spring/
- https://provider.example/location/humble-tx/
- https://provider.example/location/new-braunfels-tx/
- https://provider.example/location/the-woodlands/
- ... 12 more

**Recommendation.** Keep central intake, but add per-clinic tracking numbers with call-tracking that preserves the real number in the Business Profile, so calls can be attributed to clinic and channel without breaking NAP.

*Maps to: Manage local listing accuracy across all clinic locations, treating Google Business Profile and other directories as lead generation assets*

---

### 10 of 36 family-intent questions have no page that addresses them

`content-gap` · confidence: moderate

By funnel stage: awareness 2, consideration 4, decision 3, local 1. These are questions a parent types before they know which provider to call. A page that answers the question is what an answer engine quotes and what an informational search result ranks.

Evidence:

```
Who diagnoses autism in children and how long does the wait take?
Is ABA therapy controversial? What do autistic adults say about it?
Center based vs in home ABA therapy, which is better for a young child?
Does Texas Medicaid cover ABA therapy for children with autism?
Does TRICARE cover ABA therapy for military families with an autistic child?
How long is the waitlist for ABA therapy in Texas?
Which ABA clinics in Texas accept TRICARE?
ABA therapy centers that accept Blue Cross Blue Shield in Texas
What should I bring to my child's first ABA assessment?
ABA therapy centers in The Woodlands and Spring Texas
```

**Recommendation.** Publish one page per uncovered question, written to be quoted: the answer in the first 60 words, then the detail. Prioritise decision-stage and local-stage gaps first, since those sit closest to an intake call.

*Maps to: Content direction to drive qualified traffic; AEO readiness*

---

## LOW

### 18 titles over 65 characters

`technical-seo` · confidence: high

Longer titles are truncated in results, so the closing words are not seen.

Affected URLs (18):

- https://provider.example/blog/Provider-spectacular-kids-partnership-missouri-city/
- https://provider.example/locations-draft/
- https://provider.example/locations/
- https://provider.example/central-el-paso-draft/
- https://provider.example/far-east-el-paso-draft/
- https://provider.example/east-el-paso-draft/
- https://provider.example/west-el-paso-draft/
- https://provider.example/parent-resources/autism-resources-for-families-in-houston/
- https://provider.example/parent-resources/autism-resources-for-families-in-dallas-fort-worth/
- https://provider.example/parent-resources/autism-resources-for-families-in-el-paso/
- ... 8 more

**Recommendation.** Front-load the distinguishing terms; keep titles near 60 characters.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 1 page with more than one H1

`technical-seo` · confidence: high

Multiple H1s dilute the topical signal, usually a theme or page-builder artefact.

Affected URLs (1):

- https://provider.example/partner-agencies/

**Recommendation.** Demote secondary H1s to H2.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### 266 image URLs containing unencoded spaces or brackets

`technical-seo` · confidence: high

Spaces and square brackets in file paths are encoded inconsistently across clients and CDNs, which produces intermittent broken images.

Evidence:

```
https://provider.example/wp-content/themes/twentytwentyone-child/assets/images/BONNET [L].png
https://provider.example/wp-content/themes/twentytwentyone-child/assets/images/Icon feather-chevron-right.png
https://provider.example/wp-content/themes/twentytwentyone-child/assets/images/PPF [R].png
```

Affected URLs (150):

- https://provider.example/
- https://provider.example/search-locations/
- https://provider.example/get-started/
- https://provider.example/insurance/
- https://provider.example/blog/
- https://provider.example/blog/how-to-teach-emotional-regulation-in-autism/
- https://provider.example/blog/teaching-kids-with-autism-to-tell-and-understand-jokes/
- https://provider.example/blog/autism-and-electronic-devices/
- https://provider.example/blog/occupational-therapy-vs-aba-therapy/
- https://provider.example/blog/autism-awareness-month/
- ... 140 more

**Recommendation.** Rename assets to lowercase hyphenated filenames and update references.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

### Open Graph image is below the size social platforms render large

`technical-seo` · confidence: high

og:image is declared at 250x250. Facebook and LinkedIn fall back to a small thumbnail below roughly 600x315, which measurably reduces click-through on shared and paid social links.

Evidence:

```
https://provider.example/wp-content/uploads/2022/07/Provider-Behavioural-Health-Logo.png
```

Affected URLs (53):

- https://provider.example/
- https://provider.example/search-locations/
- https://provider.example/get-started/
- https://provider.example/insurance/
- https://provider.example/thank-you/
- https://provider.example/thank-you-pa/
- https://provider.example/notice-of-hipaa-privacy-breach/
- https://provider.example/referral-form-copy/
- https://provider.example/contact/
- https://provider.example/partner-agencies/
- ... 43 more

**Recommendation.** Publish a 1200x630 share image and set og:image:width/height to match.

*Maps to: Own SEO strategy and organic website performance (technical SEO, on-page optimization)*

---

## INFO

### 1 tracking platform detected in markup

`tags` · confidence: moderate

Google Tag Manager (GTM-MS7VW9N) on 150/150 pages [gtm]

Evidence:

```
GTM-MS7VW9N
```

**Recommendation.** Reconcile this list against the tag manager container. Anything in the container but not firing, or firing but not in the container, is drift worth closing.

*Maps to: Lead digital analytics and performance reporting, maintaining full-funnel conversion tracking*

---

### Google Tag Manager found, GA4 measurement ID not visible in markup

`tags` · confidence: moderate

This is the expected pattern when GA4 is configured inside the container rather than hard-coded. It cannot be confirmed from outside.

Evidence:

```
GTM-MS7VW9N
```

**Recommendation.** Confirm the GA4 configuration tag and its measurement ID inside the container.

*Maps to: Lead digital analytics and performance reporting, maintaining full-funnel conversion tracking*

---

### 4 pages carrying a lead form

`tags` · confidence: high

These are the conversion surfaces the funnel model depends on. Each needs a distinct, deduplicated conversion event with a stable name across GA4, Google Ads, and Meta.

Evidence:

```
https://provider.example/search-locations/ - fields: input_28, input_29, input_29, input_29, input_29, input_29, input_29, input_29
https://provider.example/partner-agencies/ - fields: input_1, input_4, input_5, input_6, input_8
https://provider.example/career/ - fields: Part_time, Full_time, Brownsville, Mission, McAllen, HarkerHeights, Woodway, Schertz
https://provider.example/locations/ - fields: zipcode, state, name
```

Affected URLs (4):

- https://provider.example/search-locations/
- https://provider.example/partner-agencies/
- https://provider.example/career/
- https://provider.example/locations/

**Recommendation.** Define the event taxonomy in docs/05-measurement-model.md before adding tags, so paid and organic report against one definition of a lead.

*Maps to: Lead digital analytics and performance reporting, maintaining full-funnel conversion tracking*

---

### 26 questions with a plausible matching page

`content-gap` · confidence: low

IDF-weighted match against titles, headings, and meta descriptions. It confirms a page exists on the topic; it does not confirm the page ranks, or that the answer on it is any good.

Evidence:

```
My 3 year old isn't talking yet. Should I be worried about autism? -> https://provider.example/blog/autism-awareness-month/ (0.84)
What are the early signs of autism in toddlers? -> https://provider.example/blog/how-early-can-you-test-for-autism/ (0.79)
How do I get my child evaluated for autism in Texas? -> https://provider.example/blog/where-can-i-get-my-child-evaluated-for-autism/ (0.91)
What is ABA therapy and does it actually work? -> https://provider.example/blog/top-5-reasons-to-work-with-children-with-autism/ (1)
Difference between speech therapy, occupational therapy, and ABA for autism -> https://provider.example/blog/occupational-therapy-vs-aba-therapy/ (1)
How many hours a week of ABA therapy does a child need? -> https://provider.example/blog/understanding-extinction-bursts-what-parents-need-to-know/ (0.7)
What questions should I ask an ABA provider before I enroll my child? -> https://provider.example/blog/questions-to-ask-during-the-autism-evaluation-process/ (0.54)
What is the difference between a BCBA and an RBT? -> https://provider.example/blog/occupational-therapy-vs-aba-therapy/ (0.45)
```

Affected URLs (24):

- https://provider.example/blog/autism-awareness-month/
- https://provider.example/blog/how-early-can-you-test-for-autism/
- https://provider.example/blog/where-can-i-get-my-child-evaluated-for-autism/
- https://provider.example/blog/top-5-reasons-to-work-with-children-with-autism/
- https://provider.example/blog/occupational-therapy-vs-aba-therapy/
- https://provider.example/blog/understanding-extinction-bursts-what-parents-need-to-know/
- https://provider.example/blog/questions-to-ask-during-the-autism-evaluation-process/
- https://provider.example/insurance/
- https://provider.example/blog/what-is-aba-therapy/
- https://provider.example/service/full-time-aba-day-program/
- ... 14 more

**Recommendation.** Check these against real ranking data in Search Console once inside, and rewrite any that rank but do not convert.

*Maps to: Content direction to drive qualified traffic; AEO readiness*

---

## What this audit cannot see

Everything above was collected from the public web. The following require account access and are unknown until then:

- Actual traffic, sessions, and conversion rates (GA4)
- Query-level impressions, clicks, and position (Search Console)
- Ad spend, CPC, CPA, and conversion volume by campaign (Google Ads, Meta)
- Which tags fire client-side through the tag manager container
- Google Business Profile insights, review volume, and listing accuracy against the real record
- CRM and intake outcomes: which leads became scheduled assessments and which became patients
- Call volume and call quality by clinic

Nothing in this report infers any of those. Where a finding depends on data not observable from outside, its confidence is marked moderate or low.
