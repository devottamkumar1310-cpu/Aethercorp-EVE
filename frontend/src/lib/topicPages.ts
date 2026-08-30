import { POSITIONING } from "@/lib/config";

export interface TopicPageData {
  slug: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  badge: string;
  introText: string;
  problemTitle: string;
  problemContent: string;
  sections: {
    h2: string;
    content: string;
    highlights?: string[];
  }[];
  faq: {
    q: string;
    a: string;
  }[];
  relatedTopics: {
    slug: string;
    anchorText: string;
  }[];
  relatedGlossarySlugs: string[];
}

export const TOPIC_PAGES: Record<string, TopicPageData> = {
  "inventory-intelligence": {
    slug: "inventory-intelligence",
    title: "AI Inventory Intelligence Platform for Shopify & D2C Brands",
    metaDescription:
      "Transform raw inventory data into executive decision intelligence. Predict stockouts, recover capital from dead stock, and automate reorder recommendations with EVE.",
    h1: "Inventory Intelligence for High-Growth D2C Brands",
    heroSubtitle:
      "Traditional inventory tools tell you what you have. EVE tells you what to do next — predicting stockout risks, calculating trapped capital, and generating size-level reorders.",
    badge: "Category Overview",
    introText:
      "Inventory intelligence is the evolution beyond traditional spreadsheets and inventory management systems (IMS). Rather than serving as a passive record of stock quantities, inventory intelligence actively converts sales velocity, supplier lead times, and variant demand into actionable financial decisions.",
    problemTitle: "Why Traditional Inventory Tracking Falls Short",
    problemContent:
      "Most e-commerce platforms show total SKU counts without context. They treat a size Small and size Extra-Large as interchangeable units, missing the fact that hero sizes sell out while fringe sizes accumulate dead stock. Inventory intelligence solves this by modeling demand at the variant level.",
    sections: [
      {
        h2: "Variant-Level Demand Forecasting",
        content:
          "EVE analyzes daily sales velocity for every individual size, color, and option group across your catalog. By isolating true demand per variant, EVE alerts founders to imminent stockouts weeks before they hit zero.",
        highlights: [
          "Variant-specific sales velocity modeling",
          "Automated lead time buffer calculations",
          "Revenue-at-risk prioritization",
        ],
      },
      {
        h2: "Dead Stock & Working Capital Recovery",
        content:
          "Carrying slow-moving inventory starves your business of cash required to purchase bestsellers. EVE calculates exact dollar valuations trapped in stagnant stock and recommends liquidation promotions or order deferrals.",
        highlights: [
          "Exact COGS dollar figures for slow inventory",
          "Weeks-of-cover thresholds to spot stagnating variants",
          "Actionable liquidation triggers",
        ],
      },
      {
        h2: "Decision Traceability & Evidence",
        content:
          "Founders cannot trust black-box AI recommendations. EVE provides full decision audit trails showing confidence scores, underlying formulas, and input sales data behind every suggested purchase order.",
      },
    ],
    faq: [
      {
        q: "What makes Inventory Intelligence different from an ERP?",
        a: "An ERP records transactions; inventory intelligence tells you what actions to take. EVE operates as an intelligence layer above your Shopify data, delivering automated reorder recommendations and cash recovery insights without complex ERP implementations.",
      },
      {
        q: "How fast can EVE analyze my store's inventory intelligence?",
        a: "EVE analyzes your catalogue in under 60 seconds from a native Shopify product export CSV. No custom code or month-long setup required.",
      },
    ],
    relatedTopics: [
      { slug: "shopify-inventory-forecasting", anchorText: "Shopify Inventory Forecasting" },
      { slug: "stockout-prediction", anchorText: "Stockout Risk Prediction" },
      { slug: "dead-stock-management", anchorText: "Dead Stock Management" },
    ],
    relatedGlossarySlugs: ["variant-level-forecasting", "weeks-of-cover", "dead-stock", "reorder-point"],
  },

  "shopify-inventory-management": {
    slug: "shopify-inventory-management",
    title: "Shopify Inventory Management & Reorder Planning Software",
    metaDescription:
      "Automate Shopify inventory management with variant-level velocity, automated stockout prevention, and size curve reordering tailored for D2C brands.",
    h1: "Shopify Inventory Management Built for Growing Brands",
    heroSubtitle:
      "Stop guessing purchase orders in spreadsheets. EVE turns native Shopify product exports into exact reorder recommendations across every size and colour.",
    badge: "Shopify Platform Solution",
    introText:
      "Shopify's built-in inventory tracking is useful for logging current quantities, but it lacks forward-looking forecasting, supplier lead time tracking, and variant-level reorder math. Growing D2C brands need proactive inventory management that protects cash flow.",
    problemTitle: "The Limits of Basic Shopify Inventory Tracking",
    problemContent:
      "Shopify native admin does not factor in supplier lead times, size curves, or velocity spikes. When a product surges in popularity, Shopify shows stock counts hitting single digits — right when it's already too late to reorder without experiencing weeks of out-of-stock downtime.",
    sections: [
      {
        h2: "Zero-Setup Shopify CSV Integration",
        content:
          "Export your product CSV directly from your Shopify Admin and drop it into EVE. EVE parses variant attributes, cost-per-item, size distributions, and historical velocity automatically.",
        highlights: [
          "Native Shopify CSV support — no column editing needed",
          "Grouped variant & SKU hierarchy detection",
          "Instant cost-of-goods (COGS) valuation",
        ],
      },
      {
        h2: "Automated Variant Reorder Schedules",
        content:
          "EVE calculates exact reorder quantities and deadlines for every SKU, aligning purchase orders with supplier minimum order quantities (MOQs) and lead times.",
      },
    ],
    faq: [
      {
        q: "Do I need to install a heavy Shopify app?",
        a: "No. EVE accepts your native Shopify CSV export directly. It operates in a secure, read-only mode so it never mutates your live storefront data.",
      },
      {
        q: "Does EVE support multi-variant products with sizes and colors?",
        a: "Yes. EVE is specifically architected for complex multi-variant catalogues with dozens of size and colour combinations.",
      },
    ],
    relatedTopics: [
      { slug: "shopify-inventory-forecasting", anchorText: "Shopify Inventory Forecasting" },
      { slug: "fashion-inventory-management", anchorText: "Fashion Inventory Management" },
      { slug: "inventory-intelligence", anchorText: "Inventory Intelligence Platform" },
    ],
    relatedGlossarySlugs: ["sku", "size-curve", "reorder-point", "sell-through-rate"],
  },

  "shopify-inventory-forecasting": {
    slug: "shopify-inventory-forecasting",
    title: "Shopify Inventory Forecasting Software & Demand Prediction",
    metaDescription:
      "Accurate Shopify inventory forecasting by variant size and colour. Predict stockouts, calculate safety stock, and optimize purchase orders.",
    h1: "Predictive Shopify Inventory Forecasting",
    heroSubtitle:
      "Forecast demand per variant size and colour before stockouts happen. Align purchase orders with supplier lead times and historical velocity.",
    badge: "Demand Forecasting",
    introText:
      "Shopify inventory forecasting is the discipline of projecting future customer demand based on historical sales velocity, seasonality, and promotional trends to determine exact replenishment dates.",
    problemTitle: "Why Straight-Line Excel Forecasting Breaks Down",
    problemContent:
      "Most founders use straight-line monthly averages in Excel. But fashion demand is non-stationary: sales spike around paydays, seasons, and marketing campaigns. Straight-line math leads to over-ordering slow sizes while under-ordering hero sizes.",
    sections: [
      {
        h2: "Dynamic Velocity & Lead Time Buffer Math",
        content:
          "EVE computes real-time daily velocity per SKU and projects the precise date stock will hit zero. By factoring in supplier lead times (e.g., 21 days production + 7 days shipping), EVE notifies you when to place purchase orders.",
        highlights: [
          "Days-of-cover countdowns per variant",
          "Supplier lead time integration",
          "Automated safety stock buffers",
        ],
      },
      {
        h2: "Size Curve & Proportion Forecasting",
        content:
          "Buying an equal ratio of S, M, L, XL guarantees stockouts in M/L and dead stock in S/XL. EVE calculates your brand's true size curve to optimize order ratios.",
      },
    ],
    faq: [
      {
        q: "How does EVE handle seasonal demand shifts?",
        a: "EVE evaluates velocity trends over multiple windows (7-day, 30-day, 90-day) so founders can detect seasonal momentum shifts early.",
      },
    ],
    relatedTopics: [
      { slug: "inventory-forecasting", anchorText: "General Inventory Forecasting" },
      { slug: "stockout-prediction", anchorText: "Stockout Risk Prediction" },
      { slug: "shopify-inventory-management", anchorText: "Shopify Inventory Management" },
    ],
    relatedGlossarySlugs: ["demand-forecasting", "sales-velocity", "size-curve", "lead-time"],
  },

  "d2c-inventory-management": {
    slug: "d2c-inventory-management",
    title: "D2C Inventory Management Software for E-Commerce Founders",
    metaDescription:
      "Protect your D2C brand's cash flow. EVE provides AI inventory intelligence, stockout alerts, and dead stock capital recovery for direct-to-consumer stores.",
    h1: "D2C Inventory Management & Working Capital Control",
    heroSubtitle:
      "In D2C, inventory is cash sitting on a warehouse shelf. EVE ensures your cash is working in your bestsellers rather than trapped in stagnant stock.",
    badge: "D2C Brand Strategy",
    introText:
      "Direct-to-consumer (D2C) brands face tight cash flow cycles. Unlike traditional wholesale brands with upfront purchase orders, D2C brands fund inventory upfront and absorb carrying costs until end-consumers purchase.",
    problemTitle: "The D2C Cash Trap: Overstock vs. Out-of-Stock",
    problemContent:
      "D2C founders constantly balance two risks: running out of bestsellers (losing paid ad ROI and customer lifetime value) versus overbuying (trapping working capital in slow inventory that forces margin-destroying sales).",
    sections: [
      {
        h2: "Capital-First Inventory Decisions",
        content:
          "EVE translates unit counts into financial metrics — showing exact COGS value trapped in slow SKUs alongside the revenue at risk from impending stockouts.",
        highlights: [
          "Financial valuation of trapped working capital",
          "Revenue exposure scoring for stockout risks",
          "Clear reorder priority recommendations",
        ],
      },
      {
        h2: "Ad Spend & Stockout Synchronization",
        content:
          "Never drive paid acquisition traffic to variants about to sell out. EVE alerts your team before stock runs low so ad spend can be redirected to healthy SKUs.",
      },
    ],
    faq: [
      {
        q: "How does EVE help D2C brands improve cash flow?",
        a: "By surfacing dead stock early so cash can be freed via promos, and by preventing stockouts on hero SKUs to maximize gross revenue.",
      },
    ],
    relatedTopics: [
      { slug: "dead-stock-management", anchorText: "Dead Stock Management" },
      { slug: "inventory-intelligence", anchorText: "Inventory Intelligence Platform" },
      { slug: "fashion-inventory-management", anchorText: "Fashion Inventory Management" },
    ],
    relatedGlossarySlugs: ["inventory-carrying-cost", "open-to-buy", "dead-stock", "inventory-turnover"],
  },

  "fashion-inventory-management": {
    slug: "fashion-inventory-management",
    title: "Fashion & Apparel Inventory Management Software",
    metaDescription:
      "Variant-level inventory management for fashion & apparel brands. Solve size curve stockouts, color velocity variances, and seasonal dead stock with EVE.",
    h1: "Fashion Inventory Management & Size Curve Intelligence",
    heroSubtitle:
      "Apparel catalogues double in complexity with every size and color. EVE delivers variant-level forecasting designed specifically for fashion brands.",
    badge: "Fashion & Apparel",
    introText:
      "Fashion inventory management requires specialized variant intelligence. A single apparel design across 5 colors and 6 sizes represents 30 distinct demand curves. Managing fashion in generic software leads to severe size mismatches.",
    problemTitle: "The Fashion Size Curve Dilemma",
    problemContent:
      "Ordering standard bell-curve size ratios leads to stockouts in core sizes (M, L) while XS and XXL accumulate dead stock. EVE calculates actual size velocity per category to ensure purchase orders reflect real buyer behavior.",
    sections: [
      {
        h2: "Variant-Level Velocity Tracking",
        content:
          "EVE tracks sales velocity down to specific SKU variants. See which size and colour combinations clear fast and which lag behind.",
        highlights: [
          "Size curve ratio optimization",
          "Colorway sales velocity analysis",
          "Seasonal sell-through rate evaluation",
        ],
      },
      {
        h2: "Seasonal Collection Replenishment",
        content:
          "Know exactly when to reorder core evergreen basics versus letting seasonal fashion styles run out cleanly without creating leftover dead stock.",
      },
    ],
    faq: [
      {
        q: "Why can't generic inventory software handle apparel sizes?",
        a: "Generic software aggregates sales at the parent product level. EVE treats every size/colour variant as an independent entity with its own depletion date.",
      },
    ],
    relatedTopics: [
      { slug: "shopify-inventory-management", anchorText: "Shopify Inventory Management" },
      { slug: "stockout-prediction", anchorText: "Stockout Risk Prediction" },
      { slug: "inventory-forecasting", anchorText: "Inventory Forecasting" },
    ],
    relatedGlossarySlugs: ["size-curve", "variant-level-forecasting", "sell-through-rate", "overstock"],
  },

  "inventory-forecasting": {
    slug: "inventory-forecasting",
    title: "AI Inventory Forecasting Software for E-Commerce & Retail",
    metaDescription:
      "Accurate AI inventory forecasting. Predict customer demand, compute safety stock buffers, and automate purchase order calculations.",
    h1: "AI-Powered Inventory Forecasting",
    heroSubtitle:
      "Replaces spreadsheet guesswork with AI demand forecasting. Calculate exact reorder points, safety stock, and lead time buffers automatically.",
    badge: "Forecasting Engine",
    introText:
      "Inventory forecasting uses historical sales data, velocity trends, and supplier lead times to predict when and how much inventory to reorder to maintain optimal stock levels.",
    problemTitle: "Why Manual Forecast Spreadsheets Fail",
    problemContent:
      "Spreadsheets are prone to broken formulas, missing lead time adjustments, and static sales assumptions. As your catalogue expands past 50 SKUs, spreadsheet maintenance becomes an error-prone full-time task.",
    sections: [
      {
        h2: "Automated Reorder Point & Safety Stock Calculations",
        content:
          "EVE automatically calculates reorder points (Reorder Point = Lead Time Demand + Safety Stock) for every item in your catalogue, ensuring POs are issued before inventory enters the danger zone.",
        highlights: [
          "Dynamic Reorder Point (ROP) formulas",
          "Safety stock buffer auto-tuning",
          "Supplier MOQ (Minimum Order Quantity) compliance",
        ],
      },
    ],
    faq: [
      {
        q: "What data does EVE need to forecast inventory?",
        a: "EVE requires historical order data, product variant details, and current stock levels — all available in a standard Shopify product export.",
      },
    ],
    relatedTopics: [
      { slug: "shopify-inventory-forecasting", anchorText: "Shopify Inventory Forecasting" },
      { slug: "stockout-prediction", anchorText: "Stockout Risk Prediction" },
      { slug: "inventory-intelligence", anchorText: "Inventory Intelligence" },
    ],
    relatedGlossarySlugs: ["reorder-point", "safety-stock", "demand-forecasting", "lead-time"],
  },

  "stockout-prediction": {
    slug: "stockout-prediction",
    title: "Stockout Prediction & Early Warning Alerts for E-Commerce",
    metaDescription:
      "Prevent out-of-stock losses. EVE predicts stockout dates weeks in advance based on variant sales velocity and supplier lead times.",
    h1: "Predictive Stockout Alerts & Early Warning System",
    heroSubtitle:
      "Never suffer an unexpected out-of-stock on your bestseller SKUs. EVE ranks stockout risks by dollar revenue exposure and alerts you early.",
    badge: "Stockout Prevention",
    introText:
      "A stockout occurs when customer demand exceeds available sellable inventory. Stockouts cost e-commerce brands up to 15% of annual revenue through lost immediate sales, wasted ad spend, and reduced customer loyalty.",
    problemTitle: "The Hidden Costs of an Out-of-Stock SKU",
    problemContent:
      "When a bestseller sells out, you lose more than the direct sale. Paid traffic continues landing on sold-out product pages, organic search rankings drop due to bounce rates, and disappointed buyers switch to competitors.",
    sections: [
      {
        h2: "Revenue-at-Risk Prioritization",
        content:
          "Not all stockouts are equal. EVE ranks impending stockouts by potential dollar loss so you can prioritize urgent factory reorders or air shipments for hero SKUs.",
        highlights: [
          "Days-to-depletion tracking per variant",
          "Revenue exposure calculations",
          "Urgent supplier reorder recommendations",
        ],
      },
    ],
    faq: [
      {
        q: "How far in advance can EVE predict a stockout?",
        a: "EVE predicts stockout dates weeks to months ahead depending on sales velocity and available stock levels, giving you ample window to reorder.",
      },
    ],
    relatedTopics: [
      { slug: "shopify-inventory-forecasting", anchorText: "Shopify Inventory Forecasting" },
      { slug: "inventory-forecasting", anchorText: "Inventory Forecasting Engine" },
      { slug: "dead-stock-management", anchorText: "Dead Stock Management" },
    ],
    relatedGlossarySlugs: ["stockout", "reorder-point", "sales-velocity", "lead-time"],
  },

  "dead-stock-management": {
    slug: "dead-stock-management",
    title: "Dead Stock Management & Working Capital Recovery",
    metaDescription:
      "Identify and eliminate dead stock. Surface cash trapped in non-moving inventory and implement smart clearance strategies with EVE.",
    h1: "Dead Stock Management & Capital Recovery",
    heroSubtitle:
      "Surface cash trapped in slow-moving inventory. EVE identifies non-moving variants, calculates exact holding costs, and suggests clearance actions.",
    badge: "Capital Optimization",
    introText:
      "Dead stock refers to inventory that has sitting unsold in warehouses past its commercial lifespan, consuming storage space and locking up vital cash flow.",
    problemTitle: "Dead Stock is a Capital Problem First",
    problemContent:
      "Founders often ignore slow-moving SKUs because they don't see the active cost. But dead stock traps capital that could be reinvested in fast-moving bestsellers, hurting overall margin and inventory turnover.",
    sections: [
      {
        h2: "Automated Dead Stock Detection & Valuation",
        content:
          "EVE monitors SKU velocity and flags variants with excessive weeks of cover. It presents the exact cash value locked in stagnant inventory.",
        highlights: [
          "Automated detection of non-moving variants",
          "Exact COGS dollar valuation of dead stock",
          "Clearance & bundle recommendation strategies",
        ],
      },
    ],
    faq: [
      {
        q: "How does EVE define dead stock?",
        a: "EVE flags items whose projected weeks-of-cover far exceed acceptable thresholds based on your catalogue velocity and lead times.",
      },
    ],
    relatedTopics: [
      { slug: "d2c-inventory-management", anchorText: "D2C Inventory Management" },
      { slug: "inventory-intelligence", anchorText: "Inventory Intelligence" },
      { slug: "stockout-prediction", anchorText: "Stockout Risk Alerts" },
    ],
    relatedGlossarySlugs: ["dead-stock", "inventory-carrying-cost", "inventory-turnover", "overstock"],
  },
};
