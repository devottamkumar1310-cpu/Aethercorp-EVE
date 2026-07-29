# EVE --- AI Business Operating System

> **AI-powered Inventory Intelligence and Business Operations platform
> for founder-led D2C brands.**

![Status](https://img.shields.io/badge/Status-Private_Beta-blue)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1)

------------------------------------------------------------------------

## Overview

EVE helps growing businesses transform inventory, operational, and
business data into actionable executive insights.

Instead of switching between spreadsheets, invoices, dashboards, and
disconnected business tools, founders can use a single AI-powered
workspace to understand inventory performance, monitor operational
health, analyze business documents, and make better decisions.

------------------------------------------------------------------------

# Why EVE

Growing businesses don't suffer from a lack of data---they suffer from
fragmented data.

EVE combines:

-   Inventory Intelligence
-   Business Intelligence
-   Document Intelligence
-   Executive AI
-   Operational Workspaces

into one unified platform.

------------------------------------------------------------------------

# Core Capabilities

## Inventory Intelligence

-   Stockout risk detection
-   Dead stock analysis
-   Reorder recommendations
-   Inventory health monitoring
-   Margin & profitability analysis

## AI Executive Assistant

-   Natural language business conversations
-   Executive summaries
-   Strategic recommendations
-   Multi-agent orchestration
-   Conversation history

## Document Intelligence

-   Invoice processing
-   Purchase order analysis
-   Receipt extraction
-   OCR pipeline
-   AI document insights

## Business Operations

-   Client management
-   Project tracking
-   Task management
-   Financial overview

------------------------------------------------------------------------

# AI Architecture

``` text
Founder
    │
    ▼
AI Executive Assistant
    │
    ▼
Agent Orchestrator
    │
    ├── Inventory Analysis
    ├── Financial Analysis
    ├── Pricing Analysis
    ├── Supplier Intelligence
    └── Market Intelligence
    │
    ▼
Read-only Tool Registry
    │
    ▼
Business Intelligence Engine
    │
    ▼
PostgreSQL
```

------------------------------------------------------------------------

# Security

EVE follows a secure-by-design architecture.

-   Read-only AI tool architecture
-   JWT authentication
-   Multi-tenant isolation
-   Role-based authorization
-   Server-side permission enforcement
-   Prompt injection protection

The AI assistant analyzes data and generates recommendations. It does
not perform destructive account or workspace operations.

------------------------------------------------------------------------

# Technology Stack

  Layer            Technology
  ---------------- ------------------------------------------------
  Frontend         Next.js, React, Tailwind CSS
  Backend          FastAPI, SQLAlchemy
  Database         PostgreSQL (Supabase)
  AI               Google Gemini
  Infrastructure   Vercel, Google Cloud Run, Google Cloud Storage

------------------------------------------------------------------------

# Repository Structure

``` text
EVE/
├── frontend/
├── backend/
│   ├── agents/
│   ├── routes/
│   ├── services/
│   ├── models/
│   └── core/
├── docs/
├── tests/
├── README.md
└── ROADMAP.md
```

------------------------------------------------------------------------

# Current Status

-   Private Beta
-   Core platform operational
-   Active product validation
-   Continuous development

------------------------------------------------------------------------

# Roadmap

## Completed

-   Multi-tenant architecture
-   Inventory Intelligence
-   AI Executive Workspace
-   Business Intelligence
-   Document Intelligence

## Planned

-   Native commerce integrations
-   Executive forecasting
-   Supplier automation
-   Public beta

------------------------------------------------------------------------

# Local Development

## Backend

``` bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Frontend

``` bash
cd frontend
npm install
npm run dev
```

------------------------------------------------------------------------

# Vision

Build the operating system founders use to understand, operate, and grow
their businesses through natural conversation and intelligent decision
support.

------------------------------------------------------------------------

# License

Proprietary © EVE. All rights reserved.
