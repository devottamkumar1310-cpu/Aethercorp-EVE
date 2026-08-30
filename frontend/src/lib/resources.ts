import { POSITIONING } from "@/lib/config";

export interface ArticleData {
  slug: string;
  title: string;
  metaDescription: string;
  category: string;
  readTime: string;
  publishedDate: string;
  author: string;
  summary: string;
  sections: {
    h2: string;
    content: string;
    highlights?: string[];
  }[];
  targetTopicSlug: string;
  targetTopicAnchor: string;
  relatedGlossarySlugs: string[];
}

export const ARTICLES: ArticleData[] = [
  {
    slug: "predict-shopify-stockouts",
    title: "How to Predict Shopify Stockouts Before They Kill Your Growth",
    metaDescription:
      "Learn how to predict Shopify stockouts before your bestsellers hit zero. Calculate variant velocity, lead time buffers, and revenue exposure.",
    category: "Stockout Prevention",
    readTime: "6 min read",
    publishedDate: "2026-08-20",
    author: "Devottam Kumar",
    summary:
      "A stockout on a bestseller isn't just a missed order — it's wasted paid traffic, lower organic search rank, and lost customer lifetime value. Here is how to build an early warning forecast for your Shopify store.",
    sections: [
      {
        h2: "The Real Cost of Running Out of Bestsellers",
        content:
          "When a hero SKU sells out, your ad spend keeps driving visitors to a 'Sold Out' button. Most brands calculate lost revenue by multiplying out-of-stock days by average daily sales, but the true cost includes customer acquisition erosion and long-term brand equity damage.",
      },
      {
        h2: "Step 1: Calculate Variant Sales Velocity",
        content:
          "Never calculate velocity at style level. A t-shirt selling 30 units a day might sell 18 in Medium, 8 in Large, and 4 in Small. Track daily units sold per individual SKU variant over 7-day, 30-day, and 90-day moving windows.",
        highlights: [
          "Isolate SKU-level daily velocity",
          "Account for recent promo or paid traffic spikes",
          "Separate recurring core basics from limited seasonal drops",
        ],
      },
      {
        h2: "Step 2: Add Total Lead Time (Production + Transit + Docking)",
        content:
          "Supplier lead time is rarely just manufacturing time. Always include fabric sourcing, factory production, ocean/air shipping, customs clearance, and warehouse receiving. If factory lead time is 21 days and ocean transit is 14 days, your total lead time is 35 days.",
      },
      {
        h2: "Step 3: Set Your Reorder Trigger Point",
        content:
          "Reorder Point = (Daily Sales Velocity × Total Lead Time in Days) + Safety Stock. When variant inventory drops below this threshold, issue a purchase order immediately.",
      },
    ],
    targetTopicSlug: "stockout-prediction",
    targetTopicAnchor: "EVE Stockout Prediction Alerts",
    relatedGlossarySlugs: ["stockout", "sales-velocity", "lead-time", "reorder-point"],
  },

  {
    slug: "shopify-inventory-forecasting-guide",
    title: "The Complete Guide to Shopify Inventory Forecasting",
    metaDescription:
      "Master Shopify inventory forecasting. Learn variant-level demand modeling, size curve calculations, and lead time buffer management.",
    category: "Inventory Forecasting",
    readTime: "8 min read",
    publishedDate: "2026-08-18",
    author: "Devottam Kumar",
    summary:
      "Shopify native reports show current stock levels, but not future demand. This guide outlines how D2C founders transition from static spreadsheets to predictive demand forecasting.",
    sections: [
      {
        h2: "Why Excel Spreadsheets Break Down for Shopify Brands",
        content:
          "As your catalogue grows past 50 SKUs across size and colour variations, static Excel formulas become unmanageable. Manual copy-pasting of Shopify CSVs introduces human error and fails to adapt to dynamic sales velocity shifts.",
      },
      {
        h2: "The 4 Pillar Metrics of E-Commerce Inventory Forecasting",
        content:
          "Accurate inventory forecasting requires mastering four core metrics: Sales Velocity, Weeks of Cover, Supplier Lead Time, and Sell-Through Rate.",
        highlights: [
          "Sales Velocity: Daily consumption rate per SKU",
          "Weeks of Cover: How long current stock lasts",
          "Supplier Lead Time: Total replenishment turnaround",
          "Sell-Through Rate: Percentage of buy cleared",
        ],
      },
    ],
    targetTopicSlug: "shopify-inventory-forecasting",
    targetTopicAnchor: "Shopify Inventory Forecasting Software",
    relatedGlossarySlugs: ["demand-forecasting", "weeks-of-cover", "sell-through-rate", "sku"],
  },

  {
    slug: "how-much-inventory-d2c-brand",
    title: "How Much Inventory Should a D2C Brand Hold?",
    metaDescription:
      "Calculate optimal inventory levels for your D2C brand. Balance cash flow, working capital, and stockout risk without overbuying.",
    category: "Working Capital",
    readTime: "5 min read",
    publishedDate: "2026-08-15",
    author: "Devottam Kumar",
    summary:
      "Holding too much inventory locks up cash in warehouse shelves; holding too little causes stockouts. Here is the formula for finding your brand's working capital sweet spot.",
    sections: [
      {
        h2: "Understanding the Capital vs. Availability Tradeoff",
        content:
          "Every dollar tied up in inventory is a dollar unavailable for marketing, hiring, or product development. D2C brands should aim for 6 to 8 weeks of inventory cover for core products, adjusting for supplier lead times.",
      },
      {
        h2: "Calculating Optimal Target Stock Levels",
        content:
          "Target Stock Level = (Forecasted Daily Sales × (Lead Time + Review Period)) + Safety Stock. Maintaining this target keeps cash fluid while buffering against supply chain disruptions.",
      },
    ],
    targetTopicSlug: "d2c-inventory-management",
    targetTopicAnchor: "D2C Inventory Management Solutions",
    relatedGlossarySlugs: ["inventory-carrying-cost", "open-to-buy", "safety-stock", "weeks-of-cover"],
  },

  {
    slug: "calculate-weeks-of-cover",
    title: "How to Calculate Weeks of Cover for Fashion & Apparel SKUs",
    metaDescription:
      "Step-by-step guide to calculating Weeks of Cover (WOC) for fashion SKUs. Avoid stockout surprises and identify stagnant inventory early.",
    category: "Inventory Metrics",
    readTime: "5 min read",
    publishedDate: "2026-08-12",
    author: "Devottam Kumar",
    summary:
      "Weeks of Cover is the single most useful metric for e-commerce buyers. It converts abstract unit quantities into an exact operational deadline.",
    sections: [
      {
        h2: "The Formula for Weeks of Cover",
        content:
          "Weeks of Cover = Current Inventory On Hand ÷ Average Weekly Sales Velocity. If you have 200 units of a medium sweater and sell 25 units per week, you have exactly 8 weeks of cover.",
      },
      {
        h2: "Comparing Weeks of Cover to Supplier Lead Time",
        content:
          "If your Weeks of Cover drops below your supplier's total lead time (e.g., 6 weeks of cover with an 8-week factory lead time), you are already facing a stockout unless an expedited order is placed.",
      },
    ],
    targetTopicSlug: "inventory-intelligence",
    targetTopicAnchor: "EVE Inventory Intelligence Engine",
    relatedGlossarySlugs: ["weeks-of-cover", "sales-velocity", "lead-time", "stockout"],
  },

  {
    slug: "calculate-reorder-point",
    title: "How to Calculate Reorder Points (With Lead Time Variance)",
    metaDescription:
      "Master Reorder Point (ROP) calculations for Shopify inventory. Include lead time variance and safety stock buffers.",
    category: "Reorder Planning",
    readTime: "6 min read",
    publishedDate: "2026-08-10",
    author: "Devottam Kumar",
    summary:
      "Placing purchase orders too late results in stockouts; placing them too early inflates holding costs. Here is how to calculate exact Reorder Points per SKU.",
    sections: [
      {
        h2: "The Standard Reorder Point Formula",
        content:
          "Reorder Point (ROP) = (Average Daily Sales × Lead Time in Days) + Safety Stock. When your available inventory hits this number, issue your purchase order immediately.",
      },
    ],
    targetTopicSlug: "inventory-forecasting",
    targetTopicAnchor: "Inventory Forecasting Solutions",
    relatedGlossarySlugs: ["reorder-point", "safety-stock", "lead-time", "demand-forecasting"],
  },

  {
    slug: "how-to-reduce-dead-stock",
    title: "How to Identify and Eliminate Dead Stock in D2C Brands",
    metaDescription:
      "Actionable strategies to identify dead stock, recover trapped capital, and prevent non-moving inventory from draining your margins.",
    category: "Capital Recovery",
    readTime: "7 min read",
    publishedDate: "2026-08-08",
    author: "Devottam Kumar",
    summary:
      "Dead stock is cash trapped on warehouse shelves. Learn how to audit stagnant inventory, execute promotional liquidations, and reinvest capital into bestsellers.",
    sections: [
      {
        h2: "How to Audit Stagnant Inventory",
        content:
          "Flag any SKU variant that has zero sales over 60 consecutive days or carries over 26 weeks of cover. Calculate the exact COGS capital trapped in those items.",
      },
      {
        h2: "4 Clearance Strategies That Preserve Brand Value",
        content:
          "Clear dead stock without discounting hero products: 1. Bundle slow SKUs with bestsellers. 2. Offer mystery boxes. 3. Run tier-discount promotions. 4. Utilize private VIP flash sales.",
      },
    ],
    targetTopicSlug: "dead-stock-management",
    targetTopicAnchor: "Dead Stock Recovery Platform",
    relatedGlossarySlugs: ["dead-stock", "inventory-carrying-cost", "overstock", "inventory-turnover"],
  },

  {
    slug: "fashion-inventory-forecasting",
    title: "Variant-Level Inventory Forecasting for Fashion Brands",
    metaDescription:
      "Solve size curve mismatches and color velocity variations with variant-level inventory forecasting designed for fashion and apparel brands.",
    category: "Fashion Intelligence",
    readTime: "6 min read",
    publishedDate: "2026-08-05",
    author: "Devottam Kumar",
    summary:
      "Apparel products don't sell in bell curves. Learn how to calculate true size curves per category and forecast demand at variant level.",
    sections: [
      {
        h2: "The Size Curve Distortion",
        content:
          "Buying equal ratios across XS to XXL leads to severe out-of-stock conditions in popular sizes while fringe sizes sit untouched. Variant forecasting evaluates each size as an independent demand curve.",
      },
    ],
    targetTopicSlug: "fashion-inventory-management",
    targetTopicAnchor: "Fashion Inventory Management Software",
    relatedGlossarySlugs: ["size-curve", "variant-level-forecasting", "sell-through-rate", "overstock"],
  },

  {
    slug: "d2c-inventory-management-guide",
    title: "Modern D2C Inventory Management: Beyond Spreadsheets",
    metaDescription:
      "Discover modern inventory management strategies for D2C brands. Automate purchase orders, protect working capital, and scale past spreadsheets.",
    category: "Operations",
    readTime: "7 min read",
    publishedDate: "2026-08-02",
    author: "Devottam Kumar",
    summary:
      "Spreadsheets work when you have 10 products. At 500 variants, they become a liability. Here is how modern D2C operations scale inventory intelligence.",
    sections: [
      {
        h2: "Moving from Reactive Logging to Proactive Intelligence",
        content:
          "Traditional inventory systems record past transactions. Modern inventory intelligence anticipates future stockouts and generates automated reorder calls.",
      },
    ],
    targetTopicSlug: "d2c-inventory-management",
    targetTopicAnchor: "D2C Inventory Intelligence System",
    relatedGlossarySlugs: ["inventory-turnover", "abc-analysis", "open-to-buy", "reorder-point"],
  },
];
