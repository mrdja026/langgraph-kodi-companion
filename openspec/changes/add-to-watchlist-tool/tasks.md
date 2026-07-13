## 1. Server: Add-to-Watchlist Tool

- [ ] 1.1 Create `server/src/tools/watchlist_add.ts`: implement `addToWatchlist` function with YAML frontmatter writer, path resolution under `watchlist_root/movie/` and `watchlist_root/tv/`, sanitize title via `sanitizeName`, and path traversal protection
- [ ] 1.2 Add zod input schema for `add_to_watchlist` with fields: `title` (required), `year` (optional number), `type` (required enum "movie"|"tv"), `imdb_url` (optional), `genre` (optional), `status` (optional string, default "downloaded"), `overwrite` (optional boolean, default false)

## 2. Server: Scan-Completed-Downloads Tool

- [ ] 2.1 Create `server/src/tools/completed_downloads.ts`: implement `scanCompletedDownloads` function that queries qBittorrent via existing `createClient()` for torrents with `progress === 1`, ordered by `completion_on` descending
- [ ] 2.2 Add zod input schema (empty — no args needed)
- [ ] 2.3 Implement type inference logic: check `save_path` for `Movies\` (movie) or `Season` directory pattern (TV), else mark as unknown

## 3. Server: Register New Tools

- [ ] 3.1 Register `add_to_watchlist` and `scan_completed_downloads` in `server/src/mcp.ts` with descriptions and input schemas
- [ ] 3.2 Update `read_watchlist` in `server/src/tools/watchlist.ts` to also list `movie/` and `tv/` subdirectories when reading the root directory (read those dirs alongside existing flat files)

## 4. Agent: Tool Registration and Permissions

- [ ] 4.1 Add `"add_to_watchlist"` and `"scan_completed_downloads"` to `REQUIRED_MCP_TOOLS` in `agent/src/agent/tools.py`
- [ ] 4.2 Add `"add_to_watchlist"` to `MUTATING_TOOLS` set and `"scan_completed_downloads"` to `READ_ONLY_TOOLS` set

## 5. Agent: System Prompt Update

- [ ] 5.1 Update system prompt in `agent/src/agent/graph.py` to instruct the agent to call `add_to_watchlist` after a successful download
- [ ] 5.2 Add instruction to use `scan_completed_downloads` when the user asks about recently completed downloads or says "what's new"
