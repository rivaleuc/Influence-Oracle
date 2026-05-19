# Influence Oracle

Trustless on-chain **influence authenticity score** for any X/Twitter creator, computed by a panel of validators running diverse LLMs that reach consensus on a 0–100 score.

Built on [GenLayer](https://genlayer.com). Validators fetch the creator's public profile, optional GitHub activity, and optional website, then evaluate five sub-scores — engagement, content, network, integrity, cross-platform — and combine them into an overall rating.

## Why GenLayer

A traditional smart contract cannot read social media, weigh qualitative signals, or judge whether a follower base looks organic. GenLayer's intelligent contracts can. Multiple validators with different LLMs evaluate the same evidence and only reach consensus when they substantially agree, so no single biased model can dictate the result.

## Scoring breakdown

| Sub-score | Weight | What it measures |
|---|---|---|
| Engagement | 30% | Real comments and replies vs follower count |
| Content | 25% | Originality, depth, and value of recent posts |
| Network | 20% | Follower/following ratio, audience overlap, growth shape |
| Integrity | 15% | Account age, verification, bio quality, disclosure of partnerships |
| Cross-platform | 10% | Consistency across GitHub / website / linked platforms |

## Contract API

| Method | Type | Purpose |
|---|---|---|
| `analyze(twitter, github, website)` | write | Compute and store a score for a handle |
| `get_score(twitter)` | view | Read the cached score (free) |
| `total()` | view | How many handles have been scored |

## Network

- **Network:** GenLayer Bradbury Testnet (chain `4221`)
- **Contract:** [`0x70c74D4aC75b192479f6523D2E0931F3E5Dc9eF3`](https://explorer-bradbury.genlayer.com/address/0x70c74D4aC75b192479f6523D2E0931F3E5Dc9eF3)

## Data sources

| Source | Status |
|---|---|
| Twitter/X via nitter mirror + twitter.com / x.com profile pages | best-effort — profile fetches are increasingly restricted, so the LLM is told to lower confidence when Twitter is unreachable rather than penalize the user |
| GitHub public API | reliable |
| Website HTML render | reliable |

## Run the web app locally

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:3000.
