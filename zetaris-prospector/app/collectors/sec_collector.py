"""
SEC EDGAR Collector
===================
Mines 10-K, 10-Q, and 8-K filings for data transformation strategic language.
Only relevant for US public companies — gracefully no-ops for others.
"""
import logging

from app.collectors.base import BaseCollector, CollectorResult

logger = logging.getLogger(__name__)

DATA_STRATEGY_KEYWORDS = [
    "data modernization", "data lake", "data lakehouse", "analytics transformation",
    "cloud migration", "data transformation", "data infrastructure",
    "data platform", "digital transformation", "data-driven strategy",
    "data analytics initiative", "big data", "data warehouse modernization",
    "unified data", "data governance", "analytics capability",
]

STRATEGIC_WEIGHT_PHRASES = [
    # Phrases that indicate this is a STRATEGIC initiative, not just a mention
    "strategic priority", "key initiative", "significant investment",
    "major initiative", "core to our strategy", "fundamental to",
    "critical to our", "investing in data",
]


class SECCollector(BaseCollector):
    SOURCE_NAME = "sec"

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        company_name: str = kwargs.get("company_name", domain.split(".")[0])

        try:
            from edgartools import Company
        except ImportError:
            result.add_error("edgartools not installed — skipping SEC collection")
            return result

        try:
            company = await self._find_company(company_name, domain, result)
            if not company:
                return result

            # Fetch recent filings
            await self._analyse_filings(company, result)

        except Exception as e:
            result.add_error(f"SEC collection failed: {e}")
            logger.debug("SEC error for %s: %s", company_name, e)

        return result

    async def _find_company(self, company_name: str, domain: str, result: CollectorResult):
        """Try to find the company in SEC EDGAR."""
        import asyncio
        from edgartools import Company

        # Edgar company lookup is synchronous
        loop = asyncio.get_event_loop()
        try:
            company = await loop.run_in_executor(None, Company, company_name)
            result.metadata["sec_cik"] = getattr(company, "cik", None)
            return company
        except Exception as e:
            logger.debug("Company not found in SEC EDGAR: %s — %s", company_name, e)
            return None

    async def _analyse_filings(self, company, result: CollectorResult) -> None:
        """Fetch and analyse recent 10-K and 8-K filings."""
        import asyncio

        loop = asyncio.get_event_loop()

        for filing_type in ["10-K", "8-K"]:
            try:
                filings = await loop.run_in_executor(
                    None, lambda: company.get_filings(form=filing_type, limit=3)
                )
                for filing in filings:
                    await self._analyse_single_filing(filing, filing_type, result)
                    if result.signals:  # Stop once we've found signals
                        return
            except Exception as e:
                logger.debug("SEC %s fetch failed: %s", filing_type, e)

    async def _analyse_single_filing(self, filing, filing_type: str, result: CollectorResult) -> None:
        """Extract text from a filing and look for data strategy language."""
        import asyncio
        loop = asyncio.get_event_loop()

        try:
            # Get the filing document text (synchronous operation)
            text = await loop.run_in_executor(None, self._extract_filing_text, filing)
            if not text:
                return

            text_lower = text.lower()
            matched_keywords = [kw for kw in DATA_STRATEGY_KEYWORDS if kw in text_lower]

            if not matched_keywords:
                return

            # Check if it's described as strategic
            has_strategic = any(phrase in text_lower for phrase in STRATEGIC_WEIGHT_PHRASES)

            # Find a relevant snippet for evidence
            snippet = self._extract_snippet(text_lower, matched_keywords[0])

            filing_date = str(getattr(filing, "filing_date", ""))[:10]

            if has_strategic:
                result.add_signal(
                    signal_name="sec_data_transformation_initiative",
                    signal_tier=1,
                    signal_points=10.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"{filing_type} ({filing_date}) describes data strategy as a priority. Keywords: {', '.join(matched_keywords[:4])}. Snippet: ...{snippet}...",
                    evidence_url=getattr(filing, "filing_url", None),
                )
            else:
                result.add_signal(
                    signal_name="news_cloud_migration_mention",
                    signal_tier=3,
                    signal_points=2.0,
                    source=self.SOURCE_NAME,
                    evidence_text=f"{filing_type} ({filing_date}) mentions: {', '.join(matched_keywords[:3])}. Snippet: ...{snippet}...",
                    evidence_url=getattr(filing, "filing_url", None),
                )

        except Exception as e:
            logger.debug("Filing analysis failed: %s", e)

    @staticmethod
    def _extract_filing_text(filing) -> str:
        """Extract text content from a filing object."""
        try:
            # edgartools provides a .text property or document access
            doc = filing.document
            if doc:
                return str(doc)[:500000]  # Limit to 500KB
        except Exception:
            pass
        try:
            return str(filing)[:500000]
        except Exception:
            return ""

    @staticmethod
    def _extract_snippet(text: str, keyword: str, context_chars: int = 200) -> str:
        """Extract a snippet of text around a keyword."""
        idx = text.find(keyword)
        if idx == -1:
            return ""
        start = max(0, idx - context_chars // 2)
        end = min(len(text), idx + len(keyword) + context_chars // 2)
        return text[start:end].replace("\n", " ").strip()
