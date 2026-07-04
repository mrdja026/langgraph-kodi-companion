## ADDED Requirements

### Requirement: Non-video file extension blocking
The `searchTorrents` function SHALL filter out search results whose `fileName` ends with a known non-video file extension. The blocked extensions SHALL include at minimum: `.pdf`, `.epub`, `.mobi`, `.azw3`, `.djvu`, `.doc`, `.docx`, `.txt`, `.rtf`, `.zip`, `.rar`, `.7z`, `.tar`, `.gz`, `.cbz`, `.cbr`, `.chm`, `.exe`, `.msi`, `.iso`, `.mp3`, `.flac`, `.wav`, `.ogg`, `.aac`.

#### Scenario: PDF file is filtered out
- **WHEN** qBittorrent search returns a result with `fileName` ending in `.pdf`
- **THEN** that result is excluded from the returned results

#### Scenario: EPUB ebook is filtered out
- **WHEN** qBittorrent search returns a result with `fileName` ending in `.epub`
- **THEN** that result is excluded from the returned results

#### Scenario: MKV video file passes through
- **WHEN** qBittorrent search returns a result with `fileName` ending in `.mkv`
- **THEN** that result is included in the returned results

#### Scenario: File with no extension passes through
- **WHEN** qBittorrent search returns a result with `fileName` that has no file extension (e.g., "Breaking Bad S01 Complete 1080p")
- **THEN** that result is included in the returned results

#### Scenario: Extension check is case-insensitive
- **WHEN** qBittorrent search returns a result with `fileName` ending in `.PDF` or `.Pdf`
- **THEN** that result is excluded from the returned results

### Requirement: Expanded site blocklist
The `EXCLUDED_SITE_PATTERNS` array SHALL be expanded to include patterns that match academic, book, and document-oriented torrent sites. The expanded list SHALL include at minimum: `academic`, `acg.rip`, `anidex`, `anime`, `libgen`, `sci-hub`, `pdf`, `ebook`, `book`, `library`, `arxiv`, `dblp`.

#### Scenario: Libgen site is blocked
- **WHEN** qBittorrent search returns a result with `siteUrl` containing `libgen`
- **THEN** that result is excluded from the returned results

#### Scenario: Sci-Hub site is blocked
- **WHEN** qBittorrent search returns a result with `siteUrl` containing `sci-hub`
- **THEN** that result is excluded from the returned results

#### Scenario: 1337x site passes through
- **WHEN** qBittorrent search returns a result with `siteUrl` containing `1337x`
- **THEN** that result is included in the returned results

#### Scenario: Site check is case-insensitive
- **WHEN** qBittorrent search returns a result with `siteUrl` containing `LIBGEN` or `LibGen`
- **THEN** that result is excluded from the returned results

### Requirement: Category-scoped search parameter
The `searchTorrents` function SHALL accept an optional `category` parameter (default `"all"`) that is passed as the third argument to `client.search.start()`. This allows callers to restrict searches to specific qBittorrent plugin categories (e.g., `"tv"`, `"movies"`).

#### Scenario: Category parameter passed to qBittorrent
- **WHEN** `searchTorrents` is called with `category: "tv"`
- **THEN** `client.search.start()` is called with `"tv"` as the category argument (third parameter)

#### Scenario: Default category is all
- **WHEN** `searchTorrents` is called without a category parameter
- **THEN** `client.search.start()` is called with `"all"` as the category argument

### Requirement: Filtering is applied in correct order
The search result filtering SHALL apply in this order: (1) site blocklist, (2) file extension blocklist, (3) sort by seeders descending, (4) slice to maxResults. All three filters (site, extension, category) work together as defense-in-depth.

#### Scenario: Multiple filters applied together
- **WHEN** qBittorrent returns 10 results including 3 from blocklisted sites, 2 with PDF extensions, and 5 valid video results
- **THEN** the 3 blocklisted site results are removed
- **AND** the 2 PDF results are removed
- **AND** the remaining 5 results are sorted by seeders and returned (up to maxResults)

#### Scenario: All results filtered out
- **WHEN** qBittorrent returns results but all are either from blocklisted sites or have non-video extensions
- **THEN** an empty array is returned

### Requirement: Agent verifies search results before downloading
The agent system prompt SHALL instruct the model to verify that returned search result titles look like video content (TV episodes or movies) before proceeding to phase 2 download. If result titles contain indicators of non-video content (e.g., "pdf", "ebook", "paper", "textbook"), the agent SHALL reject them and inform the user that no valid video results were found.

#### Scenario: Agent detects suspicious result title
- **WHEN** the search phase returns a result with title containing "pdf" or "ebook"
- **THEN** the system prompt instructs the agent to reject the result and not proceed to download

#### Scenario: Agent accepts valid video result
- **WHEN** the search phase returns a result with title like "Breaking.Bad.S01E01.1080p.BluRay.x264"
- **THEN** the system prompt instructs the agent to proceed with the two-phase workflow
