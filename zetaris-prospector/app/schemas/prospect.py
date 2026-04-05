from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, field_validator
import tldextract


class ProspectCreate(BaseModel):
    company_name: str
    domain: str
    github_org: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    notes: Optional[str] = None
    tags: list[str] = []

    @field_validator("domain")
    @classmethod
    def normalise_domain(cls, v: str) -> str:
        extracted = tldextract.extract(v)
        if extracted.domain and extracted.suffix:
            return f"{extracted.domain}.{extracted.suffix}"
        return v.lower().strip().removeprefix("http://").removeprefix("https://").split("/")[0]


class ProspectUpdate(BaseModel):
    company_name: Optional[str] = None
    github_org: Optional[str] = None
    linkedin_url: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    employee_count: Optional[int] = None
    hq_country: Optional[str] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None


class SignalOut(BaseModel):
    id: int
    signal_name: str
    signal_tier: int
    signal_points: float
    evidence_text: Optional[str]
    evidence_url: Optional[str]
    source: str
    is_anti_signal: bool
    is_manual: bool
    detected_at: datetime

    model_config = {"from_attributes": True}


class ProspectOut(BaseModel):
    id: int
    company_name: str
    domain: str
    github_org: Optional[str]
    linkedin_url: Optional[str]
    website_url: Optional[str]
    industry: Optional[str]
    employee_count: Optional[int]
    hq_country: Optional[str]
    description: Optional[str]
    icp_score: float
    icp_tier: str
    score_breakdown: Optional[dict[str, Any]]
    enrichment_status: str
    last_enriched_at: Optional[datetime]
    intelligence_profile: Optional[str]
    profile_generated_at: Optional[datetime]
    notes: Optional[str]
    tags: Optional[list[str]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProspectDetail(ProspectOut):
    signals: list[SignalOut] = []


class ProspectListResponse(BaseModel):
    total: int
    items: list[ProspectOut]


class EnrichRequest(BaseModel):
    force: bool = False  # re-enrich even if recently done


class SynthesizeRequest(BaseModel):
    force: bool = False
