## Why

The agent currently downloads movies and TV shows via qBittorrent but has no way to add them to the user's watchlist after download. The watchlist is maintained manually in flat markdown files at the watchlist root. We need a tool that lets the agent create structured watchlist entries with YAML frontmatter (title, year, type, imdb_url, date_added, genre, status) organized as `movie/{MovieName}.md` and `tv/{ShowName}.md` files, so the watchlist becomes machine-readable and queryable. Additionally, the tool should detect when qBittorrent downloads complete and offer to add them to the watchlist.

## What Changes

- Add a new `add_to_watchlist` MCP tool on the server that writes markdown files with YAML frontmatter to `watchlist_root/movie/{Title}.md` or `watchlist_root/tv/{Title}.md`
- Add a `scan_completed_downloads` MCP tool (or extend existing) that queries qBittorrent for recently completed torrents
- Update the `read_watchlist` tool to also read from `movie/` and `tv/` subdirectories
- Update the agent's system prompt to call `add_to_watchlist` after successful downloads
- Register new tools in the agent's `REQUIRED_MCP_TOOLS` set
- Move `read_watchlist` from mutating to read-only grouping if needed

## Capabilities

### New Capabilities
- `add-to-watchlist`: MCP tool to create structured markdown entries with YAML frontmatter in `movie/` and `tv/` subdirectories under the watchlist root
- `scan-completed-downloads`: MCP tool to query qBittorrent for torrents with 100% progress and return their metadata for watchlist addition

### Modified Capabilities
- `mcp-tool-service`: The `read_watchlist` tool's reading scope expands to include `movie/` and `tv/` subdirectories; a new `add_to_watchlist` tool is added with write access confined to the watchlist root

## Impact

- **`server/src/tools/`**: New files `watchlist_add.ts` and `completed_downloads.ts`
- **`server/src/mcp.ts`**: Register new tools
- **`agent/src/agent/tools.py`**: Add new tool names to `REQUIRED_MCP_TOOLS`, update `MUTATING_TOOLS` set
- **`agent/src/agent/graph.py`**: Update system prompt to include `add_to_watchlist` in the post-download workflow
- **Watchlist disk structure**: New `movie/` and `tv/` subdirectories will be created alongside existing flat files
