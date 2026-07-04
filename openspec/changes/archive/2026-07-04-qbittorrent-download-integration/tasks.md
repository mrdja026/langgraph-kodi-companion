## 1. Dependencies and Configuration

- [x] 1.1 Install `@robertklep/qbittorrent` npm package in server/
- [x] 1.2 Add `QBT_HOST`, `QBT_PORT`, `QBT_USERNAME`, `QBT_PASSWORD` to `server/src/config.ts`
- [x] 1.3 Add qBittorrent env vars to `server/.env.example`

## 2. qBittorrent Client Module

- [x] 2.1 Create `server/src/tools/qbittorrent.ts` with `createClient()`, `checkConnection()`, `addTorrent()`, and `QbtError`
- [x] 2.2 Simplify module: remove qBittorrent built-in search functions (search plugins unavailable)

## 3. Rewrite Series Tool

- [x] 3.1 Add optional `magnet_urls` field to the input schema
- [x] 3.2 If no magnet_urls provided, return search hints for the agent to find magnets via DuckDuckGo
- [x] 3.3 If magnet_urls provided, add them to qBittorrent with `MEDIA_ROOT/<Series>/Season NN/` save path
- [x] 3.4 Distribute magnets across seasons evenly
- [x] 3.5 Handle all error cases: qBittorrent unreachable, auth failure, magnet add failure

## 4. Register Updated Tool

- [x] 4.1 Update `server/src/mcp.ts` description to reflect new magnet-based flow
- [x] 4.2 Update `server/test/tools.test.ts` with mocked qBittorrent for the new flow

## 5. Verify

- [x] 5.1 Run `npm test` in server/ to ensure all tests pass
- [x] 5.2 Run `npx tsc --noEmit` in server/ to ensure no type errors
