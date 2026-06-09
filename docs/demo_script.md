# EVE (Enterprise Virtual Executive) - 5-Minute Pitch & Demo Script

**Target Audience:** Hackathon Judges / Investors
**Goal:** Demonstrate that EVE is not just an "AI wrapper," but a deterministic Business Intelligence engine powered by a multi-agent orchestrated backend.
**Time:** 5 Minutes

---

## 0:00 - 1:00 | The Problem & The Pitch

**Speaker:** 
"D2C fashion brands bleed profit through two main arteries: Stockouts (missed revenue) and Dead Stock (wasted capital). Existing ERP systems are clunky, manual, and don't provide actionable intelligence. 

Meet **EVE (Enterprise Virtual Executive)**. EVE is an autonomous multi-agent operating system. It calculates deterministic business intelligence metrics (like reorder quantities and price elasticity) using Python algorithms, and then uses LLMs purely as an 'Explanation Layer' to guide the founder through an interactive dashboard."

---

## 1:00 - 2:00 | The Empty State & Data Ingestion

*(Action: Show the dashboard with an empty state. It should gracefully display 'No inventory data uploaded yet.')*

**Speaker:**
"Here is the EVE Founder Dashboard. It's clean, professional, and built for action. Right now, it's empty. Let's act as a founder and upload our latest ERP dump."

*(Action: Run the CSV upload script `python scratch/upload_test.py` which pushes `inventory.csv`, `sales.csv`, and `costs.csv` to the backend.)*

**Speaker:**
"Behind the scenes, we aren't just storing data. EVE's analytical agents instantly run sales velocity calculations, safety stock thresholds, and margin analysis."

---

## 2:00 - 3:00 | The Founder Dashboard

*(Action: Refresh the dashboard at `http://localhost:3000`)*

**Speaker:**
"Immediately, the intelligence comes to life. 
1. Look at the **Profit Impact KPI**: EVE has identified $6,710 in immediate margin opportunities.
2. In the **Inventory Intelligence Tab**, we don't just see current stock. We see deterministic predictions. EVE calculated that 'TSHIRT001' will stock out in exactly 3.0 days, and recommends a precision reorder of 595 units factoring in lead times.
3. In the **Pricing & Margin Tab**, EVE detects high-velocity items nearing stockout and suggests tactical price increases to slow velocity and capture maximum margin."

---

## 3:00 - 4:00 | Multi-Agent Orchestration (CEO Chat)

**Speaker:**
"Dashboards are great, but executives need advisors. Let's ask our CEO Agent for a breakdown."

*(Action: In the Chat Console, type `How healthy is my inventory?` and hit Send)*

**Speaker:**
"Notice the response. The LLM isn't hallucinating math. Our Python BI engine calculated the exact metrics, and injected them into the Executive Orchestrator agent's prompt. The LLM is simply summarizing the deterministic math into an executive briefing."

---

## 4:00 - 5:00 | Under the Hood (Agent Activity Monitor)

*(Action: Scroll down to the Agent Activity Monitor)*

**Speaker:**
"For the technical judges: This isn't a single prompt. Look at the **Agent Activity Monitor**. 
When I asked that question, the Executive Orchestrator evaluated its registry, discovered specialized agents (Market, Inventory, Pricing, Sourcing), and routed the task to the `inventory` agent. 

You can see the raw Event Bus JSON traces here. We've built a scalable, event-driven agentic framework that can expand to include marketing agents, logistics agents, and more.

**EVE doesn't just display data; it acts as an autonomous executive team for D2C brands. Thank you.**"

---

## Setup Requirements Before Demo:
1. Ensure `eve_mvp.db` is reset or clean.
2. Ensure Python backend is running (`uvicorn app.main:app --reload` on port 8000).
3. Ensure Next.js frontend is running (`npm run dev` on port 3000).
4. Have the upload script (`python scratch/upload_test.py`) ready to execute in a separate terminal.
