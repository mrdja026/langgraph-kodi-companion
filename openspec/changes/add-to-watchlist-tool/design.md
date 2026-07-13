## Context

The MCP server (`server/`) currently has tools for reading the watchlist (`read_watchlist`), scanning media library (`scan_media_library`), and downloading content (`search_and_download_tv_series`, `search_and_download_movie`). The watchlist root is at `C:\Users\Mrdjan\Documents\mrdjan.stajic\Tv_langgraph` and currently contains flat `.md` files like "Movies to watch.md" and "Tv Series to Watch.md".

There is no tool to write back to the watchlist — the agent cannot create structured entries after a successful download. The README's TODO explicitly calls out "Write tool to obsidian with frontmatter and md." We need bidirectional watchlist interaction.

The agent runs as a Python process using `langchain-mcp-adapters` to bind MCP tools. The server is TypeScript using Hono + `@modelcontextprotocol/sdk`.

## Goals / Non-Goals

**Goals:**
- New `add_to_watchlist` MCP tool on the server that writes frontmatter markdown to `watchlist_root/movie/{Title}.md` or `watchlist_root/tv/{Title}.md`
- New `scan_completed_downloads` MCP tool that queries qBittorrent for finished torrents
- Update `read_watchlist` to also read from `movie/` and `tv/` subdirectories
- Update agent system prompt to use the new tools
- Path traversal protection on all file writes

**Non-Goals:**
- Migration of existing flat watchlist files to the new frontmatter format
- IMDB/TMDB API metadata enrichment beyond what the user or agent provides
- Modifying or deleting existing watchlist entries
- qBittorrent category tags for watchlist tracking

## Decisions

1. **Separate `add_to_watchlist` tool rather than extending `search_and_download_movie/series`** — keeps tools focused and testable. The download tools return success text; the agent decides whether and when to call the watchlist tool.

2. **Frontmatter stored as YAML in `.md` files** — markdown is human-readable in Obsidian/any editor, and YAML frontmatter is parseable by the agent's `read_watchlist` for structured queries. This aligns with the existing flat `.md` convention.

3. **`scan_completed_downloads` queries qBittorrent directly** — reuses the existing `createClient()` and qBittorrent helpers from `qbittorrent.ts`. Filters torrents with `progress === 1` (100% complete), ordered by `completion_on` descending.

4. **Path traversal guard via `resolveSafe`** — same pattern as `read_watchlist` in `watchlist.ts`. The tool generates the filename from the sanitized title (no user-provided path component), so traversal is inherently prevented.

5. **Sanitized filenames** — reuse `sanitizeName` from `series.ts` to strip illegal filesystem characters from the title.

6. **Watchlist root re-read from config** — uses the same `getConfig().watchlistRoot` as `read_watchlist`, ensuring both tools are consistent.

## Risks / Trade-offs

- **[Write tool on MCP that modifies disk]** → Path traversal guard + confined to `watchlistRoot` + only creates files in `movie/` or `tv/` subdirs (never overwrites existing files arbitrarily)
- **[qBittorrent not running when scanning]** → Graceful error handling like existing download tools; returns message instead of crashing
- **[Race: duplicate watchlist entry]** → Tool overwrites the file; agent is prompted to check `read_watchlist` first
- **[Agent hallucinates metadata]** → All fields are optional except `title` and `type`; the agent can skip unknown fields
