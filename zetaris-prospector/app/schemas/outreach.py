from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class OutreachRequest(BaseModel):
    channel: str = "cold-email"      # cold-email | linkedin | followup
    target_persona: str = "cdo"      # cdo | vp-data | vp-engineering | cto | data-architect
    sender_persona: str = "ae"       # ae | sdr


class OutreachOut(BaseModel):
    id: int
    prospect_id: int
    channel: str
    target_persona: str
    sender_persona: str
    variant_a: Optional[str]
    variant_b: Optional[str]
    variant_c: Optional[str]
    key_signals_used: Optional[list[str]]
    model_used: Optional[str]
    generated_at: datetime

    model_config = {"from_attributes": True}
