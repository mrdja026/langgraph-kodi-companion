## Context

The MCP server has a single download-related tool (`download_and_format_series`) that originally created empty placeholder `.mp4` files. The agent uses an MCP client to invoke this tool. qBittorrent is installed on the user's Windows machine with a Web UI that exposes a REST API v2 at `http://localhost:8080`.

The tool was originally designed to use qBittorrent's built-in search (Python-based nova plugins), but search plugin installation failed on the user's machine (likely Python not available or plugin source blocked). The revised approach uses the **agent's DuckDuckGo search** to find magnet links, then passes them to the tool for adding to qBittorrent.

## Goals / Non-Goals

**Goals:**
- Replace the placeholder stub with real download via qBittorrent Web API
- Keep the same tool name and return format (backward compatible)
- Accept optional `magnet_urls` array — if provided, add directly to qBittorrent
- If no magnet_urls, return search hints for the agent to find magnets via DuckDuckGo
- Add torrents to qBittorrent with an organized save path under `MEDIA_ROOT/<Series>/Season NN/`
- Surface clear error messages when qBittorrent is unreachable or misconfigured

**Non-Goals:**
- Post-download file organization or renaming (future phase)
- Monitoring download completion status (future phase)
- Using qBittorrent's built-in search plugin system (unavailable)
- Integrating external search engines like Jackett or Prowlarr (future phase)

## Decisions

**D1: Use `@robertklep/qbittorrent` npm package over raw HTTP calls**
- The qBittorrent Web API requires cookie-based auth, version-aware endpoint handling, and multipart form uploads. A client library handles all of this.
- `@robertklep/qbittorrent` is actively maintained (latest release 1.1.0, Jun 2026), fully typed, has zero runtime dependencies.
- Alternative considered: `qbittorrent-api-v2` (6 years stale), raw `fetch()` calls (more boilerplate, error-prone).

**D2: Keep tool server-side (TypeScript/MCP) rather than agent-side (Python)**
- The agent currently has no direct filesystem or OS access — all OS operations go through the MCP server. Putting qBittorrent integration in the server maintains this architectural boundary.
- Alternative considered: agent-side Python client — violates existing architecture.

**D3: Agent searches via DuckDuckGo, tool only adds magnets**
- qBittorrent's built-in search requires Python search plugins that couldn't be installed on the user's machine.
- The agent already has a `duckduckgo_search` tool — it can find magnet links by searching the web.
- This is more flexible: the agent can search any site, not just qBittorrent's plugin list.
- Flow: agent searches → gets magnet URLs → calls tool with magnet_urls array.
- Alternative considered: `download_and_format_series` handles everything end-to-end (failed due to plugin issues).

**D4: Set torrent save path per season rather than downloading to default location**
- The existing `MEDIA_ROOT/<Series>/Season NN/` layout is used by the stub and expected by the agent. Setting `savePath` ensures files land in the right place.
- qBittorrent creates the directory structure automatically when the torrent starts downloading.

## Risks / Trade-offs

- **[qBittorrent not running]** → Tool returns a clear error: "Could not connect to qBittorrent at localhost:8080. Ensure qBittorrent is running with Web UI enabled (Tools → Preferences → Web UI)."
- **[No magnet_urls provided]** → Tool returns search hints with formatted queries (e.g., "Dark S01", "Dark S02") and tells the agent to search DuckDuckGo.
- **[Invalid magnet URL]** → qBittorrent rejects it, tool returns the error.
- **[MEDIA_ROOT not set]** → Tool throws an error before attempting download.
