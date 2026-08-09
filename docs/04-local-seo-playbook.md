# Local search playbook for a multi-clinic provider

A provider with clinics across Texas is not running one SEO programme. It is running one per market, and the ones that convert are the ones where a parent searching from their kitchen at 9pm finds a clinic eight minutes away with a phone number that works.

## The structural rule everything else depends on

**One clinic, one indexable URL.**

A Google Business Profile points at a landing page. A URL fragment is not a landing page: `example.com/location/city/#second_clinic` and `example.com/location/city/` are the same URL to a search engine. Every clinic after the first on a shared page therefore has:

- no page its Business Profile can point at
- no ability to rank for its own neighbourhood query
- no separable analytics, so no per-clinic conversion rate
- no landing page for a geo-targeted paid campaign

`src/audits/local.ts` detects this pattern automatically by cross-referencing the fragments the site's own navigation links to against the pages that serve them. It is reported as **critical** because it caps the ceiling on every other local investment.

The fix is unglamorous and it is the highest-return work available: split each clinic onto its own URL, with unique title, address, phone, hours, staff, photos, and schema. Highest-volume markets first.

## Per-clinic page template

Each clinic page carries, at minimum:

- Clinic name including the neighbourhood, not just the city
- Full street address as crawlable text, matching the Business Profile character for character
- A clinic-specific phone number as a `tel:` link
- Hours, including how holidays and closures are handled
- Named clinicians with credentials
- Services offered at that clinic specifically, since not every site offers every programme
- Insurance accepted in that market, since payer contracts are regional
- Photos of that building, its parking, and its rooms
- Directions and landmark references a local resident would recognise
- `MedicalClinic` JSON-LD with `address`, `geo`, `telephone`, `openingHoursSpecification`, `areaServed`, `medicalSpecialty`

The insurance line matters more than it looks. "Does anyone near me take my plan" is the question that ends most searches, and answering it on the page removes a phone call from the intake queue.

## NAP consistency

Name, address, and phone must match exactly across the site, Google Business Profile, Apple Business Connect, Bing Places, insurer provider directories, and the autism-specific directories families actually use. "Suite 104" and "Ste 104" are different strings to a matching algorithm.

The tension worth naming: a single central intake number is operationally simpler and usually better for conversion, but it destroys per-clinic call attribution and weakens each profile's local signal. The resolution is dynamic number insertion that swaps the displayed number for tracking while the Business Profile keeps the real one, which preserves NAP and buys attribution. `src/audits/local.ts` flags numbers shared across three or more location pages so the trade is at least visible.

## Reviews

Reviews are a local ranking factor and the single largest conversion asset a clinic has. In behavioural health they are also a compliance minefield: responding to a review in a way that confirms someone is a patient is a disclosure. OCR has taken enforcement action against providers for exactly this.

The workable pattern is a fixed response template that thanks the reviewer, never confirms or denies a care relationship, and moves the specifics to a phone number. Train it once, apply it everywhere, and never let a clinic director improvise.

## New clinic openings

The posting names this explicitly. The sequence that works starts before the doors open, because a Business Profile takes time to verify and a page takes time to index.

**T-minus 8 weeks**
- Create the location page, live and indexable, with an "opening [month]" waitlist form
- Submit the Business Profile for verification: this is the long pole and it fails often
- Confirm which payers are contracted in that market

**T-minus 4 weeks**
- Structured data live on the page
- Listings submitted to Apple, Bing, and the autism directories
- Paid search live on a tight geo radius against high-intent terms, pointed at the location page
- Waitlist capture running, so opening day starts with a pipeline instead of zero

**T-minus 1 week**
- Business Profile verified and photos loaded
- Paid social to caregiver-relevant geo audiences, no health-condition targeting
- Referral outreach to local pediatric practices and the school district

**Open**
- Shift budget from awareness to intent as the waitlist converts
- Track cost per assessment scheduled, not cost per form fill

**Post-open, weeks 2 to 12**
- Weekly review of lead-to-assessment and assessment-to-start rates for that clinic
- Adjust spend against capacity: a clinic at capacity should not be buying more leads, and continuing to spend into a full schedule is the most common way a multi-site marketing budget gets wasted

## Measuring it

Per clinic, per month: impressions and actions from the Business Profile, organic sessions to the location page, paid sessions and spend, form fills, calls, assessments scheduled, and starts. The last two require CRM and intake data, which is where the outside-in view ends and the job begins.
