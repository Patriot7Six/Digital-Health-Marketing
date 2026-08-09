# Approach: digital acquisition for a multi-location healthcare provider

A method note, not a plan for anyone in particular. It sets out how I would sequence the work if I owned acquisition at a clinic group, and why, so the reasoning behind the tool in this repo is legible rather than implied.

## The problem shape

A provider running clinics across several metros is not running one acquisition programme. It is running one per market, and the ones that convert are the ones where a parent searching from their kitchen at 9pm finds a clinic eight minutes away with a phone number that works and an insurance answer on the page.

That produces a specific ordering problem. Most of what gets called SEO or paid media optimisation sits downstream of two structural questions, and working on it first wastes the budget:

1. Does each clinic have a page of its own that can rank, be pointed at by a Business Profile, and be measured separately?
2. Does one definition of a lead exist, shared by analytics, the ad platforms, and whatever the intake team uses?

Where either answer is no, channel-level tuning is optimising a number that cannot be trusted.

## Sequence

**First: find out what is actually running.** Which accounts exist, who owns them, and whether ownership sits with the company or with an agency. That last one matters more than it sounds. An agency relationship that ends with the client losing its conversion history is an avoidable disaster that happens routinely, and it is worth resolving before anything else because it is the only step that is not reversible.

**Then: baseline the number nobody has.** Cost per assessment scheduled, by channel and by clinic. Not cost per form fill. The gap between a form fill and a treatment start is enormous and varies by payer, by market, and by clinic capacity, so a cost-per-lead figure can improve while the business gets worse. Building that number usually requires joining ad platform data to the intake system, which means a lead identifier that survives the whole path. Unglamorous, frequently undone for years, and the highest-value first project in most roles like this.

**Then: capacity.** Which clinics have open slots and which are full. Spend flowing into a clinic at capacity is the most common way a multi-site marketing budget is wasted, and it is invisible if reporting rolls up to the brand.

**Then, and only then: the structural fixes.** One clinic, one URL. Structured data per clinic. A single event taxonomy. Each of these caps the return on everything spent above it.

**Paid media, in the meantime, is defensive.** Keep it running, fix obvious waste, and do not restructure accounts you have owned for six weeks.

## Where the compliance line sits

Healthcare marketing has a constraint that most digital marketing does not: some of what you would normally measure, you are not allowed to send anywhere. The regulatory position, including which part of the OCR tracking bulletin survived *AHA v. Becerra* and which part did not, is set out with primary sources in [`02-hipaa-marketing.md`](02-hipaa-marketing.md).

The practical version: measurement gets harder, and the trade is worth making. The alternative costs more than the attribution does.

## What the tool in this repo does about any of it

It answers the questions that can be answered from outside an account, and marks the rest as unknown rather than guessing. [`01-capability-map.md`](01-capability-map.md) maps each capability to the module that covers it and to what still needs access. [`06-limitations.md`](06-limitations.md) is the longer and more useful document.
