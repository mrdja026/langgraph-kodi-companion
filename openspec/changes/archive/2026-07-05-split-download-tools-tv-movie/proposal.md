## Why

The single `download_and_format_series` MCP tool searches qBittorrent with category `"all"`, which includes academic/book search plugins (libgen, etc.) that return unrelated content — PDFs, ebooks, papers — instead of video files. When a user asks for "Margos Got Money Problems", the tool returns a BSDM-related PDF and the agent (Qwen3:14B) blindly proceeds to download it. There is no content-type verification at any layer: the tool trusts all search results, the agent trusts the tool, and the user gets wrong content.

Splitting into two purpose-built tools (TV series + Movie) with category-scoped qBittorrent searches and non-video file filtering eliminates this class of errors at both the server and agent layers.

## What Changes

- **Split** the single `download_and_format_series` MCP tool into two distinct tools: `search_and_download_tv_series` and `search_and_download_movie`
- **Add qBittorrent category filtering** — TV tool searches category `"tv"`, Movie tool searches category `"movies"`, instead of `"all"` which leaks academic/book plugin results
- **Add non-video file extension blocking** in `searchTorrents()` — reject results whose `fileName` ends with `.pdf`, `.epub`, `.mobi`, `.doc`, `.zip`, `.rar`, and other non-video extensions
- **Expand the site blocklist** in `qbittorrent.ts` to cover more academic/book tracker patterns (`libgen`, `sci-hub`, `ebook`, `book`, `pdf`)
- **Create `movie.ts`** with a simpler download flow — no season loop, saves to `MEDIA_ROOT/Movies/<Title>/`
- **Refactor `series.ts`** to be TV-specific — keep season loop logic, rename exported function
- **Update the agent system prompt** in `graph.py` — guide Qwen3:14B to pick between the two tools based on content type, and verify result titles look like video content before proceeding to download
- **Update MCP tool descriptions** in `mcp.ts` — distinct descriptions that help the model disambiguate TV series vs movies
- **Remove the old `download_and_format_series` tool** — **BREAKING** for any saved agent conversations referencing the old tool name

## Capabilities

### New Capabilities
- `tv-series-download`: MCP tool for searching and downloading TV series via qBittorrent with TV-category scoping, season-based organization, and non-video content filtering
- `movie-download`: MCP tool for searching and downloading movies via qBittorrent with movies-category scoping, flat folder organization, and non-video content filtering
- `search-result-filtering`: Server-side filtering layer that blocks non-video file extensions and expands the site blocklist to prevent academic/book content from reaching the agent

### Modified Capabilities
<!-- No existing specs to modify — specs/ directory is empty -->

## Impact

- **Server code**: `server/src/tools/qbittorrent.ts` (filtering), `server/src/tools/series.ts` (refactor to TV-only), new `server/src/tools/movie.ts`, `server/src/mcp.ts` (two tool registrations)
- **Agent code**: `agent/src/agent/graph.py` (system prompt rewrite for two-tool guidance + result verification)
- **Tests**: `server/test/tools.test.ts` (update existing series tests, add movie tests, add filtering tests)
- **Breaking**: The `download_and_format_series` tool name is removed. Any existing LangGraph checkpoints or saved conversations referencing it will fail on replay
- **No new dependencies** — uses existing `@robertklep/qbittorrent` package and qBittorrent category parameter already supported by the API
