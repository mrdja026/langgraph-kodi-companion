## Context

The project uses a LangGraph agent (Qwen3:14B via ollama) that calls MCP tools exposed by a TypeScript server. The current architecture has a single `download_and_format_series` tool that handles both TV series and movies through a two-phase protocol (search → download). The tool delegates search to qBittorrent's built-in search plugins via `client.search.start(query, "all")`, which searches all installed plugins across all content categories.

The problem: qBittorrent's "all" category includes academic/book search plugins (libgen, etc.) that return PDFs, ebooks, and papers instead of video content. The agent trusts whatever the tool returns and proceeds to download wrong content. There is no content-type verification at any layer.

Previous design decisions (from archived changes):
- D2 from `qbittorrent-download-integration`: All OS/filesystem operations go through the MCP server (TypeScript), not the agent (Python). This boundary is preserved.
- D1 from `agent-automated-download`: Scraping/search runs server-side, keeping the agent lightweight. This boundary is preserved.

## Goals / Non-Goals

**Goals:**
- Prevent non-video content (PDFs, ebooks, papers) from reaching the agent, at the search result level
- Give the agent clear tool selection: one tool for TV series, one for movies
- Use qBittorrent's native category filtering to restrict search to relevant plugins
- Add file extension filtering as a second defense layer
- Update the system prompt so Qwen3:14B reliably selects the correct tool
- Maintain the existing two-phase protocol (search → download) for both tools

**Non-Goals:**
- Kodi integration (v2.0, out of scope)
- Adding a catch-all tool for non-video downloads (explicitly rejected — we block non-video entirely)
- Jackett/Prowlarr integration — we continue using qBittorrent's built-in search
- Changing the MCP transport or agent framework
- Auto-detecting content type from ambiguous queries (the agent asks the user if unsure)

## Decisions

### D1: Two separate MCP tools vs. single tool with content_type parameter

**Decision:** Two separate tools — `search_and_download_tv_series` and `search_and_download_movie`.

**Alternatives considered:**
- *Single tool with `content_type: "tv" | "movie"` parameter:* Less code duplication, but the model must correctly fill a parameter rather than pick a tool. With Qwen3:14B, tool selection from distinct names/descriptions is more reliable than parameter value selection.
- *Three tools (TV + Movie + catch-all):* The catch-all for PDFs/ebooks serves no purpose since we never want to download non-video content.

**Rationale:** Distinct tool names (`search_and_download_tv_series` vs `search_and_download_movie`) are the strongest signal for tool-calling models. The descriptions and system prompt reinforce the distinction. Two tools is the sweet spot — one tool hides the content type from the model, three tools adds unnecessary complexity.

### D2: qBittorrent category filtering as primary defense

**Decision:** Pass `category: "tv"` or `category: "movies"` to `client.search.start()` instead of the current implicit `"all"`.

**Alternatives considered:**
- *Plugin-level filtering (only enable specific plugins):* Requires knowing which plugins the user has installed and managing that list. Too brittle.
- *Post-search filtering only:* Works but wastes search time querying irrelevant plugins.

**Rationale:** The qBittorrent Web API natively supports category filtering. Each search plugin declares which categories it supports. Academic/book plugins typically only support `"books"` or `"all"` categories, so they won't appear in `"tv"` or `"movies"` category searches. This is the cleanest fix — it uses existing infrastructure and filters at the source.

### D3: Non-video file extension blocking as second defense layer

**Decision:** Add a `NON_VIDEO_EXTENSIONS` blocklist in `searchTorrents()` that rejects results whose `fileName` ends with known non-video extensions (`.pdf`, `.epub`, `.mobi`, `.doc`, `.zip`, `.rar`, etc.).

**Alternatives considered:**
- *Video extension allowlist (only allow `.mkv`, `.mp4`, `.avi`):* Too aggressive — season packs and multi-file torrents often have no file extension in their `fileName` field. An allowlist would reject legitimate results.
- *Title keyword filtering (reject "pdf", "ebook" in title):* Fragile — torrent names vary wildly and could false-positive on legitimate content with these words in the title.

**Rationale:** A blocklist for known non-video extensions catches edge cases where plugins mis-categorize content. Combined with D2 (category filtering), this creates defense-in-depth. Results with no extension or video extensions pass through.

### D4: Expanded site blocklist

**Decision:** Extend `EXCLUDED_SITE_PATTERNS` from 4 entries to include `libgen`, `sci-hub`, `pdf`, `ebook`, `book`, `library`, `arxiv`, `dblp`.

**Rationale:** The current blocklist (`academic`, `acg.rip`, `anidex`, `anime`) was insufficient — the BSDM PDF incident proves academic-adjacent sites are leaking through. A broader pattern set catches more variants.

### D5: Movie save path structure

**Decision:** Movies save to `MEDIA_ROOT/Movies/<SanitizedTitle>/` (flat, no season subdirectory).

**Alternatives considered:**
- *Save directly to `MEDIA_ROOT/<Title>/`:* Mixes movies and TV series at the top level, making Kodi library scanning harder in the future.
- *Save to `MEDIA_ROOT/Movies/<Title> (Year)/`:* Requires the agent to know the release year, adding complexity. Can be added later.

**Rationale:** A `Movies/` prefix cleanly separates movies from TV series in the media root. The sanitized title subdirectory groups related files (movie + subtitles). This also prepares for future Kodi integration where separate content roots simplify library scanning.

### D6: System prompt structure for tool selection

**Decision:** The system prompt explicitly lists both tools with usage conditions and includes a result verification instruction.

**Rationale:** Qwen3:14B performs best with explicit, structured instructions. The prompt will:
1. State when to use each tool (TV series → `search_and_download_tv_series`, movie → `search_and_download_movie`)
2. Provide an example for each tool
3. Instruct the agent to verify result titles look like video content before proceeding to phase 2
4. Tell the agent to ask the user if it cannot determine content type

## Risks / Trade-offs

- **[Category filtering may be too narrow]** Some qBittorrent search plugins may not properly declare `"tv"` or `"movies"` categories, causing them to be excluded from searches even though they have relevant content. → **Mitigation:** If searches return zero results with category filtering, the tool could fall back to `"all"` with strict extension filtering. However, we start with category-only and add fallback only if users report missing results.

- **[Model picks wrong tool]** Qwen3:14B may occasionally pick `search_and_download_movie` for a TV series or vice versa. → **Mitigation:** Both tools apply the same non-video filtering, so even a wrong tool selection won't download PDFs. The worst case is a movie saved with season folder structure or a TV series saved without seasons — annoying but not harmful. The system prompt instructs the agent to ask the user if unsure.

- **[Breaking change]** Removing `download_and_format_series` breaks any existing LangGraph checkpoints. → **Mitigation:** The old tool name was only used in development/testing. Clear the checkpoint SQLite database after deployment.

- **[Magnet URLs don't carry file extensions]** The `fileName` from qBittorrent search results is the torrent name, not individual files inside the torrent. Some torrents may have generic names without extensions. → **Mitigation:** The extension filter is a blocklist (reject known bad), not an allowlist (require known good). Generic names without extensions pass through.
