## ADDED Requirements

### Requirement: TV series MCP tool registration
The MCP server SHALL register a tool named `search_and_download_tv_series` with title "Search and Download TV Series". The tool description SHALL clearly state it is for TV series episodes and seasons only. The old `download_and_format_series` tool SHALL be removed.

#### Scenario: Tool is registered with correct name and description
- **WHEN** the MCP server starts
- **THEN** a tool named `search_and_download_tv_series` is available with a description that mentions TV series, seasons, and episodes

#### Scenario: Old tool is removed
- **WHEN** the MCP server starts
- **THEN** no tool named `download_and_format_series` is registered

### Requirement: TV series tool input schema
The `search_and_download_tv_series` tool SHALL accept the following parameters:
- `series_name` (string, required): Name of the TV series
- `seasons` (integer, min 1, default 1): Number of seasons to search/download
- `magnet_urls` (array of strings, optional): Magnet links for phase 2 download

The `episodes_per_season` parameter from the old tool SHALL be removed as it is unused.

#### Scenario: Valid input with series name only
- **WHEN** the tool is called with `{ series_name: "Breaking Bad", seasons: 3 }`
- **THEN** the input is accepted and the tool proceeds to phase 1 search

#### Scenario: Valid input with magnet URLs
- **WHEN** the tool is called with `{ series_name: "Breaking Bad", seasons: 3, magnet_urls: ["magnet:?xt=..."] }`
- **THEN** the input is accepted and the tool proceeds to phase 2 download

#### Scenario: Invalid input rejected
- **WHEN** the tool is called with `{ series_name: "" }`
- **THEN** validation fails with an error about series_name being required

### Requirement: TV series search uses TV category
When no `magnet_urls` are provided, the tool SHALL search qBittorrent using category `"tv"` instead of `"all"`. The search query SHALL be formatted as `"<series_name> S<NN>"` for each season (zero-padded to 2 digits).

#### Scenario: Search phase uses TV category
- **WHEN** the tool is called with `{ series_name: "Dark", seasons: 2 }` and no magnet_urls
- **THEN** the tool searches qBittorrent with query `"Dark S01"` and category `"tv"` for season 1
- **AND** searches with query `"Dark S02"` and category `"tv"` for season 2

#### Scenario: No results found for a season
- **WHEN** qBittorrent returns no results for a season query
- **THEN** the tool reports "no results found" for that season and continues to the next

### Requirement: TV series download saves to season directories
When `magnet_urls` are provided, the tool SHALL add each magnet to qBittorrent with a save path of `MEDIA_ROOT/<SanitizedSeriesName>/Season S<NN>/`. Magnets SHALL be distributed evenly across the requested number of seasons.

#### Scenario: Download phase creates season directories
- **WHEN** the tool is called with `{ series_name: "Dark", seasons: 2, magnet_urls: ["magnet:?xt=...1", "magnet:?xt=...2"] }`
- **THEN** the first magnet is added with save path `MEDIA_ROOT/Dark/Season S01/`
- **AND** the second magnet is added with save path `MEDIA_ROOT/Dark/Season S02/`

#### Scenario: Series name with special characters is sanitized
- **WHEN** the tool is called with `{ series_name: "The Night Manager: Season 2", seasons: 1, magnet_urls: ["magnet:?xt=..."] }`
- **THEN** the save path uses a sanitized name with special characters replaced by underscores

### Requirement: TV series tool sets global trackers on download
When downloading (phase 2), the tool SHALL set global trackers in qBittorrent preferences before adding magnets.

#### Scenario: Trackers are set during download phase
- **WHEN** the tool processes a download with magnet_urls
- **THEN** `setGlobalTrackers` is called before any magnets are added

### Requirement: Agent system prompt guides TV series tool usage
The agent system prompt SHALL instruct the model to use `search_and_download_tv_series` when the user asks to download a TV series, TV show, or TV episodes. The prompt SHALL include an example of the two-phase workflow.

#### Scenario: System prompt mentions TV series tool
- **WHEN** the agent is initialized
- **THEN** the system prompt contains instructions to use `search_and_download_tv_series` for TV series requests with a concrete example

#### Scenario: System prompt instructs result verification
- **WHEN** the agent receives search results from the TV tool
- **THEN** the system prompt instructs the agent to verify that result titles look like TV episodes before proceeding to phase 2
