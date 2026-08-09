# HIPAA and healthcare digital marketing

Healthcare marketing carries a constraint most digital marketing does not. This document sets out the position the tooling encodes, with primary sources. Nothing here is legal advice, and every remediation below is a conversation with counsel and privacy before it is a ticket.

## Where the line actually sits, as of the sources cited

The relevant history matters because a lot of marketing guidance still circulating online is describing a rule that no longer stands.

**December 2022.** HHS Office for Civil Rights published a bulletin, *Use of Online Tracking Technologies by HIPAA Covered Entities and Business Associates*, taking the position that a combination of an individual's IP address with a visit to an unauthenticated public webpage about a health condition or provider triggered HIPAA obligations. Revised March 18, 2024.

**June 20, 2024.** The U.S. District Court for the Northern District of Texas, in *American Hospital Association v. Becerra*, No. 4:23-cv-1110, held that HHS exceeded its statutory authority and vacated that portion of the bulletin. The court's language, as reproduced in OCR's own guidance page, vacated the guidance to the extent it provided that HIPAA obligations are triggered where an online technology connects an individual's IP address with a visit to an unauthenticated public webpage addressing specific health conditions or healthcare providers.

**August 29, 2024.** OCR withdrew its appeal. The district court decision stands.

Primary sources:
- OCR guidance page, which carries the vacatur note: <https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/hipaa-online-tracking/index.html>
- The 45 CFR Part 164 text itself: <https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164>

## What that does and does not change

**It narrows.** Passive page-view metadata on an unauthenticated marketing page (an IP address plus the fact that someone read a page about autism) is not, on that basis alone, protected health information.

**It does not clear the field.** Four things remain true:

1. **Form submissions are not page views.** Information a parent types about their child, an insurance member ID, a diagnosis, a date of birth, a referral source, is individually identifiable health information the moment it identifies a person and relates to their care. The vacatur addressed metadata, not volunteered content. If a pixel event carries form values to an ad platform, that is a disclosure, and the platform is not a business associate.
2. **Authenticated pages were never in scope of the vacatur.** Patient portals, scheduling behind a login, anything gated.
3. **The FTC is a separate regulator with its own theory.** The Health Breach Notification Rule and Section 5 unfairness actions have produced enforcement against health companies over ad-tech disclosures independent of HIPAA. A HIPAA-clean posture is not automatically an FTC-clean one.
4. **State law is stricter in places and moving.** Washington's My Health My Data Act carries a private right of action. Texas has its own data privacy act. A provider operating in one state today may not be in one year.

## What the tooling does with this

`src/audits/tags.ts` flags the intersection, not the pixel:

- Inventories every advertising platform visible in markup and marks which are third-party ad tech
- Identifies pages carrying forms whose field names suggest intake (insurance, diagnosis, date of birth, referral, patient, child, Medicaid)
- Raises a **critical** finding only where those two overlap on the same page
- Raises a **high** finding where a form posts to a third-party origin, since that destination needs a business associate agreement

It does not assert a violation. It cannot: what a pixel actually transmits on submit is not observable from outside the account. The finding says "this combination is where the exposure lives, go look."

## The standard remediation pattern

In rough order of how much it disrupts marketing measurement, least first:

1. Strip form field values, URL query parameters, and referrer strings from client-side pixel payloads on intake pages.
2. Move conversion measurement server-side, so the ad platform receives a conversion signal and nothing describing the person.
3. Suppress third-party ad tech entirely on authenticated pages and on any page that renders patient-specific content.
4. Execute BAAs where a vendor genuinely needs to process regulated data, and drop the vendor where it does not.
5. Rebuild remarketing and customer-match audiences so they are not derived from patient status.

Measurement gets harder under all five. That trade is the job, and the argument for making it is that the alternative is an OCR investigation, an FTC action, or a class action under state law, any of which costs more than the attribution.

## Advertising policy, separate from HIPAA

Google Ads restricts personalised advertising around health conditions, and Meta removed detailed health-related targeting options. These are platform policies, enforced by account suspension rather than by a regulator. They constrain audience strategy independently of anything above, and they are why healthcare paid media leans on geography, intent keywords, and creative rather than on audience attributes. Verify current policy text before building any audience: both platforms revise these pages without notice.

## Why the distinction matters

"HIPAA" often functions as a reason legal says no, without much shared understanding of where the line actually falls. Knowing which part of the OCR bulletin survives, why the vacatur narrowed metadata but not form content, and where the FTC picks up what HIPAA drops is the difference between a marketing function that stalls on compliance and one that ships inside it.
