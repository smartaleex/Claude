"""Domain and company name utilities."""
import re
import tldextract


def normalise_domain(raw: str) -> str:
    """Extract the registerable domain from any URL or domain string."""
    extracted = tldextract.extract(raw)
    if extracted.domain and extracted.suffix:
        return f"{extracted.domain}.{extracted.suffix}"
    # Fallback: strip scheme and path
    clean = raw.lower().strip()
    clean = re.sub(r"^https?://", "", clean)
    clean = clean.split("/")[0]
    return clean


def domain_to_slug(domain: str) -> str:
    """Convert domain to a GitHub org slug candidate."""
    extracted = tldextract.extract(domain)
    return extracted.domain.lower()


def company_name_to_slug(name: str) -> str:
    """Convert company name to a URL-safe slug."""
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def extract_company_name_from_domain(domain: str) -> str:
    """Best-effort company name from domain."""
    extracted = tldextract.extract(domain)
    return extracted.domain.replace("-", " ").replace("_", " ").title()
