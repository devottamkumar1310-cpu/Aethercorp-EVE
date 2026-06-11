# EVE — Your AI Chief Operating Officer

EVE is an AI-powered Chief Operating Officer that transforms business data into actionable forecasts, operational insights, and strategic decisions.

## Features

- Authentication & Workspace Management
- Multi-Tenant SaaS Architecture
- Inventory Intelligence
- Sales Analytics
- Demand Forecasting
- Executive Decision Support

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- SQLAlchemy
- PostgreSQL

### Authentication
- Supabase Auth

### AI
- Gemini

## Roadmap

### Phase 1
Authentication & Workspace Foundation

### Phase 2
Data Hub & CSV Upload

### Phase 3
Executive Intelligence Dashboard

### Phase 4
AI COO Agent

### Phase 5
Forecasting & Scenario Simulation


## Project Structure

```text
aethercorp-eve/
│
├── frontend/         # Next.js web interface
├── backend/          # FastAPI backend services
├── docs/             # Documentation
├── README.md
└── .gitignore
```

## Setup & Local Development

### 1. Backend Setup
Navigate to the `backend` directory, install Python dependencies, configure `.env` values, and run the service using `app.main:app`:
```bash
cd backend
pip install -r requirements.txt
# Copy .env.production and configure local values as .env
uvicorn app.main:app --reload
```
The API Swagger documentation will load at: `http://127.0.0.1:8000/docs`

### 2. Frontend Setup
Navigate to the `frontend` directory, install packages, and boot the Next.js development server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with the EVE AI COO portal.
