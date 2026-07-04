## Why

The `download_and_format_series` MCP tool is a stub that creates empty placeholder `.mp4` files — it doesn't actually download media. To make the agent useful for real media acquisition, the stub must be replaced with actual download capability via qBittorrent's Web API, which is already installed on the user's system.

## What Changes

- Rewrite `server/src/tools/series.ts` to replace the placeholder stub with real qBittorrent Web API integration
- Add a new QBT_* environment variable group for qBittorrent connection settings
- Install `@robertklep/qbittorrent` npm package on the MCP server
- Update `server/src/config.ts` to read qBittorrent connection config
- Update `server/src/mcp.ts` tool description to reflect real download behavior
- Update `server/.env.example` with qBittorrent configuration docs
- Update `server/test/tools.test.ts` to cover the new real download flow
- No breaking changes — the tool name, schema, and return type remain the same

## Capabilities

### New Capabilities
- `qbittorrent-download`: Connects to a running qBittorrent instance via its Web API, searches for torrents using qBittorrent's built-in search plugins (e.g., 1337x, LimeTorrents), selects the best-matching result, adds it to qBittorrent for download with a save path under `MEDIA_ROOT/<Series>/Season NN/`, and reports the result back to the agent.

### Modified Capabilities
- (none)

## Impact

- **Server**: `server/package.json` gets a new dependency (`@robertklep/qbittorrent`)
- **Server config**: `QBT_HOST`, `QBT_PORT`, `QBT_USERNAME`, `QBT_PASSWORD` added
- **Tool behavior**: `download_and_format_series` will now download real media instead of creating empty files
- **External dependency**: Requires qBittorrent running with Web UI enabled (default port 8080)
- **Agent**: No changes needed — the agent calls the same tool with the same interface
