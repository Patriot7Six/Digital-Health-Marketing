# Measurement model

Full-funnel conversion tracking, executive dashboards, and reporting on cost per acquisition all fail for the same reason: nobody agreed what a conversion was before the tags went in.

## The funnel

For a clinic-based ABA provider, the stages that matter are:

| Stage | Definition | Where it is measured |
|---|---|---|
| Reach | Impression or session | GA4, ad platforms |
| Inquiry | Form submitted or call placed | GA4 event, call tracking |
| Qualified inquiry | Right service, right market, plausible payer | CRM or intake |
| Insurance verified | Benefits confirmed | Intake |
| Assessment scheduled | Appointment on the calendar | Intake or EMR |
| Assessment completed | Attended | EMR |
| Treatment started | Authorised and in service | EMR |

**The real acquisition metric is cost per treatment start**, or at minimum cost per assessment scheduled. Cost per form fill is a vanity number in this category, because the gap between a form fill and a start is enormous and varies wildly by payer, by market, and by clinic capacity.

That number cannot be produced from advertising data alone. It requires a join between the ad platform and the intake system, which means a lead identifier that survives the whole path. Getting that identifier defined and populated is usually the highest-value first project in a role like this, and it is unglamorous enough that it often goes undone for years.

## Attribution, stated honestly

Last-click will over-credit branded search and under-credit everything that created the demand. Data-driven attribution in GA4 is better but is a black box you cannot audit. Neither survives the reality that a parent's path here runs weeks, crosses devices, includes a pediatrician's recommendation and a conversation in a Facebook group, and ends in a phone call.

The workable position:

1. Report last non-direct click as the operational number, because it is stable and comparable week to week
2. Hold incrementality tests, geo holdouts on paid social and on brand search, as the truth check, run quarterly
3. Never present modelled conversions and observed conversions in the same column without labelling which is which

That third rule is the one that keeps a marketing function credible with a CFO.

## Event taxonomy

Define once, use everywhere. GA4, Google Ads, and Meta must count the same thing or the CPA comparison across channels is meaningless.

| Event | Fires when | Parameters |
|---|---|---|
| `lead_form_start` | First field focused | `form_id`, `clinic_id`, `market` |
| `lead_form_submit` | Successful submission | `form_id`, `clinic_id`, `market`, `service_line` |
| `phone_click` | `tel:` link clicked | `clinic_id`, `market`, `number_type` |
| `call_connected` | Tracked call over threshold duration | `clinic_id`, `market`, `source` |
| `location_page_view` | Any clinic page | `clinic_id`, `market` |
| `insurance_check` | Insurance page or verification widget | `payer` (if selected) |
| `waitlist_join` | Pre-open waitlist form | `clinic_id`, `market` |

**No parameter carries anything about an identifiable person.** No name, no email, no date of birth, no diagnosis, no member ID, no free-text field values. `clinic_id` and `market` are business dimensions, not personal ones. See `docs/02-hipaa-marketing.md` for why this constraint is not negotiable and what it costs.

## Executive dashboard

One page. If it needs scrolling, it is a report, not a dashboard.

- Cost per assessment scheduled, this month vs last, by channel
- Inquiries by clinic against that clinic's capacity, so the reader can see where spend is going into a full schedule
- Channel mix: spend share against start share, which shows misallocation faster than any efficiency metric
- Organic sessions and inquiries by market, trended
- Share of answer trend from the AEO runs
- Open clinics under-performing their market's median, named

## Reconciliation discipline

Ad platforms report conversions on a different basis than GA4, which reports on a different basis than the CRM. All three will disagree, permanently, and the disagreement is not a bug to be fixed.

Pick one system as the book of record. For an acquisition function accountable to a P&L, that is the CRM or intake system, not the ad platform. Report from it, use the ad platforms for in-flight optimisation only, and publish the variance between them monthly so nobody is surprised by it in a board meeting.
