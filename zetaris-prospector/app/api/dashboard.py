"""Dashboard statistics endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.prospect import Prospect, ProspectSignal
from app.synthesis.claude_client import ClaudeClient

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Return aggregate counts and distribution for the dashboard."""
    # Tier counts
    tier_result = await db.execute(
        select(Prospect.icp_tier, func.count(Prospect.id))
        .group_by(Prospect.icp_tier)
    )
    tier_counts = dict(tier_result.all())

    # Total prospects
    total_result = await db.execute(select(func.count(Prospect.id)))
    total = total_result.scalar_one()

    # Average score
    avg_result = await db.execute(select(func.avg(Prospect.icp_score)))
    avg_score = round(avg_result.scalar_one() or 0, 2)

    # Top industries
    industry_result = await db.execute(
        select(Prospect.industry, func.count(Prospect.id))
        .where(Prospect.industry.isnot(None))
        .group_by(Prospect.industry)
        .order_by(func.count(Prospect.id).desc())
        .limit(8)
    )
    top_industries = [{"industry": i, "count": c} for i, c in industry_result.all()]

    # Most common signals
    signal_result = await db.execute(
        select(ProspectSignal.signal_name, func.count(ProspectSignal.id))
        .where(ProspectSignal.is_anti_signal == False)  # noqa: E712
        .group_by(ProspectSignal.signal_name)
        .order_by(func.count(ProspectSignal.id).desc())
        .limit(10)
    )
    top_signals = [{"signal": s, "count": c} for s, c in signal_result.all()]

    # Enrichment status breakdown
    status_result = await db.execute(
        select(Prospect.enrichment_status, func.count(Prospect.id))
        .group_by(Prospect.enrichment_status)
    )
    enrichment_status = dict(status_result.all())

    return {
        "total_prospects": total,
        "avg_icp_score": avg_score,
        "tier_counts": tier_counts,
        "enrichment_status": enrichment_status,
        "top_industries": top_industries,
        "top_signals": top_signals,
        "claude_session_cost": ClaudeClient.get_session_cost(),
    }


@router.get("/recent")
async def get_recent(db: AsyncSession = Depends(get_db), limit: int = 10):
    """Recently enriched or scored prospects."""
    result = await db.execute(
        select(Prospect)
        .where(Prospect.last_enriched_at.isnot(None))
        .order_by(Prospect.last_enriched_at.desc())
        .limit(limit)
    )
    prospects = result.scalars().all()
    return [
        {
            "id": p.id,
            "company_name": p.company_name,
            "domain": p.domain,
            "icp_score": p.icp_score,
            "icp_tier": p.icp_tier,
            "last_enriched_at": p.last_enriched_at,
        }
        for p in prospects
    ]
