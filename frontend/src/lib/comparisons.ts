/**
 * Comparison page data.
 *
 * EDITORIAL RULES — these are not style preferences, they are what keeps these
 * pages defensible and citable:
 *
 * 1. Every factual claim about a competitor carries a source in `sources`.
 *    Unsourced claims do not go in this file.
 * 2. `strengths` is mandatory and must be genuine. A comparison page that says
 *    the competitor is bad at everything is not credible to a reader and is
 *    treated as low-quality by answer engines. It also happens to be untrue:
 *    these are good products with real, satisfied customers.
 * 3. EVE's pricing is not announced. NOTHING here may claim EVE is cheaper,
 *    costs less, or undercuts anyone. Competitor pricing is reported as
 *    publicly documented, and the comparison is on approach, not price.
 * 4. EVE capability claims are limited to what the product actually does
 *    (see SoftwareApplication.featureList in app/layout.tsx).
 */

export type Comparison = {
  slug: string;
  competitor: string;
  /** Used in <title>. Kept short — titles truncate around 60 chars in SERPs. */
  titleSuffix: string;
  metaDescription: string;
  /** One-sentence factual statement of what the competitor is. */
  whatItIs: string;
  /** Genuine strengths. Required. */
  strengths: string[];
  /** Documented, sourced considerations — not opinion. */
  considerations: { point: string; source?: string }[];
  /** How EVE approaches the same problem. Approach, not superiority. */
  eveApproach: string[];
  /** Who each tool suits. Honest routing — sends unfit readers elsewhere. */
  bestFor: { them: string; eve: string };
  faqs: { q: string; a: string }[];
  sources: { label: string; url?: string }[];
};

export const COMPARISONS: Comparison[] = [
  {
    slug: "stocky",
    competitor: "Stocky",
    titleSuffix: "Stocky Alternative",
    metaDescription:
      "Stocky shuts down permanently on 31 August 2026. What Shopify merchants lose, what to export before the deadline, and how EVE's variant-level forecasting compares.",
    whatItIs:
      "Stocky was Shopify's own inventory and purchase-order app, provided free to Shopify POS Pro users. It is being retired: Shopify removed it from the App Store on 2 February 2026, and it stops functioning entirely on 31 August 2026.",
    strengths: [
      "It was free with Shopify POS Pro, which made it the default starting point for thousands of merchants.",
      "Purchase order creation and supplier management were solid for straightforward replenishment.",
      "Being first-party, it required no third-party data sharing or separate billing.",
    ],
    considerations: [
      {
        point:
          "Stocky stops working entirely on 31 August 2026. All Stocky APIs cease to function, and any data not exported before that date is lost.",
        source: "Shopify Stocky sunset notice",
      },
      {
        point:
          "Inventory transfers and some forecasting features were already removed on 7 July 2025, ahead of the full shutdown.",
        source: "Shopify Stocky sunset notice",
      },
      {
        point:
          "It was removed from the Shopify App Store on 2 February 2026, so no new installations are possible.",
        source: "Shopify App Store",
      },
    ],
    eveApproach: [
      "EVE forecasts at variant level — every size and colour separately — rather than at product level.",
      "EVE reads your Shopify sales history directly, so setup does not require an implementation project.",
      "EVE reports stockout risk and the capital tied up in dead stock as explicit numbers.",
    ],
    bestFor: {
      them:
        "Stocky is no longer a viable choice for any merchant, because it stops functioning on 31 August 2026.",
      eve: "Shopify fashion brands that need variant-level forecasting rather than product-level reordering.",
    },
    faqs: [
      {
        q: "When exactly does Stocky shut down?",
        a: "Stocky stops functioning entirely on 31 August 2026. It was removed from the Shopify App Store on 2 February 2026, and inventory transfers plus some forecasting features were removed earlier, on 7 July 2025.",
      },
      {
        q: "What happens to my Stocky data?",
        a: "Any data you have not exported before 31 August 2026 is lost, and all Stocky APIs stop working after that date. Shopify's guidance is to export your data before the deadline.",
      },
      {
        q: "Why is Shopify discontinuing Stocky?",
        a: "Shopify has described the retirement as part of consolidating POS features and moving inventory capabilities directly into Shopify Admin.",
      },
      {
        q: "What should Shopify merchants use instead of Stocky?",
        a: "Shopify's built-in Admin inventory tools cover basic stock management. Merchants who need demand forecasting — particularly fashion brands managing many size and colour variants — generally need a dedicated forecasting tool, which is the category EVE is built for.",
      },
    ],
    sources: [
      { label: "Shopify Stocky sunset notice and App Store removal (2026)" },
    ],
  },
  {
    slug: "inventory-planner",
    competitor: "Inventory Planner by Sage",
    titleSuffix: "Inventory Planner Alternative",
    metaDescription:
      "How EVE compares to Inventory Planner by Sage for Shopify fashion brands — forecasting approach, pricing model, and what merchants report publicly.",
    whatItIs:
      "Inventory Planner by Sage is a long-established inventory forecasting and replenishment platform for ecommerce, acquired by Sage and used across a wide range of retail and DTC businesses.",
    strengths: [
      "Deep, mature feature set — merchants frequently describe it as covering nearly every planning scenario they need.",
      "Strong multi-channel and multi-warehouse support, including Amazon FBA and 3PL integrations.",
      "Long track record with retailers running hundreds of vendors and thousands of SKUs.",
      "Named support staff are repeatedly praised by name in public reviews.",
    ],
    considerations: [
      {
        point:
          "Pricing moved to a custom-quote model after the Sage acquisition, with publicly reported starting points around $245/month and multiple merchants reporting substantial increases.",
        source: "Public Shopify App Store reviews and third-party pricing coverage",
      },
      {
        point:
          "Merchants have publicly reported annual contract commitments and renewal-time price increases.",
        source: "Shopify App Store review, Parker Clay",
      },
      {
        point:
          "A merchant publicly reported a sync failure beginning end of September 2025 that left the product unusable for 21+ days after an annual prepayment.",
        source: "Shopify App Store review, Morning Lavender (20 October 2025)",
      },
      {
        point:
          "The interface is frequently described as powerful but complex, with a meaningful learning curve.",
        source: "Multiple public Shopify App Store reviews",
      },
    ],
    eveApproach: [
      "EVE is scoped deliberately narrowly: variant-level forecasting for Shopify fashion brands, rather than a general multi-channel planning suite.",
      "EVE reads your Shopify sales history directly, with no implementation project required to get a first forecast.",
      "EVE reports stockout risk and trapped dead-stock capital at size and colour level.",
    ],
    bestFor: {
      them:
        "Established retailers with multi-warehouse, multi-channel operations and dedicated planning staff who will use the depth.",
      eve: "Founder-led Shopify fashion brands past spreadsheet accuracy but short of needing an enterprise planning suite.",
    },
    faqs: [
      {
        q: "How much does Inventory Planner by Sage cost?",
        a: "Inventory Planner uses a custom-quote pricing model following the Sage acquisition. Publicly reported starting points are around $245/month, and several merchants have publicly reported significant increases at renewal. Confirm current pricing directly with Sage.",
      },
      {
        q: "Is Inventory Planner good for fashion brands?",
        a: "It is capable and widely used, including by apparel businesses. The most common consideration fashion brands raise publicly is cost relative to the size of their operation, and setup complexity when the priority is simply forecasting size and colour variants.",
      },
      {
        q: "What is the main difference between EVE and Inventory Planner?",
        a: "Scope. Inventory Planner is a broad, mature multi-channel planning platform. EVE is deliberately narrow — variant-level demand forecasting for Shopify fashion brands, with setup directly from Shopify sales history.",
      },
    ],
    sources: [
      { label: "Public Shopify App Store reviews for Inventory Planner by Sage" },
      { label: "Third-party pricing coverage of Inventory Planner post-Sage acquisition" },
    ],
  },
  {
    slug: "prediko",
    competitor: "Prediko",
    titleSuffix: "Prediko Alternative",
    metaDescription:
      "How EVE compares to Prediko for Shopify inventory forecasting — approach, pricing model, and what each tool is built for.",
    whatItIs:
      "Prediko is a modern Shopify-native inventory management and demand forecasting app, with additional capability around raw materials and bills of materials for brands that manufacture.",
    strengths: [
      "Modern, well-regarded interface — frequently cited as easier to learn than legacy planning tools.",
      "Raw materials and bill-of-materials planning, which matters for brands manufacturing their own products.",
      "Fast onboarding and responsive support, named repeatedly in public reviews.",
      "Transparent published pricing, unusual in this category.",
    ],
    considerations: [
      {
        point:
          "Published pricing starts around $49/month on a GMV-banded model, with a raw-materials add-on reported at around $20/month.",
        source: "Prediko published pricing and third-party review coverage",
      },
      {
        point:
          "At least one apparel merchant publicly noted that no tool they had tried, including during Prediko evaluation, fully suited scaling fashion inventory across many size and colour variants.",
        source: "Shopify App Store review, Thats So Fetch AU",
      },
    ],
    eveApproach: [
      "EVE focuses specifically on the fashion variant matrix — size and colour velocity tracked separately rather than aggregated to style level.",
      "EVE reports the capital trapped in dead stock as an explicit figure alongside stockout risk.",
      "EVE reads Shopify sales history directly, without a separate materials-planning layer to configure.",
    ],
    bestFor: {
      them:
        "Brands that manufacture and need raw materials, BOM, and production planning alongside finished-goods forecasting.",
      eve: "Shopify fashion brands whose core problem is variant-level demand, not materials planning.",
    },
    faqs: [
      {
        q: "How much does Prediko cost?",
        a: "Prediko publishes GMV-banded pricing starting at approximately $49/month, with a raw materials and BOM add-on reported at around $20/month. Confirm current rates on Prediko's pricing page.",
      },
      {
        q: "Is Prediko or EVE better for a fashion brand?",
        a: "It depends on whether you manufacture. Prediko's raw materials and BOM planning is genuinely useful for brands producing their own goods. EVE is narrower and focuses on variant-level demand forecasting for size and colour matrices.",
      },
    ],
    sources: [
      { label: "Prediko published pricing page" },
      { label: "Public Shopify App Store reviews for Prediko" },
    ],
  },
  {
    slug: "assisty",
    competitor: "Assisty",
    titleSuffix: "Assisty Alternative",
    metaDescription:
      "How EVE compares to Assisty for Shopify inventory reporting and forecasting — reporting depth, plan structure, and what each is built for.",
    whatItIs:
      "Assisty is a Shopify inventory management and reporting app known for highly customisable reports and hands-on support building them for merchants.",
    strengths: [
      "Exceptionally flexible custom reporting — merchants repeatedly report the team building bespoke reports on request.",
      "Very frequently praised support, with individual staff named across many public reviews.",
      "Broad reporting coverage across inventory, sales, and vendor data.",
      "Free trial available before committing.",
    ],
    considerations: [
      {
        point:
          "A merchant publicly reported that forecasting features they needed were not shown during the demo and turned out to sit behind a higher-priced plan.",
        source: "Shopify App Store review, Guilt & Class",
      },
      {
        point:
          "Several reviewers describe the volume of available data as initially overwhelming, requiring an onboarding call to navigate.",
        source: "Multiple public Shopify App Store reviews",
      },
    ],
    eveApproach: [
      "EVE is opinionated rather than configurable: it answers what is about to stock out and where capital is trapped, instead of providing a reporting toolkit to build that answer yourself.",
      "Forecasting is the core product, not a capability positioned on a higher tier.",
      "Variant-level size and colour velocity is the default view, not a custom report to request.",
    ],
    bestFor: {
      them:
        "Merchants who want highly customisable reporting and will use a support team to build reports around their specific workflow.",
      eve: "Fashion founders who want the forecasting answer directly rather than a report builder.",
    },
    faqs: [
      {
        q: "Does Assisty do inventory forecasting?",
        a: "Assisty provides inventory forecasting and reporting features. One merchant publicly reported that specific forecasting functionality they needed sat on a higher plan than the one demonstrated to them, so confirm which features are included in the tier you are quoted.",
      },
      {
        q: "What is the difference between EVE and Assisty?",
        a: "Assisty is broad and highly customisable, oriented around building the reports you ask for. EVE is narrow and opinionated, built to answer variant-level stockout and dead-stock questions for fashion brands by default.",
      },
    ],
    sources: [{ label: "Public Shopify App Store reviews for Assisty" }],
  },
  {
    slug: "fabrikator",
    competitor: "Fabrikatör",
    titleSuffix: "Fabrikatör Alternative",
    metaDescription:
      "How EVE compares to Fabrikatör for Shopify inventory planning — backorders, purchase orders, forecasting approach, and pricing considerations.",
    whatItIs:
      "Fabrikatör is a Shopify inventory planning tool combining demand forecasting, purchase order automation, and backorder and pre-order management.",
    strengths: [
      "Backorder and pre-order handling is a genuine differentiator and repeatedly singled out by merchants.",
      "Strong purchase order workflow — merchants report supplier ordering dropping from hours to minutes.",
      "Handles large variant counts well, with merchants citing thousands of SKUs.",
      "Consistently praised, responsive support team.",
    ],
    considerations: [
      {
        point:
          "One merchant publicly described their cost as roughly $6,000 per year and questioned long-term viability at that price for their business size.",
        source: "Shopify App Store review, LUMIÈRE DESIGN",
      },
    ],
    eveApproach: [
      "EVE does not manage purchase orders or backorders; it focuses on the forecasting question that precedes them.",
      "EVE reads Shopify sales history directly, with variant-level size and colour velocity as the default view.",
      "EVE surfaces dead-stock capital alongside stockout risk, so buying decisions account for both.",
    ],
    bestFor: {
      them:
        "Brands that need integrated purchase order automation and backorder or pre-order management as a core workflow.",
      eve: "Brands whose primary gap is knowing what to reorder at variant level, rather than executing and tracking the orders themselves.",
    },
    faqs: [
      {
        q: "How much does Fabrikatör cost?",
        a: "Fabrikatör does not publish flat pricing for all tiers. One merchant publicly reported paying roughly $6,000 per year. Confirm current pricing directly with Fabrikatör for your catalogue size.",
      },
      {
        q: "Does EVE handle pre-orders and backorders like Fabrikatör?",
        a: "No. Backorder and pre-order management is a genuine Fabrikatör strength and is not what EVE does. EVE focuses on variant-level demand forecasting and dead-stock analysis.",
      },
    ],
    sources: [{ label: "Public Shopify App Store reviews for Fabrikatör" }],
  },
  {
    slug: "spreadsheets",
    competitor: "Spreadsheets",
    titleSuffix: "Spreadsheet Alternative",
    metaDescription:
      "When spreadsheets stop working for Shopify inventory planning — the specific failure points fashion brands hit, and what changes with variant-level forecasting.",
    whatItIs:
      "Most Shopify fashion brands start inventory planning in Excel or Google Sheets, exporting sales data and building reorder calculations manually.",
    strengths: [
      "Free, and every founder already knows how to use them.",
      "Completely flexible — a spreadsheet models exactly your business, with no vendor's assumptions imposed.",
      "Entirely under your control, with no data leaving your systems and no subscription.",
      "Genuinely sufficient at low SKU counts. Below roughly a hundred variants, a well-built sheet is hard to beat.",
    ],
    considerations: [
      {
        point:
          "Spreadsheet accuracy degrades as variant count grows. Fashion SKU counts compound multiplicatively — styles × colours × sizes — so a modest catalogue reaches four figures quickly.",
      },
      {
        point:
          "Merchants publicly describe spending hours per week maintaining reorder spreadsheets before moving to dedicated tools.",
        source: "Multiple public Shopify App Store reviews across inventory apps",
      },
      {
        point:
          "A spreadsheet reports the past accurately but does not monitor continuously — it is only correct at the moment it was last updated by hand.",
      },
    ],
    eveApproach: [
      "EVE reads Shopify sales history directly, so the underlying numbers do not need manual export and refresh.",
      "Variant-level velocity is calculated per size and colour rather than maintained by hand.",
      "Stockout risk and dead-stock capital are monitored continuously rather than recalculated when someone remembers to.",
    ],
    bestFor: {
      them:
        "Brands under roughly a hundred variants, or with unusual planning logic that no off-the-shelf tool models correctly.",
      eve: "Brands where variant count has outgrown what a person can accurately maintain by hand each week.",
    },
    faqs: [
      {
        q: "When should a Shopify brand stop using spreadsheets for inventory?",
        a: "There is no universal threshold, but the practical signal is when the sheet is no longer updated on schedule, or when stockouts and overstock are being discovered after the fact rather than predicted. For fashion brands this typically coincides with variant counts moving into the high hundreds.",
      },
      {
        q: "Are spreadsheets actually bad for inventory planning?",
        a: "No. A well-built spreadsheet is genuinely effective at small scale and gives you complete control. The failure mode is not the tool, it is that manual maintenance does not scale with a multiplying variant matrix.",
      },
    ],
    sources: [
      { label: "Public Shopify App Store reviews describing pre-tool spreadsheet workflows" },
    ],
  },
  {
    slug: "manual-inventory-planning",
    competitor: "Manual inventory planning",
    titleSuffix: "Alternative to Manual Planning",
    metaDescription:
      "Manual inventory planning versus forecasting software for Shopify fashion brands — where judgement-based reordering breaks down and what changes.",
    whatItIs:
      "Manual inventory planning means deciding what to reorder from experience, intuition, and periodic checks of what looks low, without a systematic forecast.",
    strengths: [
      "Founder judgement encodes real knowledge that no model has — upcoming campaigns, supplier issues, a style that is about to be featured.",
      "Zero cost and zero setup.",
      "Fast for a small, familiar catalogue where the founder genuinely knows every SKU.",
      "Responsive to context a forecast cannot see, such as a planned collaboration or a seasonal event.",
    ],
    considerations: [
      {
        point:
          "Judgement scales poorly across a multiplying variant matrix. Knowing every SKU is realistic at 50 variants and not at 1,500.",
      },
      {
        point:
          "Manual review is periodic, so stockouts are typically discovered after they occur rather than before.",
      },
      {
        point:
          "Dead stock accumulates quietly. Without an explicit figure for trapped capital, slow movers are easy to keep ignoring.",
      },
    ],
    eveApproach: [
      "EVE handles the systematic part — velocity, cover, and stockout risk per variant — so founder judgement is applied to decisions rather than arithmetic.",
      "Continuous monitoring means stockout risk surfaces before the stockout, not after.",
      "Dead-stock capital is stated as a number, which makes the trade-off explicit.",
    ],
    bestFor: {
      them:
        "Very small or early catalogues where the founder genuinely has full visibility, and businesses with highly irregular demand that no historical model would capture.",
      eve: "Brands where the catalogue has outgrown reliable recall, and reorder decisions have started to feel like guesses.",
    },
    faqs: [
      {
        q: "Is manual inventory planning always worse than software?",
        a: "No. At small scale, founder judgement is fast and encodes context a model cannot see. It breaks down as variant count grows past what one person can accurately track, and because review is periodic rather than continuous.",
      },
      {
        q: "Does forecasting software replace founder judgement?",
        a: "It should not. Forecasting handles velocity and cover calculations across the catalogue; the founder still decides what to buy, factoring in campaigns, cash position, and supplier realities the data does not contain.",
      },
    ],
    sources: [],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
