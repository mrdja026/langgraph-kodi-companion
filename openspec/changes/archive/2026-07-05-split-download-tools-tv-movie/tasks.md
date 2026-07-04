## 1. Search Result Filtering (server/src/tools/qbittorrent.ts)

- [x] 1.1 Add `NON_VIDEO_EXTENSIONS` constant with blocked file extensions (`.pdf`, `.epub`, `.mobi`, `.azw3`, `.djvu`, `.doc`, `.docx`, `.txt`, `.rtf`, `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.cbz`, `.cbr`, `.chm`, `.exe`, `.msi`, `.iso`, `.mp3`, `.flac`, `.wav`, `.ogg`, `.aac`)
- [x] 1.2 Add `isNonVideoFile(fileName: string): boolean` function that checks if fileName ends with a blocked extension (case-insensitive)
- [x] 1.3 Expand `EXCLUDED_SITE_PATTERNS` array to include: `libgen`, `sci-hub`, `pdf`, `ebook`, `book`, `library`, `arxiv`, `dblp`
- [x] 1.4 Add optional `category` parameter to `searchTorrents()` (default `"all"`) and pass it as third argument to `client.search.start(query, "all", category)`
- [x] 1.5 Add `.filter((r: any) => !isNonVideoFile(r.fileName))` to the results pipeline, after the site blocklist filter and before sorting

## 2. TV Series Tool (server/src/tools/series.ts)

- [x] 2.1 Rename exported function from `downloadAndFormatSeries` to `searchAndDownloadTvSeries`
- [x] 2.2 Remove `episodes_per_season` from the Zod schema (it is unused)
- [x] 2.3 Update the search phase to call `searchTorrents(client, query, 1, "tv")` — passing `"tv"` as category
- [x] 2.4 Update the schema export name from `seriesSchema` to `tvSeriesSchema`

## 3. Movie Tool (server/src/tools/movie.ts — new file)

- [x] 3.1 Create `server/src/tools/movie.ts` with Zod schema: `{ title: string, magnet_urls?: string[] }`
- [x] 3.2 Implement `searchAndDownloadMovie()` phase 1: search qBittorrent with `searchTorrents(client, title, 3, "movies")` — category `"movies"`, max 3 results
- [x] 3.3 Implement `searchAndDownloadMovie()` phase 2: add magnets to qBittorrent with save path `MEDIA_ROOT/Movies/<sanitizedTitle>/` (no season subdirectory)
- [x] 3.4 Implement global tracker setting in phase 2 (same as TV tool)
- [x] 3.5 Reuse `sanitizeName()` from series.ts — extract to a shared utility or import

## 4. MCP Tool Registration (server/src/mcp.ts)

- [x] 4.1 Remove the old `download_and_format_series` tool registration
- [x] 4.2 Register `search_and_download_tv_series` tool with description: "Search for and download TV series episodes/seasons via qBittorrent. Auto-searches TV category. Saves to MEDIA_ROOT/<Series>/Season NN/. Non-video results are automatically filtered out."
- [x] 4.3 Register `search_and_download_movie` tool with description: "Search for and download movies via qBittorrent. Auto-searches movies category. Saves to MEDIA_ROOT/Movies/<Title>/. Non-video results are automatically filtered out."
- [x] 4.4 Import `searchAndDownloadMovie` from `./tools/movie.js` and `searchAndDownloadTvSeries` from `./tools/series.js`

## 5. Agent System Prompt (agent/src/agent/graph.py)

- [x] 5.1 Rewrite `SYSTEM_PROMPT` to include guidance for both tools: use `search_and_download_tv_series` for TV series/shows, use `search_and_download_movie` for movies/films
- [x] 5.2 Add two-phase workflow examples for both tools in the system prompt
- [x] 5.3 Add result verification instruction: agent must check that result titles look like video content before proceeding to phase 2; reject results containing "pdf", "ebook", "paper", "textbook"
- [x] 5.4 Add ambiguity handling instruction: if the agent cannot determine whether the user wants a TV series or movie, ask the user

## 6. Tests (server/test/tools.test.ts)

- [x] 6.1 Update existing `downloadAndFormatSeries` tests to use `searchAndDownloadTvSeries` function name
- [x] 6.2 Add test: `searchTorrents` filters out results with `.pdf` extension
- [x] 6.3 Add test: `searchTorrents` filters out results with `.epub` extension
- [x] 6.4 Add test: `searchTorrents` passes through results with `.mkv` extension or no extension
- [x] 6.5 Add test: `searchTorrents` filters out results from `libgen` site URL
- [x] 6.6 Add test: `searchAndDownloadMovie` search phase uses `"movies"` category and returns up to 3 results
- [x] 6.7 Add test: `searchAndDownloadMovie` download phase saves to `MEDIA_ROOT/Movies/<Title>/`
- [x] 6.8 Add test: `searchAndDownloadTvSeries` search phase uses `"tv"` category
- [x] 6.9 Run full test suite with `pixi run test:server` and verify all tests pass

## 7. Cleanup

- [x] 7.1 Delete the SQLite checkpoint database to clear stale tool references from old conversations
- [x] 7.2 Verify both tools appear in the agent's available tools list by running the agent and checking startup logs
