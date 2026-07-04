## Context

The `download_and_format_series` tool currently has two modes:
1. **With `magnet_urls`** — adds magnets to qBittorrent (works great)
2. **Without `magnet_urls`** — returns text search hints telling the agent what to search for

Mode 2 doesn't actually help because the agent's DuckDuckGo search tool returns text snippets from torrent pages, not raw `magnet:` links. The agent can't reliably extract magnet URLs from those snippets, so the flow stalls at search hints.

The solution: add server-side torrent site scraping to find real magnet URLs when the tool is called without magnets, and update the agent's system prompt to coordinate the full flow.

## Goals / Non-Goals

**Goals:**
- Auto-discover magnet URLs from public torrent sites when none are provided
- Return usable magnet URLs to the agent (not just text hints)
- Update agent system prompt to guide it through the download workflow
- Keep backward compatibility: explicit `magnet_urls` still works identically

**Non-Goals:**
- Post-download organization or monitoring (future phase)
- Building a full torrent search engine — just find magnets for the given query
- Scraping private trackers or requiring API keys

## Decisions

**D1: Scraper runs server-side, not agent-side**
- The server has HTTP access and can use libraries like `cheerio` for HTML parsing
- Agent-side scraping would require Python HTML parsing libs and make the agent heavier
- Server-side keeps the agent lightweight and focused on orchestration

**D2: Use `cheerio` for HTML parsing over headless browser**
- `cheerio` is a lightweight jQuery-like parser for HTML, no browser needed
- Torrent sites serve simple HTML tables — no JS rendering needed for search result pages
- Alternatives: Puppeteer (heavy, requires Chrome), raw regex (fragile)

**D3: Scrape multiple sites, fallback if one fails**
- Primary: 1337x.to (reliable, simple HTML structure)
- Fallback: BT4G (aggregates from multiple sources, clean results)
- Some sites block automated requests — use common User-Agent headers and timeouts
- If all sites fail, return empty array (agent can still try DuckDuckGo)

**D4: Tool returns magnets directly instead of search hints**
- When no `magnet_urls` provided, the tool now scrapes torrent sites
- Returns the found magnets in a structured format the agent can immediately use
- Agent just re-calls the tool with those magnets — no manual extraction needed

**D5: System prompt guides agent workflow explicitly**
- The agent needs clear step-by-step instructions for the flow
- Without explicit instructions, LLMs often get stuck or skip steps
- Instructions should include concrete examples of magnet URL construction

## Risks / Trade-offs

- **[Torrent site blocks scraper]** → Use multiple sites with fallback. Update selectors if sites change HTML structure. Add delays between requests.
- **[No torrents found]** → Return empty array, agent can still fall back to DuckDuckGo search for obscure content.
- **[Server timeout]** → Set scraper timeout to 15s per site, max 30s total. MCP tool timeout is 120s by default.
- **[HTML structure changes]** → Torrent sites periodically change layout. Scraper uses specific CSS selectors that may need maintenance. Mitigation: keep scrape logic in one module with clear selectors per site.
