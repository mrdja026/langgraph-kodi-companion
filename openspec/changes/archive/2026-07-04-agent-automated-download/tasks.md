## 1. Torrent Scraper Module

- [x] 1.1 Install `cheerio` npm package in server/
- [x] 1.2 Create `server/src/tools/scraper.ts` with scrape functions for TPB
- [x] 1.3 Implement `searchTorrents(query)` that returns `{ magnetUrl, title, seeders, size }[]`

## 2. Enhanced Series Tool

- [x] 2.1 Update `server/src/tools/series.ts` to use scraper when no magnet_urls provided
- [x] 2.2 Return found magnet URLs in the response so agent can re-invoke with them
- [x] 2.3 Update `server/src/mcp.ts` tool description

## 3. Agent System Prompt

- [x] 3.1 Update `agent/src/agent/graph.py` SYSTEM_PROMPT with download workflow instructions

## 4. Tests

- [x] 4.1 Add tests for scraper integration
- [x] 4.2 Add tests for enhanced series tool flow (auto-search, no results)

## 5. Verify

- [x] 5.1 Run `npm test` in server/ — 16/16 tests pass
- [x] 5.2 Run `npx tsc --noEmit` in server/ — 0 errors
- [x] 5.3 Run end-to-end test — auto-search returns real magnet URLs, download adds to qBittorrent
