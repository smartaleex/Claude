"""
APScheduler background tasks
=============================
Registers periodic re-enrichment jobs based on prospect tier.
- Hot prospects: re-enrich weekly
- Warm prospects: re-enrich bi-weekly
- Cold prospects: re-enrich monthly
"""
import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.prospect import Prospect, EnrichmentStatus

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.add_job(
            re_enrich_stale_prospects,
            trigger=IntervalTrigger(hours=6),
            id="re_enrich_stale",
            replace_existing=True,
            misfire_grace_time=300,
        )
        scheduler.start()
        logger.info("APScheduler started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")


async def re_enrich_stale_prospects() -> None:
    """Find prospects that need re-enrichment and trigger the pipeline."""
    from app.tasks.enrichment_pipeline import run_enrichment

    now = datetime.utcnow()
    staleness = {
        "Hot": timedelta(days=7),
        "Warm": timedelta(days=14),
        "Cold": timedelta(days=30),
        "Unscored": timedelta(hours=1),
    }

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Prospect).where(
                Prospect.enrichment_status != EnrichmentStatus.IN_PROGRESS.value
            )
        )
        prospects = result.scalars().all()

        to_enrich = []
        for p in prospects:
            threshold = staleness.get(p.icp_tier, timedelta(days=30))
            if p.last_enriched_at is None or (now - p.last_enriched_at) > threshold:
                to_enrich.append(p.id)

        logger.info("Re-enrichment check: %d prospects need updating", len(to_enrich))

        for pid in to_enrich[:10]:  # Process max 10 per run to avoid overloading APIs
            try:
                await run_enrichment(pid, db, force=False)
            except Exception as e:
                logger.warning("Scheduled re-enrichment failed for prospect %d: %s", pid, e)
