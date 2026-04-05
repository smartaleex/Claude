"""
Prospects API
=============
CRUD + enrichment + synthesis endpoints for prospects.
"""
import asyncio
import csv
import io
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.prospect import Prospect, ProspectSignal, EnrichmentStatus
from app.schemas.prospect import (
    ProspectCreate, ProspectUpdate, ProspectOut, ProspectDetail,
    ProspectListResponse, EnrichRequest, SynthesizeRequest, SignalOut,
)
from app.utils.domain_utils import normalise_domain

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/prospects", tags=["prospects"])


@router.get("", response_model=ProspectListResponse)
async def list_prospects(
    db: AsyncSession = Depends(get_db),
    tier: Optional[str] = Query(None, description="Filter by ICP tier: Hot, Warm, Cold, Disqualified"),
    industry: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    max_score: Optional[float] = Query(None, ge=0, le=100),
    search: Optional[str] = Query(None, description="Search company name or domain"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    sort_by: str = Query("icp_score", enum=["icp_score", "company_name", "created_at", "last_enriched_at"]),
    sort_dir: str = Query("desc", enum=["asc", "desc"]),
):
    query = select(Prospect)

    if tier:
        query = query.where(Prospect.icp_tier == tier)
    if industry:
        query = query.where(Prospect.industry.ilike(f"%{industry}%"))
    if min_score is not None:
        query = query.where(Prospect.icp_score >= min_score)
    if max_score is not None:
        query = query.where(Prospect.icp_score <= max_score)
    if search:
        query = query.where(
            or_(
                Prospect.company_name.ilike(f"%{search}%"),
                Prospect.domain.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Apply sort and pagination
    sort_col = getattr(Prospect, sort_by)
    if sort_dir == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    prospects = result.scalars().all()

    # Filter by tag in Python (JSON column filtering is DB-specific)
    if tag:
        prospects = [p for p in prospects if p.tags and tag in p.tags]
        total = len(prospects)

    return ProspectListResponse(total=total, items=prospects)


@router.post("", response_model=ProspectOut, status_code=201)
async def create_prospect(
    data: ProspectCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    domain = normalise_domain(data.domain)

    # Check for duplicate
    existing = await db.execute(select(Prospect).where(Prospect.domain == domain))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Prospect with domain '{domain}' already exists")

    prospect = Prospect(
        company_name=data.company_name,
        domain=domain,
        github_org=data.github_org,
        linkedin_url=data.linkedin_url,
        website_url=data.website_url or f"https://{domain}",
        notes=data.notes,
        tags=data.tags or [],
        enrichment_status=EnrichmentStatus.PENDING.value,
    )
    db.add(prospect)
    await db.commit()
    await db.refresh(prospect)

    # Auto-trigger enrichment in background
    background_tasks.add_task(_background_enrich, prospect.id)
    return prospect


@router.get("/{prospect_id}", response_model=ProspectDetail)
async def get_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Prospect).where(Prospect.id == prospect_id)
    )
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    signals_result = await db.execute(
        select(ProspectSignal)
        .where(ProspectSignal.prospect_id == prospect_id)
        .order_by(ProspectSignal.signal_points.desc())
    )
    signals = signals_result.scalars().all()

    # Combine into detail response
    detail_data = {**prospect.__dict__}
    detail_data["signals"] = signals
    return ProspectDetail.model_validate(detail_data)


@router.patch("/{prospect_id}", response_model=ProspectOut)
async def update_prospect(
    prospect_id: int,
    data: ProspectUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(prospect, field, value)
    prospect.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(prospect)
    return prospect


@router.delete("/{prospect_id}", status_code=204)
async def delete_prospect(prospect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")
    await db.delete(prospect)
    await db.commit()


@router.post("/{prospect_id}/enrich", status_code=202)
async def enrich_prospect(
    prospect_id: int,
    data: EnrichRequest = EnrichRequest(),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Prospect not found")

    background_tasks.add_task(_background_enrich, prospect_id, data.force)
    return {"message": "Enrichment started", "prospect_id": prospect_id}


@router.post("/{prospect_id}/synthesize", status_code=202)
async def synthesize_prospect(
    prospect_id: int,
    data: SynthesizeRequest = SynthesizeRequest(),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if not prospect:
        raise HTTPException(status_code=404, detail="Prospect not found")

    background_tasks.add_task(_background_synthesize, prospect_id)
    return {"message": "Profile synthesis started", "prospect_id": prospect_id}


@router.get("/{prospect_id}/signals", response_model=list[SignalOut])
async def get_signals(prospect_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ProspectSignal)
        .where(ProspectSignal.prospect_id == prospect_id)
        .order_by(ProspectSignal.signal_points.desc())
    )
    return result.scalars().all()


@router.delete("/{prospect_id}/signals/{signal_id}", status_code=204)
async def delete_signal(
    prospect_id: int, signal_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProspectSignal).where(
            ProspectSignal.id == signal_id,
            ProspectSignal.prospect_id == prospect_id,
        )
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    await db.delete(signal)
    # Recalculate score
    await _recalculate_score(prospect_id, db)
    await db.commit()


@router.post("/import/csv", status_code=202)
async def import_csv(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
):
    """Import prospects from CSV. Expected columns: company_name, domain."""
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))

    created = 0
    skipped = 0
    errors = []

    for row in reader:
        company_name = row.get("company_name") or row.get("Company") or ""
        domain = row.get("domain") or row.get("Domain") or row.get("website") or ""

        if not company_name or not domain:
            errors.append(f"Row missing company_name or domain: {row}")
            continue

        domain = normalise_domain(domain)
        existing = await db.execute(select(Prospect).where(Prospect.domain == domain))
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        prospect = Prospect(
            company_name=company_name,
            domain=domain,
            github_org=row.get("github_org") or None,
            tags=row.get("tags", "").split(",") if row.get("tags") else [],
            enrichment_status=EnrichmentStatus.PENDING.value,
        )
        db.add(prospect)
        created += 1

    await db.commit()

    # Trigger background enrichment for new prospects
    new_prospects = await db.execute(
        select(Prospect.id).where(Prospect.enrichment_status == EnrichmentStatus.PENDING.value)
    )
    for (pid,) in new_prospects.all():
        background_tasks.add_task(_background_enrich, pid)

    return {
        "imported": created,
        "skipped_duplicates": skipped,
        "errors": errors[:10],
    }


@router.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    """Export all prospects to CSV."""
    result = await db.execute(select(Prospect).order_by(Prospect.icp_score.desc()))
    prospects = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "company_name", "domain", "icp_score", "icp_tier",
        "industry", "employee_count", "hq_country",
        "enrichment_status", "last_enriched_at", "tags",
    ])
    for p in prospects:
        writer.writerow([
            p.id, p.company_name, p.domain, p.icp_score, p.icp_tier,
            p.industry, p.employee_count, p.hq_country,
            p.enrichment_status, p.last_enriched_at,
            ",".join(p.tags or []),
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=zetaris_prospects.csv"},
    )


# ─── Background task helpers ─────────────────────────────────────────────────

async def _background_enrich(prospect_id: int, force: bool = False) -> None:
    from app.database import AsyncSessionLocal
    from app.tasks.enrichment_pipeline import run_enrichment
    async with AsyncSessionLocal() as db:
        try:
            await run_enrichment(prospect_id, db, force=force)
        except Exception as e:
            logger.error("Background enrichment failed for prospect %d: %s", prospect_id, e)


async def _background_synthesize(prospect_id: int) -> None:
    from app.database import AsyncSessionLocal
    from app.synthesis.profile_synthesizer import synthesize_profile
    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
            prospect = result.scalar_one_or_none()
            if not prospect:
                return

            signals_result = await db.execute(
                select(ProspectSignal).where(ProspectSignal.prospect_id == prospect_id)
            )
            signals = signals_result.scalars().all()

            profile = await synthesize_profile(prospect, signals)
            prospect.intelligence_profile = profile
            prospect.profile_generated_at = datetime.utcnow()
            await db.commit()
        except Exception as e:
            logger.error("Background synthesis failed for prospect %d: %s", prospect_id, e)


async def _recalculate_score(prospect_id: int, db: AsyncSession) -> None:
    from app.scoring.engine import calculate_score
    signals_result = await db.execute(
        select(ProspectSignal).where(ProspectSignal.prospect_id == prospect_id)
    )
    signals = signals_result.scalars().all()

    result = await db.execute(select(Prospect).where(Prospect.id == prospect_id))
    prospect = result.scalar_one_or_none()
    if prospect:
        score_result = calculate_score(signals)
        prospect.icp_score = score_result.score
        prospect.icp_tier = score_result.tier
        prospect.score_breakdown = score_result.breakdown
