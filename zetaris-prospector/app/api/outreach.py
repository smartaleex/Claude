"""Outreach generation API endpoints."""
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.prospect import Prospect, ProspectSignal
from app.models.outreach import OutreachMessage
from app.schemas.outreach import OutreachRequest, OutreachOut

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prospects", tags=["outreach"])


@router.post("/{prospect_id}/outreach", response_model=OutreachOut, status_code=201)
async def generate_outreach_for_prospect(
    prospect_id: int,
    request: OutreachRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    signals_result = await db.execute(
        select(ProspectSignal)
        .where(ProspectSignal.prospect_id == prospect_id)
        .order_by(ProspectSignal.signal_points.desc())
    )
    signals = signals_result.scalars().all()

    from app.synthesis.outreach_generator import generate_outreach
    from app.config import settings

    try:
        variants = await generate_outreach(
            prospect=prospect,
            signals=list(signals),
            channel=request.channel,
            target_persona=request.target_persona,
            sender_persona=request.sender_persona,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outreach generation failed: {e}")

    # Top 3 signal names for tracking
    key_signals = [s.signal_name for s in signals[:3] if not s.is_anti_signal]

    message = OutreachMessage(
        prospect_id=prospect_id,
        channel=request.channel,
        target_persona=request.target_persona,
        sender_persona=request.sender_persona,
        variant_a=variants.get("variant_a"),
        variant_b=variants.get("variant_b"),
        variant_c=variants.get("variant_c"),
        key_signals_used=key_signals,
        model_used=settings.claude_model,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


@router.get("/{prospect_id}/outreach", response_model=list[OutreachOut])
async def list_outreach(prospect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(OutreachMessage)
        .where(OutreachMessage.prospect_id == prospect_id)
        .order_by(OutreachMessage.generated_at.desc())
    )
    return result.scalars().all()
