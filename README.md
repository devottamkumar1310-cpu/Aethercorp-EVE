# EVE - AI Business Operating System

> An AI-powered executive operating system that helps founders manage operations, documents, analytics, and business decisions from a single workspace.

## Why EVE?

Small and growing businesses often operate across spreadsheets, invoices, inventory systems, CRMs, accounting tools, and messaging platforms.

EVE brings these workflows together into a unified AI-powered workspace.

Instead of manually analyzing reports and documents, founders can ask EVE questions and receive actionable business insights.

---

## Core Features

### AI COO Workspace

* Multi-agent executive intelligence
* Strategic recommendations
* Executive conversation history
* Business decision support

### Document Intelligence

* Invoice processing
* Purchase order analysis
* Receipt extraction
* Validation and quality scoring
* AI-powered document insights

### Business Operations

* Client management
* Project tracking
* Task management
* Inventory monitoring
* Financial tracking

### Executive Intelligence

* Business health scoring
* Risk detection
* Opportunity identification
* Executive daily brief

### User Ownership & Lifecycle

* Multi-tenant workspaces
* Account deletion
* Workspace deletion
* Demo environments
* Tenant isolation

---

## Architecture Overview

Frontend:

* Next.js 15
* React
* Tailwind CSS
* Shadcn UI

Backend:

* FastAPI
* SQLAlchemy
* PostgreSQL (Supabase)

AI Layer:

* Multi-Agent COO Architecture
* Document Intelligence Engine
* Executive Intelligence Engine

Infrastructure:

* Vercel
* Google Cloud Run
* Google Cloud Storage

---

## Project Structure

Aethercorp-EVE/

├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── dashboard/
│   │   │   ├── login/
│   │   │   ├── onboarding/
│   │   │   └── settings/
│   │   │
│   │   ├── components/
│   │   ├── services/
│   │   └── types/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   ├── business_intelligence/
│   │   │   └── document_intelligence/
│   │   │
│   │   ├── models/
│   │   ├── schemas/
│   │   └── core/
│   │
│   ├── tests/
│   └── alembic/
│
├── docs/
│   ├── architecture/
│   ├── audits/
│   ├── releases/
│   └── testing/
│
├── README.md
├── CHANGELOG.md
└── ROADMAP.md

---

## Current Status

Version: v0.10.0-rc1

Status:

* Private Beta Candidate
* Core Systems Operational
* User Testing Phase

---

## Roadmap

Completed:

* Multi-Tenant Architecture
* Business Operations Engine
* AI COO Workspace
* Document Intelligence
* Executive Dashboard
* Conversation History
* User Lifecycle Management

Upcoming:

* Cloud Run Migration
* Performance Optimization
* Executive Forecasting
* Public Beta

---

## Local Development

Frontend

cd frontend
npm install
npm run dev

Backend

cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
