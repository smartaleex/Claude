"""
News Collector
==============
Pulls company news from Guardian API and NewsAPI.org.
Detects strategic data initiatives, executive hires, and funding signals.
"""
import logging
from datetime import datetime, timedelta

import httpx

from app.collectors.base import BaseCollector, CollectorResult
from app.config import settings

logger = logging.getLogger(__name__)

# Keywords that indicate strategic data transformation
DATA_INITIATIVE_KEYWORDS = [
    "data transformation", "data modernization", "cloud migration",
    "data lake", "analytics platform", "data fabric", "data mesh",
    "digital transformation", "data strategy", "analytics transformation",
    "data-driven", "unified data", "data infrastructure",
]

CDO_HIRE_KEYWORDS = [
    "chief data officer", "new cdo", "appoints cdo", "hires cdo",
    "chief technology officer", "appoints cto", "new cto",
    "vp of data", "head of data", "chief analytics officer",
]

FUNDING_KEYWORDS = [
    "series b", "series c", "series d", "funding round", "raises $",
    "million in funding", "venture capital", "investment round",
    "raised $", "secured funding",
]

COMPETITOR_KEYWORDS = [
    "denodo", "dremio", "starburst data", "databricks acquisition",
]

RECENT_DAYS = 90
OLDER_DAYS = 365


class NewsCollector(BaseCollector):
    SOURCE_NAME = "news"

    async def collect(self, domain: str, **kwargs) -> CollectorResult:
        result = CollectorResult()
        company_name: str = kwargs.get("company_name", domain.split(".")[0])

        articles = []

        # Guardian API
        if settings.guardian_api_key:
            guardian_articles = await self._fetch_guardian(company_name, result)
            articles.extend(guardian_articles)

        # NewsAPI.org
        if settings.news_api_key:
            newsapi_articles = await self._fetch_newsapi(company_name, result)
            articles.extend(newsapi_articles)

        # If no API keys, do a lightweight web search fallback
        if not articles:
            result.add_error("No news API keys configured — skipping news collection")
            return result

        # Analyse articles
        self._analyse_articles(articles, company_name, result)
        return result

    async def _fetch_guardian(self, company_name: str, result: CollectorResult) -> list[dict]:
        """Fetch articles from The Guardian API."""
        try:
            resp = await self._get(
                "https://content.guardianapis.com/search",
                params={
                    "q": f'"{company_name}" AND (data OR cloud OR analytics OR technology)',
                    "api-key": settings.guardian_api_key,
                    "page-size": 20,
                    "order-by": "newest",
                    "show-fields": "headline,trailText,firstPublicationDate,webUrl",
                },
            )
            data = resp.json()
            return data.get("response", {}).get("results", [])
        except Exception as e:
            logger.debug("Guardian API failed: %s", e)
            result.add_error(f"Guardian API error: {e}")
            return []

    async def _fetch_newsapi(self, company_name: str, result: CollectorResult) -> list[dict]:
        """Fetch articles from NewsAPI.org."""
        try:
            from_date = (datetime.utcnow() - timedelta(days=OLDER_DAYS)).strftime("%Y-%m-%d")
            resp = await self._get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": f'"{company_name}" AND (data OR cloud OR analytics)',
                    "apiKey": settings.news_api_key,
                    "pageSize": 20,
                    "sortBy": "publishedAt",
                    "language": "en",
                    "from": from_date,
                },
            )
            data = resp.json()
            articles = data.get("articles", [])
            # Normalise to Guardian-like format
            return [
                {
                    "webTitle": a.get("title", ""),
                    "webUrl": a.get("url", ""),
                    "webPublicationDate": a.get("publishedAt", ""),
                    "fields": {"trailText": a.get("description", "")},
                }
                for a in articles
            ]
        except Exception as e:
            logger.debug("NewsAPI failed: %s", e)
            result.add_error(f"NewsAPI error: {e}")
            return []

    def _analyse_articles(
        self, articles: list[dict], company_name: str, result: CollectorResult
    ) -> None:
        """Analyse fetched articles and fire appropriate signals."""
        now = datetime.utcnow()
        recent_cutoff = now - timedelta(days=RECENT_DAYS)

        data_initiative_fired = False
        cdo_hire_fired = False
        funding_fired = False
        competitor_fired = False
        older_cloud_migration = False

        for article in articles:
            title = article.get("webTitle") or article.get("title") or ""
            trail = ""
            if isinstance(article.get("fields"), dict):
                trail = article["fields"].get("trailText") or ""

            pub_date_str = article.get("webPublicationDate") or article.get("publishedAt") or ""
            url = article.get("webUrl") or ""

            combined_text = f"{title} {trail}".lower()

            # Parse publication date
            is_recent = False
            try:
                pub_date = datetime.fromisoformat(pub_date_str.rstrip("Z").split("+")[0])
                is_recent = pub_date >= recent_cutoff
            except Exception:
                pass

            # Data initiative signals
            if not data_initiative_fired:
                matched = [kw for kw in DATA_INITIATIVE_KEYWORDS if kw in combined_text]
                if matched:
                    if is_recent:
                        result.add_signal(
                            signal_name="news_data_platform_initiative",
                            signal_tier=1,
                            signal_points=10.0,
                            source=self.SOURCE_NAME,
                            evidence_text=f"Recent article ({pub_date_str[:10]}): '{title}' — mentions: {', '.join(matched)}",
                            evidence_url=url,
                        )
                        data_initiative_fired = True
                    elif not older_cloud_migration:
                        older_cloud_migration = True
                        result.add_signal(
                            signal_name="news_cloud_migration_mention",
                            signal_tier=3,
                            signal_points=2.0,
                            source=self.SOURCE_NAME,
                            evidence_text=f"Older article ({pub_date_str[:10]}): '{title}' — mentions: {', '.join(matched)}",
                            evidence_url=url,
                        )

            # CDO/CTO hire signals (strongest when recent)
            if not cdo_hire_fired:
                matched = [kw for kw in CDO_HIRE_KEYWORDS if kw in combined_text]
                if matched and is_recent:
                    result.add_signal(
                        signal_name="news_data_platform_initiative",
                        signal_tier=1,
                        signal_points=10.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"CDO/CTO hire detected ({pub_date_str[:10]}): '{title}'",
                        evidence_url=url,
                    )
                    cdo_hire_fired = True

            # Funding signals
            if not funding_fired:
                matched = [kw for kw in FUNDING_KEYWORDS if kw in combined_text]
                if matched:
                    result.add_signal(
                        signal_name="recent_funding_round",
                        signal_tier=2,
                        signal_points=5.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"Funding news ({pub_date_str[:10]}): '{title}'",
                        evidence_url=url,
                    )
                    funding_fired = True

            # Competitor detection (anti-signal)
            if not competitor_fired:
                matched = [kw for kw in COMPETITOR_KEYWORDS if kw in combined_text]
                if matched:
                    result.add_signal(
                        signal_name="anti_known_competitor_customer",
                        signal_tier=0,
                        signal_points=-10.0,
                        source=self.SOURCE_NAME,
                        evidence_text=f"Competitor mention in news: '{title}' — {', '.join(matched)}",
                        evidence_url=url,
                        is_anti_signal=True,
                    )
                    competitor_fired = True
