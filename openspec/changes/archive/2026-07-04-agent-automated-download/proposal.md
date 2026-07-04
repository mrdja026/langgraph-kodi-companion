## Why

The agent can call `download_and_format_series` but when no magnet URLs are provided it only returns text hints. The agent's DuckDuckGo search tool returns snippets that don't reliably contain `magnet:` links, so the flow stalls. We need automated magnet discovery so the user can say "download Series X" and the agent does everything end-to-end.

## What Changes

- New server-side **torrent scraper** module that queries public torrent sites (1337x, TPB, BT4G) and extracts `magnet:` URLs or info hashes
- Enhanced `download_and_format_series` tool: when no magnet_urls provided, it auto-searches torrent sites and returns real magnet URLs to the agent
- Updated agent system prompt with concrete step-by-step instructions for the automated download workflow
- Retain backward compatibility: explicit `magnet_urls` field still works exactly as before

## Capabilities

### New Capabilities
- `torrent-search`: Server-side scraping of public torrent trackers to find `magnet:` URLs matching a series+season query
- `agent-download-flow`: Agent system prompt instructions that define the automated download workflow

### Modified Capabilities
- (none — existing tool interface is unchanged)

## Impact

- `server/src/tools/scraper.ts` — new module with torrent site scrapers and magnet extraction
- `server/package.json` — add `cheerio` for HTML parsing
- `server/src/tools/series.ts` — add auto-search branch when no magnet_urls
- `server/src/mcp.ts` — tool description updated
- `agent/src/agent/graph.py` — update `SYSTEM_PROMPT` with download workflow
