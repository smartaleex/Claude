from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Integer, String, Float, Text, DateTime, JSON, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.database import Base


class EnrichmentStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    FAILED = "failed"


class ICPTier(str, enum.Enum):
    HOT = "Hot"
    WARM = "Warm"
    COLD = "Cold"
    DISQUALIFIED = "Disqualified"
    UNSCORED = "Unscored"


class Prospect(Base):
    __tablename__ = "prospects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    github_org: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    website_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    # Company attributes (from enrichment)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    employee_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    hq_country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ICP scoring
    icp_score: Mapped[float] = mapped_column(Float, default=0.0)
    icp_tier: Mapped[str] = mapped_column(
        String(20), default=ICPTier.UNSCORED.value
    )
    score_breakdown: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Enrichment state
    enrichment_status: Mapped[str] = mapped_column(
        String(20), default=EnrichmentStatus.PENDING.value
    )
    last_enriched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Claude synthesis
    intelligence_profile: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_generated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # User-managed metadata
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    # Relationships
    signals: Mapped[list["ProspectSignal"]] = relationship(
        "ProspectSignal", back_populates="prospect", cascade="all, delete-orphan"
    )
    outreach_messages: Mapped[list["OutreachMessage"]] = relationship(
        "OutreachMessage", back_populates="prospect", cascade="all, delete-orphan"
    )
    enrichment_jobs: Mapped[list["EnrichmentJob"]] = relationship(
        "EnrichmentJob", back_populates="prospect", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Prospect {self.company_name} ({self.domain}) score={self.icp_score:.1f}>"


class ProspectSignal(Base):
    """Individual signal evidence records — the audit trail behind each score."""
    __tablename__ = "prospect_signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prospect_id: Mapped[int] = mapped_column(Integer, ForeignKey("prospects.id"), index=True)
    signal_name: Mapped[str] = mapped_column(String(100), nullable=False)
    signal_tier: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3, or 0 for anti
    signal_points: Mapped[float] = mapped_column(Float, nullable=False)
    evidence_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    is_anti_signal: Mapped[bool] = mapped_column(default=False)
    is_manual: Mapped[bool] = mapped_column(default=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    prospect: Mapped["Prospect"] = relationship("Prospect", back_populates="signals")

    def __repr__(self) -> str:
        return f"<Signal {self.signal_name} pts={self.signal_points}>"


class EnrichmentJob(Base):
    """Tracks enrichment job history for a prospect."""
    __tablename__ = "enrichment_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prospect_id: Mapped[int] = mapped_column(Integer, ForeignKey("prospects.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="running")
    sources_run: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    signals_added: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    prospect: Mapped["Prospect"] = relationship("Prospect", back_populates="enrichment_jobs")
