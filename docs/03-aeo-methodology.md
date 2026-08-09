# Answer engine optimization: how this is measured

Answer engines are increasingly where a search starts, and none of those surfaces has a rank tracker. Answers are non-deterministic, personalised, and change without notice. So the first job is to define a metric that is honest about its own noise.

## The metric: share of answer

For a fixed set of questions a parent would actually type, measure three things per question:

| Signal | Definition | Why it ranks where it does |
|---|---|---|
| **Citation** | The model retrieved and cited a page on the brand's domain | Strongest. The model read the site. Reproducible and attributable. |
| **Prominence** | Brand named in the opening third of the answer | Middle. Readers stop early; being named twelfth is close to not being named. |
| **Mention** | Brand named anywhere in the answer | Weakest. Can come from training data rather than retrieval, so it is the least controllable. |

`src/aeo/run.ts` records all three per query, plus which competitors appeared when the brand did not, plus the domains that got cited instead.

## The query set is the whole ballgame

`config/query-set.aba-therapy.json` holds 36 questions across four stages:

- **awareness**: something is wrong, no diagnosis yet ("my 3 year old isn't talking yet")
- **consideration**: diagnosis in hand, comparing options ("center based vs in home ABA")
- **decision**: ready to contact someone ("how do I start ABA therapy for my child")
- **local**: a specific market ("ABA therapy in McAllen or Edinburg Texas")

Two deliberate choices in that file.

**The questions are phrased the way parents ask them, not the way keyword tools return them.** "My 3 year old isn't talking yet, should I be worried about autism" is a real query shape in a conversational interface. "aba therapy san antonio tx" is a search-box shape. Answer engines get the first kind.

**The set is currently informed judgement, not measured demand.** It was built from the service lines and markets on the public site plus general knowledge of the category. That is stated in the file's own `notes` field. The first week with Search Console access, it gets rebuilt from real query data, and the version in the repo becomes a baseline rather than the truth.

## Known limits, stated plainly

**One model is not four surfaces.** The implemented runner uses the Anthropic API because that is what is wired up. ChatGPT, Perplexity, Gemini, and Google AI Overviews will return different answers. The architecture is provider-agnostic (`runAeo` takes a query set and returns a normalised `AeoResult[]`), and adding providers means adding a client, not rewriting the scorer. Until more than one is wired, the number is directional for the category, not a cross-platform score.

**Non-determinism is real.** Two runs of the same query return different answers. A single run is a sample. The metric that means anything is the trend across weekly runs on a fixed query set, which is why the runner writes timestamped JSON rather than a single score.

**With web search off, you are measuring training data.** With it on, you are measuring live retrieval. These are different questions and both are worth asking: `--aeo-web` toggles between them. Training-data presence moves slowly and is mostly out of your control. Retrieval presence moves with your content and your citations, and that is the lever.

**Google AI Overviews cannot be measured this way at all.** It is not exposed through an API. Measuring it means sampled manual checks or a third-party rank tracker that reports AI Overview presence. Budget for the tool or budget for the hours; there is no free version.

## What actually moves the number

In descending order of leverage, based on how retrieval-augmented answers get assembled:

1. **Rank in classic search.** Retrieval draws from the same index. Nothing about AEO replaces technical SEO; the technical findings in this repo are the foundation, not a separate workstream.
2. **Answer the question in the first 60 words of the page.** Models quote passages, not pages. A page that buries the answer under three paragraphs of positioning copy does not get quoted.
3. **Structured data.** `MedicalClinic` and `FAQPage` schema state facts in a form that needs no inference. For a multi-location provider, per-clinic `LocalBusiness` markup is also the single largest local-search gap on the current site.
4. **Third-party corroboration.** Models weight sources they already trust. Directory listings, association pages, insurer provider directories, and local press are cheaper to fix than they are to earn, and they show up in the cited-domain report the runner produces.
5. **Consistency.** Contradictory facts across your own pages (two addresses, two phone numbers, two sets of hours) make a model hedge or pick a competitor with cleaner data.

## Running it

```bash
export ANTHROPIC_API_KEY=sk-...
npm run recon -- aeo -c config/my-target.local.json --web --limit 36
```

Costs roughly one API call per query. Run weekly, keep the JSON, read the trend.
