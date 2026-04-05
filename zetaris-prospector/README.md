# Zetaris Sales Prospector

AI-powered B2B sales intelligence app that sources, combines, and synthesizes signals from unconventional data sources to identify companies most likely to need [Zetaris](https://zetaris.com) — the AI Data Hub and federated query platform.

## What It Does

The app automatically scores companies against a Zetaris-specific ICP model by mining:

| Source | What We Detect |
|---|---|
| **GitHub API** | Iceberg/Delta Lake/Trino repos, dbt usage, multi-DW stacks, data engineering activity |
| **Tech Stack (Wappalyzer)** | Simultaneous use of Snowflake + Redshift + BigQuery, BI tooling, cloud providers, Azure presence |
| **Job Postings (Adzuna)** | "federated query", "data mesh", multi-engine requirements, data role hiring volume |
| **News (Guardian + NewsAPI)** | CDO/CTO hires, data transformation announcements, funding rounds, competitor mentions |
| **SEC EDGAR** | 10-K/8-K filings mentioning data modernization as a strategic priority |
| **Hunter.io** | Employee count, industry classification, company enrichment |

Every signal fires points into a **0–100 ICP score** that classifies prospects as **Hot / Warm / Cold / Disqualified**. Claude (`claude-sonnet-4-6`) then synthesizes all signals into a structured intelligence brief and generates 3 personalized outreach variants per persona and channel.

## Zetaris ICP Signal Logic

### Tier 1 — 10 pts each (strongest)
- GitHub org has Apache Iceberg, Delta Lake, Trino, or Apache Hudi repos
- Tech stack shows 2+ competing data warehouses simultaneously
- Job posting requires federated query / data mesh / data virtualization expertise
- SEC filing describes data modernization as a strategic priority
- Recent news: CDO/CTO hire or data transformation initiative

### Tier 2 — 5 pts each
- Industry in Zetaris sweet spot: Telecom, Healthcare, Financial Services, Utilities, Government
- 3+ simultaneous open data engineering roles
- 500–10,000 employees (mid-to-large enterprise)
- BI tooling detected (Tableau, Power BI, Looker)
- Azure cloud detected (Zetaris has Azure Marketplace listing)
- Active dbt repositories

### Tier 3 — 2 pts each
- Heavy Python/SQL data engineering GitHub activity
- Multi-cloud environment detected
- Careers page mentions "modern data stack" or "data platform"

### Anti-Signals — -10 pts each
- Fewer than 50 employees
- Only a single cloud DW (no federation pain yet)
- Confirmed Denodo/Dremio customer
- Direct competitor (Databricks, Snowflake, AWS, Google, Microsoft)

## Quick Start

### 1. Clone & configure

```bash
cd zetaris-prospector
cp .env.example .env
# Edit .env and add your API keys
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the web app

```bash
uvicorn app.main:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000)

### 4. Or use Docker

```bash
cp .env.example .env  # fill in keys
docker-compose up
```

## API Keys

| Key | Where to get | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | **Yes** (for AI synthesis) |
| `GITHUB_TOKEN` | GitHub → Settings → Developer tokens | Strongly recommended (raises rate limit 60→5000/hr) |
| `GUARDIAN_API_KEY` | [open-platform.theguardian.com](https://open-platform.theguardian.com/access/) | Optional (free) |
| `NEWS_API_KEY` | [newsapi.org](https://newsapi.org) | Optional (free tier) |
| `ADZUNA_APP_ID` + `ADZUNA_API_KEY` | [developer.adzuna.com](https://developer.adzuna.com) | Optional (job postings) |
| `HUNTER_API_KEY` | [hunter.io](https://hunter.io/api) | Optional (25 free/month) |
| `DETECTZESTACK_API_KEY` | [detectzestack.com](https://detectzestack.com) | Optional (100 free/month) |

The app works with zero API keys (using only python-Wappalyzer for tech stack detection) but signal quality improves significantly with GitHub + news keys at minimum.

## CLI Usage

```bash
# Add a single prospect and auto-enrich
python -m cli add --company "Telstra" --domain "telstra.com"

# Import a CSV of targets
python -m cli import-csv sample_prospects.csv

# Enrich all prospects
python -m cli enrich --all

# Enrich a specific domain
python -m cli enrich --domain "telstra.com" --force

# Recalculate scores after adjusting signal weights
python -m cli score --all

# List top prospects
python -m cli list-prospects --tier Hot

# Generate outreach for top 10 Hot prospects
python -m cli outreach --tier Hot --persona cdo --channel cold-email --top 10

# Export scored list
python -m cli export --output scored.csv --min-score 40
```

## Web Interface

| Page | URL | Description |
|---|---|---|
| Dashboard | `/` | Sortable/filterable prospect table with tier badges and score bars |
| Prospect Detail | `/prospect/{id}` | Full signal breakdown, Claude intelligence profile, outreach generator |
| Add Prospect | `/add` | Single form or CSV import with quick-add buttons for AU targets |
| API Docs | `/api/docs` | Interactive FastAPI Swagger UI |

## Architecture

```
app/
├── collectors/          # One file per data source; each returns CollectorResult
│   ├── github_collector.py      # GitHub API — repos, topics, languages
│   ├── techstack_collector.py   # Wappalyzer + HTTP headers
│   ├── news_collector.py        # Guardian + NewsAPI.org
│   ├── jobs_collector.py        # Adzuna job postings
│   ├── sec_collector.py         # SEC EDGAR 10-K/8-K via edgartools
│   └── hunter_collector.py      # Hunter.io firmographic enrichment
├── scoring/
│   ├── signals.py       # Signal registry: name, tier, points, description
│   └── engine.py        # Pure scoring function: signals → 0-100 normalized score
├── synthesis/
│   ├── claude_client.py         # Anthropic SDK wrapper with retry + cost tracking
│   ├── profile_synthesizer.py   # Builds intelligence brief via claude-sonnet-4-6
│   └── outreach_generator.py    # Generates 3 outreach variants via claude-haiku
├── tasks/
│   ├── enrichment_pipeline.py   # Orchestrates all collectors, saves signals, scores
│   └── scheduler.py             # APScheduler: periodic re-enrichment by tier
└── api/
    ├── prospects.py     # CRUD, enrich, synthesize, CSV import/export
    ├── outreach.py      # Outreach generation + history
    └── dashboard.py     # Stats and recent activity
```

## Signal Freshness Strategy

| Tier | Re-enrich frequency | Sources |
|---|---|---|
| Hot | Weekly | All sources |
| Warm | Bi-weekly | News + jobs only |
| Cold | Monthly | Tech stack only |

## Running Tests

```bash
pytest tests/ -v
```

## Claude API Cost Estimate

| Operation | Model | Approx cost |
|---|---|---|
| Intelligence profile synthesis | claude-sonnet-4-6 | ~$0.015 per prospect |
| Outreach generation (3 variants) | claude-haiku-4-5 | ~$0.002 per prospect |
| Full batch of 100 prospects | Mixed | ~$1.70 |
