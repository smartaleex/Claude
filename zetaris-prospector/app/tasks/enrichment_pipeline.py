"""
Enrichment Pipeline
===================
Orchestrates all collectors for a prospect.
Runs fast collectors concurrently, rate-limited collectors sequentially.
Saves all signals to DB and recalculates ICP score.
"""
import asyncio
import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models.prospect import Prospect, ProspectSignal, EnrichmentJob, EnrichmentStatus
from app.collectors.github_collector import GitHubCollector
from app.collectors.techstack_collector import TechStackCollector
from app.collectors.news_collector import NewsCollector
from app.collectors.jobs_collector import JobsCollector
from app.collectors.sec_collector import SECCollector
from app.collectors.hunter_collector import HunterCollector
from app.scoring.engine import calculate_score

logger = logging.getLogger(__name__)


async def run_enrichment(
    prospect_id: int,
    db: AsyncSession,
    force: bool = False,
) -> dict[str, Any]:
    """
    Run full enrichment pipeline for a prospect.
    Returns a summary dict of what was done.
    """
    # Load prospect
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise ValueError(f"Prospect {prospect_id} not found")

    # Check if already enriched recently (skip if within 24h unless forced)
    if not force and prospect.last_enriched_at:
        from datetime import timedelta
        age = datetime.utcnow() - prospect.last_enriched_at
        if age.total_seconds() < 86400:
            return {"skipped": True, "reason": "Enriched within last 24 hours"}

    # Create enrichment job record
    job = EnrichmentJob(
        prospect_id=prospect_id,
        status="running",
        sources_run=[],
        signals_added=0,
        errors={},
        started_at=datetime.utcnow(),
    )
    db.add(job)
    await db.flush()

    # Update prospect status
    prospect.enrichment_status = EnrichmentStatus.IN_PROGRESS.value
    await db.commit()

    sources_run = []
    all_signals = []
    all_errors: dict[str, str] = {}
    enrichment_metadata: dict[str, Any] = {}

    # --- Phase 1: Fast parallel collectors (no strict rate limits) ---
    fast_collectors = [
        ("github", GitHubCollector(), {"company_name": prospect.company_name, "github_org": prospect.github_org}),
        ("techstack", TechStackCollector(), {}),
        ("hunter", HunterCollector(), {"company_name": prospect.company_name}),
    ]

    fast_tasks = [
        _run_collector(name, collector, prospect.domain, kwargs)
        for name, collector, kwargs in fast_collectors
    ]
    fast_results = await asyncio.gather(*fast_tasks, return_exceptions=True)

    for (name, _, _), collector_result in zip(fast_collectors, fast_results):
        if isinstance(collector_result, Exception):
            all_errors[name] = str(collector_result)
            logger.warning("Collector %s raised exception: %s", name, collector_result)
        else:
            sources_run.append(name)
            all_signals.extend(collector_result.signals)
            enrichment_metadata.update(collector_result.metadata)
            if collector_result.errors:
                all_errors[name] = "; ".join(collector_result.errors)

    # --- Phase 2: Rate-limited sequential collectors ---
    slow_collectors = [
        ("news", NewsCollector(), {"company_name": prospect.company_name}),
        ("jobs", JobsCollector(), {"company_name": prospect.company_name}),
        ("sec", SECCollector(), {"company_name": prospect.company_name}),
    ]

    for name, collector, kwargs in slow_collectors:
        try:
            collector_result = await _run_collector(name, collector, prospect.domain, kwargs)
            sources_run.append(name)
            all_signals.extend(collector_result.signals)
            enrichment_metadata.update(collector_result.metadata)
            if collector_result.errors:
                all_errors[name] = "; ".join(collector_result.errors)
        except Exception as e:
            all_errors[name] = str(e)
            logger.warning("Collector %s failed: %s", name, e)
        await asyncio.sleep(0.5)  # Brief pause between rate-limited sources

    # --- Save signals to DB ---
    if force:
        # Clear existing auto-detected signals (keep manual ones)
        await db.execute(
            delete(ProspectSignal).where(
                ProspectSignal.prospect_id == prospect_id,
                ProspectSignal.is_manual == False,  # noqa: E712
            )
        )

    signal_records = []
    for sig in all_signals:
        signal_records.append(ProspectSignal(
            prospect_id=prospect_id,
            signal_name=sig["signal_name"],
            signal_tier=sig["signal_tier"],
            signal_points=sig["signal_points"],
            evidence_text=sig.get("evidence_text", ""),
            evidence_url=sig.get("evidence_url"),
            source=sig["source"],
            is_anti_signal=sig.get("is_anti_signal", False),
            is_manual=False,
        ))
    db.add_all(signal_records)

    # --- Update prospect metadata from enrichment ---
    if enrichment_metadata.get("industry"):
        prospect.industry = enrichment_metadata["industry"]
    if enrichment_metadata.get("employee_count"):
        prospect.employee_count = enrichment_metadata["employee_count"]
    if enrichment_metadata.get("country"):
        prospect.hq_country = enrichment_metadata["country"]
    if enrichment_metadata.get("description"):
        prospect.description = enrichment_metadata["description"]
    if enrichment_metadata.get("github_org") and not prospect.github_org:
        prospect.github_org = enrichment_metadata["github_org"]

    await db.flush()

    # --- Recalculate ICP score ---
    all_db_signals_result = await db.execute(
        select(ProspectSignal).where(ProspectSignal.prospect_id == prospect_id)
    )
    all_db_signals = list(all_db_signals_result.scalars().all())

    scoring_result = calculate_score(all_db_signals)
    prospect.icp_score = scoring_result.score
    prospect.icp_tier = scoring_result.tier
    prospect.score_breakdown = scoring_result.breakdown
    prospect.enrichment_status = EnrichmentStatus.COMPLETE.value
    prospect.last_enriched_at = datetime.utcnow()

    # --- Update job record ---
    job.status = "complete"
    job.sources_run = sources_run
    job.signals_added = len(signal_records)
    job.errors = all_errors
    job.completed_at = datetime.utcnow()

    await db.commit()

    logger.info(
        "Enrichment complete for %s: %d signals, score=%.1f (%s), sources=%s",
        prospect.company_name, len(signal_records), scoring_result.score,
        scoring_result.tier, sources_run,
    )

    return {
        "prospect_id": prospect_id,
        "company_name": prospect.company_name,
        "signals_added": len(signal_records),
        "icp_score": scoring_result.score,
        "icp_tier": scoring_result.tier,
        "sources_run": sources_run,
        "errors": all_errors,
    }


async def _run_collector(name: str, collector, domain: str, kwargs: dict):
    """Wrapper to run a collector and ensure client cleanup."""
    try:
        return await collector.collect(domain, **kwargs)
    finally:
        await collector.close()
