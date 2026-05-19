# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
import dataclasses
from genlayer import *


CACHE_DAYS = 7


@allow_storage
@dataclasses.dataclass
class Score:
    overall: u256
    engagement: u256
    content: u256
    network: u256
    integrity: u256
    cross_platform: u256
    reasoning: str
    sources_used: str
    twitter_handle: str
    github_handle: str
    website_url: str


class InfluenceOracle(gl.Contract):
    owner: str
    scores: TreeMap[str, Score]
    total_analyzed: u256

    def __init__(self):
        self.owner = str(gl.message.sender_address)
        self.total_analyzed = u256(0)

    @gl.public.write
    def analyze(
        self,
        twitter_handle: str,
        github_handle: str,
        website_url: str,
    ) -> None:
        tw = twitter_handle.strip().lstrip("@").lower()
        gh = github_handle.strip().lstrip("@")
        site = website_url.strip()

        if not tw:
            raise Exception("twitter handle is required (other fields optional)")

        data = self._compute_score(tw, gh, site)

        self.scores[tw] = Score(
            overall=u256(data["overall"]),
            engagement=u256(data["engagement"]),
            content=u256(data["content"]),
            network=u256(data["network"]),
            integrity=u256(data["integrity"]),
            cross_platform=u256(data["cross_platform"]),
            reasoning=data["reasoning"],
            sources_used=data["sources_used"],
            twitter_handle=tw,
            github_handle=gh,
            website_url=site,
        )
        self.total_analyzed += u256(1)

    @gl.public.view
    def get_score(self, twitter_handle: str) -> dict:
        tw = twitter_handle.strip().lstrip("@").lower()
        if tw not in self.scores:
            return {"exists": False}
        s = self.scores[tw]
        return {
            "exists": True,
            "twitter_handle": s.twitter_handle,
            "github_handle": s.github_handle,
            "website_url": s.website_url,
            "overall": int(s.overall),
            "engagement": int(s.engagement),
            "content": int(s.content),
            "network": int(s.network),
            "integrity": int(s.integrity),
            "cross_platform": int(s.cross_platform),
            "reasoning": s.reasoning,
            "sources_used": s.sources_used,
        }

    @gl.public.view
    def total(self) -> int:
        return int(self.total_analyzed)

    def _compute_score(self, twitter_handle: str, github_handle: str, website_url: str) -> dict:
        def leader_fn() -> str:
            sections = []
            sources = []

            # ---- Twitter / X data via multiple fallbacks ----
            # X/Twitter actively blocks public scraping behind auth walls.
            # Jina Reader (r.jina.ai) is a free LLM-oriented proxy that
            # renders JS, follows redirects, and returns clean markdown —
            # purpose-built for exactly this case. Wayback and search
            # follow as defense in depth.
            tw_data = ""
            tw_source = ""

            jina_attempts = [
                f"https://r.jina.ai/https://x.com/{twitter_handle}",
                f"https://r.jina.ai/https://twitter.com/{twitter_handle}",
                f"https://r.jina.ai/https://nitter.net/{twitter_handle}",
            ]
            for url in jina_attempts:
                try:
                    raw = gl.nondet.web.request(url, method="GET")
                    if raw and len(raw) > 1500 and "login" not in raw[:500].lower():
                        tw_data = raw
                        tw_source = "twitter_jina"
                        break
                except Exception:
                    continue

            if not tw_data:
                archive_attempts = [
                    f"https://web.archive.org/web/2024/https://x.com/{twitter_handle}",
                    f"https://web.archive.org/web/2024/https://twitter.com/{twitter_handle}",
                    f"https://web.archive.org/web/2023/https://twitter.com/{twitter_handle}",
                ]
                for url in archive_attempts:
                    try:
                        raw = gl.nondet.web.render(url, mode="html")
                        if raw and len(raw) > 2000 and "Sorry" not in raw[:500]:
                            tw_data = raw
                            tw_source = "twitter_wayback"
                            break
                    except Exception:
                        continue

            if not tw_data:
                try:
                    raw = gl.nondet.web.render(
                        f"https://html.duckduckgo.com/html/?q=site%3Atwitter.com+%40{twitter_handle}",
                        mode="html",
                    )
                    if raw and len(raw) > 1000:
                        tw_data = raw
                        tw_source = "twitter_search"
                except Exception:
                    pass

            if tw_data:
                sections.append(f"TWITTER/X SIGNAL FOR @{twitter_handle} (via {tw_source}):\n{tw_data[:5000]}")
                sources.append(tw_source)
            else:
                sections.append(
                    f"TWITTER/X HANDLE PROVIDED: @{twitter_handle} (no public source returned data — "
                    f"reduce confidence in Twitter-specific signals; do not assume the account is fake)"
                )
                sources.append("twitter_claimed")

            # ---- GitHub (reliable public API) ----
            if github_handle:
                try:
                    user = gl.nondet.web.request(
                        f"https://api.github.com/users/{github_handle}", method="GET"
                    )
                    repos = gl.nondet.web.request(
                        f"https://api.github.com/users/{github_handle}/repos?per_page=10&sort=updated",
                        method="GET",
                    )
                    sections.append(
                        f"GITHUB USER (@{github_handle}):\n{user}\n\nRECENT REPOS:\n{repos}"
                    )
                    sources.append("github")
                except Exception:
                    pass

            # ---- Website (reliable) ----
            if website_url:
                try:
                    site_html = gl.nondet.web.render(website_url, mode="html")
                    sections.append(f"WEBSITE ({website_url}):\n{site_html[:3000]}")
                    sources.append("website")
                except Exception:
                    pass

            data_block = "\n\n---\n\n".join(sections)
            sources_str = ",".join(sources)

            prompt = f"""You evaluate an online creator's INFLUENCE AUTHENTICITY on a 0-100 scale.

A high score means: real engaged audience, original valuable content, organic growth, transparent identity.
A low score means: bought followers, bot engagement, content farms, hype-only posting, sketchy promotions.

Data sources:

{data_block}

Sub-scores (0-100 each):
- engagement: ratio of meaningful interactions (real comments, replies) vs follower count
- content: originality, depth, value of recent posts
- network: follower-to-following ratio, who follows them, account growth shape
- integrity: account age, verified status, bio completeness, disclosure of partnerships
- cross_platform: presence and consistency across GitHub / website / other linked platforms

Compute "overall" as the weighted average:
  engagement * 0.30 + content * 0.25 + network * 0.20 + integrity * 0.15 + cross_platform * 0.10

If a signal is unavailable (e.g. Twitter could not be fetched), do NOT penalize the user — set
that sub-score to a neutral 50 and lower the overall confidence in your reasoning.

Reply ONLY valid JSON of the form:
{{"overall": <int>, "engagement": <int>, "content": <int>, "network": <int>, "integrity": <int>, "cross_platform": <int>, "reasoning": "<two short sentences explaining the score and any data limitations>"}}

No markdown, no code fences, no extra text.
"""
            raw = gl.nondet.exec_prompt(prompt)
            text = raw if isinstance(raw, str) else json.dumps(raw)
            text = text.strip()
            if text.startswith("```"):
                text = text.strip("`")
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            parsed = json.loads(text)
            parsed["sources_used"] = sources_str
            return json.dumps(parsed)

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            try:
                parsed = json.loads(leader_result.calldata)
                for key in (
                    "overall",
                    "engagement",
                    "content",
                    "network",
                    "integrity",
                    "cross_platform",
                ):
                    v = parsed.get(key)
                    if not isinstance(v, int) or v < 0 or v > 100:
                        return False
                if not isinstance(parsed.get("reasoning"), str):
                    return False
                if not isinstance(parsed.get("sources_used"), str):
                    return False
                return True
            except Exception:
                return False

        result_str = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return json.loads(result_str)
