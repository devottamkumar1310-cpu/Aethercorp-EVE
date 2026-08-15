# EVE — XPrize / Gemini Hackathon Demo Video Script

**Format:** Screen recording + voiceover
**Length:** 3:00 (tight — see cut list at bottom if you land over)
**Goal:** Show Gemini doing real reasoning on top of deterministic business math, not chatting freely — and show it solving a real, high-stakes problem (D2C fashion founders bleeding capital on stockouts and dead stock).

Pacing target: ~140–150 spoken words per 30-second block. Read each block out loud once before recording — trim if you run long, don't speed-talk.

---

## 0:00–0:20 | Cold open — the problem (screen: black slide or landing page, no cursor movement)

**VO:**
"Every direct-to-consumer fashion brand loses money two ways: stockouts that cost them sales, and dead stock that locks up cash they don't have. Most founders find out about both after it's too late — buried in a spreadsheet, weeks late. We built EVE to catch it before it happens, and to explain *why*, in plain English, using Gemini."

*(Action: cut to EVE landing page / logo for the last 3 seconds)*

---

## 0:20–0:50 | What EVE actually is (screen: dashboard empty state)

**VO:**
"EVE is an autonomous business operating system for D2C founders. Underneath, it's not a chatbot with a spreadsheet bolted on. EVE runs deterministic Python financial models — reorder points, safety stock, price elasticity, margin math — and then hands the *results* of that math to Gemini, which acts as the reasoning and explanation layer across a team of specialized agents: inventory, pricing, sourcing, and an executive orchestrator that routes between them."

*(Action: upload the master CSV — inventory, sales, costs — live, in one drag-and-drop)*

**VO (continue, as upload completes):**
"One spreadsheet in. Full operating picture out."

---

## 0:50–1:40 | The dashboard comes alive (screen: refresh into populated dashboard)

**VO:**
"This is the founder dashboard, right after that upload. EVE has already found $6,700+ in immediate margin opportunity. Look at Inventory Intelligence: EVE isn't just showing stock counts — it's predicting that this T-shirt SKU stocks out in exactly three days, and it's already calculated the precise reorder quantity, factoring in lead time and sell-through velocity. Over in Pricing, EVE flagged high-velocity items about to run out and recommended a tactical price increase — capturing margin instead of leaving it on the table."

*(Action: click through Inventory Intelligence tab, then Pricing & Margin tab — 2–3 seconds each, let the numbers be visible)*

**VO:**
"None of these numbers came from a language model guessing. They came from the Python engine. Gemini's job starts *after* the math is done."

---

## 1:40–2:25 | Gemini in action — the CEO chat (screen: chat console)

**VO:**
"Here's where Gemini earns its place. Let's ask the AI executive a real question."

*(Action: type "How healthy is my inventory?" into the chat, hit send, let the response stream on screen)*

**VO (while response streams):**
"Watch what happens. The Executive Orchestrator doesn't let Gemini free-associate. It takes the exact metrics our BI engine already computed — stockout timing, capital locked in dead stock, margin exposure — injects them straight into Gemini's context, and Gemini's only job is to turn that structured data into a clear, founder-ready briefing. It's grounded reasoning, not hallucinated math."

*(Action: scroll to show the "Data Used" / reasoning panel if visible)*

---

## 2:25–2:50 | Under the hood — multi-agent orchestration (screen: Agent Activity Monitor)

**VO:**
"For the technical judges: that one question triggered real orchestration. The executive agent evaluated its own registry of specialized agents, decided this needed the Inventory agent specifically, and routed the task — all visible right here in the event trace. This is a scalable, event-driven multi-agent framework built on Gemini, ready to add marketing, logistics, and finance agents without touching the core."

*(Action: brief scroll through the event bus / trace log — 4–5 seconds max)*

---

## 2:50–3:00 | Close (screen: dashboard hero view or logo)

**VO:**
"EVE turns raw operational data into decisions a founder can act on today — with Gemini as the layer that makes deterministic business intelligence sound like a trusted advisor, not a spreadsheet. This is EVE."

*(Action: hold on logo / URL card for last 2 seconds)*

---

## Shot list / recording checklist
1. `eve_mvp.db` reset to a clean state before recording (no stale demo data visible in early shots).
2. Backend running (`uvicorn app.main:app --reload`, port 8000) — confirm Gemini API key/quota is live, not mocked, before hitting record.
3. Frontend running (`npm run dev`, port 3000).
4. Master CSV ready to drag-and-drop live (don't pre-upload — the empty-state-to-populated moment is the strongest visual beat).
5. Chat question typed live, not pasted — pasting reads as staged.
6. Record screen and mic separately if possible; do 2–3 voiceover takes per block and pick the cleanest, rather than trying one unbroken take.
7. Keep the cursor still during VO-only beats (0:00–0:20) — motion without a reason reads as sloppy.

## If you're running over 3:00 — cut in this order
1. Trim the "Under the hood" event-trace beat to 15s (technical judges will read the on-screen trace even if you talk fast).
2. Drop the second sentence of the cold open ("Most founders find out...") — the problem lands in one sentence.
3. Cut the Pricing & Margin tab click-through; keep only Inventory Intelligence as the deterministic-math proof point.

Do **not** cut the Gemini chat beat (1:40–2:25) or the "grounded reasoning, not hallucinated math" line — that's the single sentence a Gemini-track judge is listening for.
