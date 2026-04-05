"""
Scoring API
===========
Endpoints for manually triggering score recalculation and viewing signal registry.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.prospect import Prospect, ProspectSignal
from app.scoring.engine import calculate_score
from app.scoring.signals import ALL_SIGNALS

router = APIRouter(prefix="/api/scoring", tags=["scoring"])


@router.post("/recalculate/{prospect_id}")
async def recalculate_score(prospect_id: int, db: AsyncSession = Depends(get_db)):
    """Recalculate ICP score from stored signals without re-enriching."""
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    sigs_result = await db.execute(
        select(ProspectSignal).where(ProspectSignal.prospect_id == prospect_id)
    )
    signals = sigs_result.scalars().all()

    sr = calculate_score(list(signals))
    prospect.icp_score = sr.score
    prospect.icp_tier = sr.tier
    prospect.score_breakdown = sr.breakdown
    await db.commit()

    return {
        "prospect_id": prospect_id,
        "icp_score": sr.score,
        "icp_tier": sr.tier,
        "breakdown": sr.breakdown,
        "signal_count": sr.signal_count,
    }


@router.post("/recalculate-all")
async def recalculate_all_scores(db: AsyncSession = Depends(get_db)):
    """Recalculate ICP scores for all prospects (e.g. after adjusting signal weights)."""
    result = await db.execute(select(Prospect))
    prospects = result.scalars().all()

    updated = 0
    for p in prospects:
        sigs_result = await db.execute(
            select(ProspectSignal).where(ProspectSignal.prospect_id == p.id)
        )
        signals = sigs_result.scalars().all()
        sr = calculate_score(list(signals))
        p.icp_score = sr.score
        p.icp_tier = sr.tier
        p.score_breakdown = sr.breakdown
        updated += 1

    await db.commit()
    return {"updated": updated}


@router.get("/signal-registry")
async def get_signal_registry():
    """Return the full ICP signal registry for reference."""
    return [
        {
            "name": s.name,
            "tier": s.tier,
            "points": s.points,
            "category": s.category,
            "description": s.description,
            "source_hint": s.source_hint,
        }
        for s in ALL_SIGNALS.values()
    ]
