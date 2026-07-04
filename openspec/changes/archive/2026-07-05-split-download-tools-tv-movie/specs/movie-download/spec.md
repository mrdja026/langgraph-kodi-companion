## ADDED Requirements

### Requirement: Movie MCP tool registration
The MCP server SHALL register a tool named `search_and_download_movie` with title "Search and Download Movie". The tool description SHALL clearly state it is for movies only, distinct from TV series.

#### Scenario: Tool is registered with correct name and description
- **WHEN** the MCP server starts
- **THEN** a tool named `search_and_download_movie` is available with a description that mentions movies and distinguishes from TV series

### Requirement: Movie tool input schema
The `search_and_download_movie` tool SHALL accept the following parameters:
- `title` (string, required): Title of the movie
- `magnet_urls` (array of strings, optional): Magnet links for phase 2 download

No `seasons` or `episodes_per_season` parameters SHALL be present.

#### Scenario: Valid input with title only
- **WHEN** the tool is called with `{ title: "The Matrix" }`
- **THEN** the input is accepted and the tool proceeds to phase 1 search

#### Scenario: Valid input with magnet URLs
- **WHEN** the tool is called with `{ title: "The Matrix", magnet_urls: ["magnet:?xt=..."] }`
- **THEN** the input is accepted and the tool proceeds to phase 2 download

#### Scenario: Invalid input rejected
- **WHEN** the tool is called with `{ title: "" }`
- **THEN** validation fails with an error about title being required

### Requirement: Movie search uses movies category
When no `magnet_urls` are provided, the tool SHALL search qBittorrent using category `"movies"` instead of `"all"`. The search query SHALL be the movie title as-is (no season/episode formatting). The tool SHALL return the top 3 results sorted by seeders.

#### Scenario: Search phase uses movies category
- **WHEN** the tool is called with `{ title: "The Matrix" }` and no magnet_urls
- **THEN** the tool searches qBittorrent with query `"The Matrix"` and category `"movies"`
- **AND** returns up to 3 results sorted by seeders

#### Scenario: No results found
- **WHEN** qBittorrent returns no results for the movie query
- **THEN** the tool reports "no results found"

### Requirement: Movie download saves to Movies subdirectory
When `magnet_urls` are provided, the tool SHALL add each magnet to qBittorrent with a save path of `MEDIA_ROOT/Movies/<SanitizedTitle>/`. There SHALL be no season subdirectory.

#### Scenario: Download phase saves to Movies directory
- **WHEN** the tool is called with `{ title: "The Matrix", magnet_urls: ["magnet:?xt=..."] }`
- **THEN** the magnet is added with save path `MEDIA_ROOT/Movies/The Matrix/`

#### Scenario: Movie title with special characters is sanitized
- **WHEN** the tool is called with `{ title: "Spider-Man: No Way Home", magnet_urls: ["magnet:?xt=..."] }`
- **THEN** the save path uses a sanitized title with special characters replaced by underscores

### Requirement: Movie tool sets global trackers on download
When downloading (phase 2), the tool SHALL set global trackers in qBittorrent preferences before adding magnets.

#### Scenario: Trackers are set during download phase
- **WHEN** the tool processes a download with magnet_urls
- **THEN** `setGlobalTrackers` is called before any magnets are added

### Requirement: Movie search returns multiple results for user selection
The movie search phase SHALL return up to 3 results (not 1 like TV series) so the agent can present choices to the user. Each result SHALL include title, seeders count, and file size.

#### Scenario: Multiple results returned
- **WHEN** qBittorrent returns 5 results for a movie search
- **THEN** the tool returns the top 3 results sorted by seeders
- **AND** each result includes title, seeders, and size

#### Scenario: Fewer results than maximum
- **WHEN** qBittorrent returns 2 results for a movie search
- **THEN** the tool returns all 2 results

### Requirement: Agent system prompt guides movie tool usage
The agent system prompt SHALL instruct the model to use `search_and_download_movie` when the user asks to download a movie or film. The prompt SHALL include an example of the two-phase workflow and distinguish from TV series usage.

#### Scenario: System prompt mentions movie tool
- **WHEN** the agent is initialized
- **THEN** the system prompt contains instructions to use `search_and_download_movie` for movie requests with a concrete example

#### Scenario: System prompt handles ambiguous queries
- **WHEN** the agent cannot determine whether the user wants a TV series or a movie
- **THEN** the system prompt instructs the agent to ask the user for clarification
