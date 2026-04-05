from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OutreachMessage(Base):
    __tablename__ = "outreach_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prospect_id: Mapped[int] = mapped_column(Integer, ForeignKey("prospects.id"), index=True)

    channel: Mapped[str] = mapped_column(String(50), nullable=False)   # cold-email / linkedin / followup
    target_persona: Mapped[str] = mapped_column(String(100), nullable=False)  # cdo / vp-data / cto
    sender_persona: Mapped[str] = mapped_column(String(50), default="ae")  # ae / sdr

    # Three variants generated per request
    variant_a: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variant_b: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    variant_c: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    key_signals_used: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    model_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    prospect: Mapped["Prospect"] = relationship("Prospect", back_populates="outreach_messages")
