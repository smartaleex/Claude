"""
Zetaris Prospector CLI
======================
Headless CLI interface for batch operations, automation, and scripting.

Usage:
    python -m cli add --company "Telstra" --domain "telstra.com"
    python -m cli import-csv prospects.csv
    python -m cli enrich --all
    python -m cli score --all
    python -m cli outreach --tier hot --persona cdo --channel cold-email --top 10
    python -m cli export --output scored.csv --min-score 40
"""
import asyncio
import csv
import sys
from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

app = typer.Typer(name="zetaris-prospector", help="Zetaris AI-powered sales prospector CLI")
console = Console()


def run_async(coro):
    """Run a coroutine in the event loop."""
    return asyncio.get_event_loop().run_until_complete(coro)


@app.command()
def add(
    company: str = typer.Option(..., help="Company name"),
    domain: str = typer.Option(..., help="Company domain (e.g. telstra.com)"),
    github_org: Optional[str] = typer.Option(None, help="GitHub org slug"),
    tags: Optional[str] = typer.Option(None, help="Comma-separated tags"),
    no_enrich: bool = typer.Option(False, help="Skip auto-enrichment after adding"),
):
    """Add a single prospect and optionally trigger enrichment."""
    run_async(_add_prospect(company, domain, github_org, tags, not no_enrich))


async def _add_prospect(company, domain, github_org, tags_str, enrich):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect, EnrichmentStatus
    from app.utils.domain_utils import normalise_domain
    from sqlalchemy import select

    await init_db()
    domain = normalise_domain(domain)

    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(Prospect).where(Prospect.domain == domain))
        if existing.scalar_one_or_none():
            console.print(f"[yellow]Prospect with domain '{domain}' already exists[/yellow]")
            raise typer.Exit(1)

        prospect = Prospect(
            company_name=company,
            domain=domain,
            github_org=github_org,
            tags=[t.strip() for t in tags_str.split(",")] if tags_str else [],
            enrichment_status=EnrichmentStatus.PENDING.value,
        )
        db.add(prospect)
        await db.commit()
        await db.refresh(prospect)
        console.print(f"[green]Added:[/green] {company} ({domain}) — ID: {prospect.id}")

        if enrich:
            console.print(f"[blue]Starting enrichment for {company}...[/blue]")
            from app.tasks.enrichment_pipeline import run_enrichment
            result = await run_enrichment(prospect.id, db, force=False)
            console.print(
                f"[green]Enrichment complete:[/green] "
                f"score={result['icp_score']:.1f} ({result['icp_tier']}), "
                f"signals={result['signals_added']}"
            )


@app.command(name="import-csv")
def import_csv_cmd(
    file: Path = typer.Argument(..., help="CSV file path"),
    no_enrich: bool = typer.Option(False, help="Skip enrichment after import"),
):
    """Bulk import prospects from CSV (columns: company_name, domain)."""
    run_async(_import_csv(file, not no_enrich))


async def _import_csv(file: Path, enrich: bool):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect, EnrichmentStatus
    from app.utils.domain_utils import normalise_domain
    from app.tasks.enrichment_pipeline import run_enrichment
    from sqlalchemy import select

    await init_db()

    with open(file, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    console.print(f"[blue]Importing {len(rows)} rows...[/blue]")
    created_ids = []

    async with AsyncSessionLocal() as db:
        for row in rows:
            company_name = row.get("company_name") or row.get("Company") or ""
            domain = row.get("domain") or row.get("Domain") or ""
            if not company_name or not domain:
                console.print(f"[red]Skipping row with missing data:[/red] {row}")
                continue

            domain = normalise_domain(domain)
            existing = await db.execute(select(Prospect).where(Prospect.domain == domain))
            if existing.scalar_one_or_none():
                console.print(f"[yellow]Skip (exists):[/yellow] {domain}")
                continue

            prospect = Prospect(
                company_name=company_name,
                domain=domain,
                github_org=row.get("github_org") or None,
                tags=row.get("tags", "").split(",") if row.get("tags") else [],
                enrichment_status=EnrichmentStatus.PENDING.value,
            )
            db.add(prospect)
            await db.flush()
            created_ids.append(prospect.id)

        await db.commit()
        console.print(f"[green]Created {len(created_ids)} prospects[/green]")

    if enrich and created_ids:
        console.print(f"[blue]Enriching {len(created_ids)} prospects...[/blue]")
        with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
            task = progress.add_task("Enriching...", total=len(created_ids))
            async with AsyncSessionLocal() as db:
                for pid in created_ids:
                    try:
                        r = await run_enrichment(pid, db)
                        progress.advance(task)
                        progress.print(f"  {r['company_name']}: {r['icp_score']:.0f} ({r['icp_tier']})")
                    except Exception as e:
                        progress.print(f"  [red]Error enriching {pid}:[/red] {e}")


@app.command()
def enrich(
    domain: Optional[str] = typer.Option(None, help="Enrich a specific domain"),
    all_prospects: bool = typer.Option(False, "--all", help="Enrich all pending/stale prospects"),
    force: bool = typer.Option(False, help="Force re-enrichment even if recently done"),
    concurrency: int = typer.Option(3, help="Max concurrent enrichments"),
):
    """Run enrichment pipeline for prospects."""
    run_async(_enrich(domain, all_prospects, force, concurrency))


async def _enrich(domain, all_prospects, force, concurrency):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect
    from app.tasks.enrichment_pipeline import run_enrichment
    from sqlalchemy import select
    import asyncio

    await init_db()

    async with AsyncSessionLocal() as db:
        if domain:
            result = await db.execute(select(Prospect).where(Prospect.domain == domain))
            prospect = result.scalar_one_or_none()
            if not prospect:
                console.print(f"[red]Prospect not found:[/red] {domain}")
                raise typer.Exit(1)
            r = await run_enrichment(prospect.id, db, force=force)
            console.print(f"[green]Done:[/green] {r['icp_score']:.0f} ({r['icp_tier']}) — {r['signals_added']} signals")

        elif all_prospects:
            result = await db.execute(select(Prospect))
            prospects = result.scalars().all()
            sem = asyncio.Semaphore(concurrency)

            async def enrich_one(pid):
                async with sem:
                    async with AsyncSessionLocal() as inner_db:
                        return await run_enrichment(pid, inner_db, force=force)

            tasks = [enrich_one(p.id) for p in prospects]
            with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as progress:
                task = progress.add_task(f"Enriching {len(prospects)} prospects...", total=len(prospects))
                for coro in asyncio.as_completed(tasks):
                    try:
                        r = await coro
                        progress.advance(task)
                        progress.print(f"  {r['company_name']}: {r['icp_score']:.0f} ({r['icp_tier']})")
                    except Exception as e:
                        progress.print(f"  [red]Error:[/red] {e}")
        else:
            console.print("[yellow]Specify --domain or --all[/yellow]")


@app.command()
def score(
    all_prospects: bool = typer.Option(False, "--all", help="Recalculate scores for all prospects"),
):
    """Recalculate ICP scores without re-running data collection."""
    run_async(_score_all(all_prospects))


async def _score_all(all_prospects):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect, ProspectSignal
    from app.scoring.engine import calculate_score
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Prospect))
        prospects = result.scalars().all()

        for p in prospects:
            sigs_result = await db.execute(
                select(ProspectSignal).where(ProspectSignal.prospect_id == p.id)
            )
            sigs = sigs_result.scalars().all()
            sr = calculate_score(sigs)
            p.icp_score = sr.score
            p.icp_tier = sr.tier
            p.score_breakdown = sr.breakdown

        await db.commit()
        console.print(f"[green]Rescored {len(prospects)} prospects[/green]")


@app.command()
def outreach(
    tier: Optional[str] = typer.Option(None, help="Filter by tier: Hot, Warm, Cold"),
    persona: str = typer.Option("cdo", help="Target persona: cdo, vp-data, cto, data-architect"),
    channel: str = typer.Option("cold-email", help="Channel: cold-email, linkedin, followup"),
    top: int = typer.Option(10, help="Generate for top N prospects"),
    sender: str = typer.Option("ae", help="Sender persona: ae or sdr"),
):
    """Generate outreach variants for top prospects."""
    run_async(_generate_outreach(tier, persona, channel, top, sender))


async def _generate_outreach(tier, persona, channel, top, sender):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect, ProspectSignal
    from app.synthesis.outreach_generator import generate_outreach
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as db:
        query = select(Prospect).order_by(Prospect.icp_score.desc()).limit(top)
        if tier:
            query = query.where(Prospect.icp_tier == tier)
        result = await db.execute(query)
        prospects = result.scalars().all()

        for p in prospects:
            console.print(f"\n[bold]{p.company_name}[/bold] ({p.icp_tier}, score={p.icp_score:.0f})")
            sigs_result = await db.execute(
                select(ProspectSignal).where(ProspectSignal.prospect_id == p.id)
            )
            sigs = sigs_result.scalars().all()
            try:
                variants = await generate_outreach(p, list(sigs), channel, persona, sender)
                console.print(f"[green]Variant A:[/green]\n{variants['variant_a'][:300]}...\n")
            except Exception as e:
                console.print(f"[red]Failed:[/red] {e}")


@app.command()
def export(
    output: Path = typer.Option("prospects_export.csv", help="Output CSV file path"),
    min_score: float = typer.Option(0.0, help="Minimum ICP score to include"),
    tier: Optional[str] = typer.Option(None, help="Filter by tier"),
):
    """Export scored prospects to CSV."""
    run_async(_export(output, min_score, tier))


async def _export(output, min_score, tier):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as db:
        query = select(Prospect).where(Prospect.icp_score >= min_score).order_by(Prospect.icp_score.desc())
        if tier:
            query = query.where(Prospect.icp_tier == tier)
        result = await db.execute(query)
        prospects = result.scalars().all()

    with open(output, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "company_name", "domain", "icp_score", "icp_tier", "industry", "employee_count", "hq_country", "last_enriched_at", "tags"])
        for p in prospects:
            writer.writerow([p.id, p.company_name, p.domain, p.icp_score, p.icp_tier, p.industry, p.employee_count, p.hq_country, p.last_enriched_at, ",".join(p.tags or [])])

    console.print(f"[green]Exported {len(prospects)} prospects to {output}[/green]")


@app.command()
def list_prospects(
    tier: Optional[str] = typer.Option(None, help="Filter by tier"),
    top: int = typer.Option(20, help="Number of prospects to show"),
):
    """List prospects in a rich table."""
    run_async(_list(tier, top))


async def _list(tier, top):
    from app.database import AsyncSessionLocal, init_db
    from app.models.prospect import Prospect
    from sqlalchemy import select

    await init_db()

    async with AsyncSessionLocal() as db:
        query = select(Prospect).order_by(Prospect.icp_score.desc()).limit(top)
        if tier:
            query = query.where(Prospect.icp_tier == tier)
        result = await db.execute(query)
        prospects = result.scalars().all()

    table = Table(title=f"Zetaris Prospects (top {top})")
    table.add_column("ID", style="dim")
    table.add_column("Company", style="bold")
    table.add_column("Domain")
    table.add_column("Score", style="cyan")
    table.add_column("Tier")
    table.add_column("Industry")
    table.add_column("Enriched")

    tier_styles = {"Hot": "red", "Warm": "yellow", "Cold": "blue", "Disqualified": "dim"}
    for p in prospects:
        style = tier_styles.get(p.icp_tier, "purple")
        table.add_row(
            str(p.id), p.company_name, p.domain,
            f"{p.icp_score:.1f}", f"[{style}]{p.icp_tier}[/{style}]",
            p.industry or "—",
            p.last_enriched_at.strftime("%Y-%m-%d") if p.last_enriched_at else "Never",
        )

    console.print(table)


if __name__ == "__main__":
    app()
