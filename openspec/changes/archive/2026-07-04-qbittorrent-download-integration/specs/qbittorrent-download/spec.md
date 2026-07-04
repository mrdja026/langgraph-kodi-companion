## ADDED Requirements

### Requirement: Tool accepts series download request
The system SHALL accept a `download_and_format_series` MCP tool call with `series_name` (string, required), `seasons` (number, optional, default 1), `episodes_per_season` (number, optional, default 3), and `magnet_urls` (array of strings, optional).

#### Scenario: Valid request with series name and magnet URLs
- **WHEN** the agent calls `download_and_format_series` with `{ series_name: "Dark", magnet_urls: ["magnet:?xt=urn:btih:abc123"] }`
- **THEN** the system adds the magnet URL to qBittorrent and returns success

#### Scenario: Valid request without magnet URLs (search hints mode)
- **WHEN** the agent calls `download_and_format_series` with `{ series_name: "Dark", seasons: 2 }`
- **THEN** the system returns search hints suggesting the agent search DuckDuckGo for "Dark S01" and "Dark S02"

#### Scenario: Empty series name rejected
- **WHEN** the agent calls `download_and_format_series` with `{ series_name: "" }`
- **THEN** the system SHALL return a validation error

### Requirement: Tool connects to qBittorrent
The system SHALL connect to a running qBittorrent instance using the configured host, port, username, and password.

#### Scenario: Successful connection
- **WHEN** the system attempts to connect to qBittorrent at the configured address
- **THEN** the system SHALL authenticate and verify the connection

#### Scenario: qBittorrent not running
- **WHEN** the system cannot reach qBittorrent at the configured host:port
- **THEN** the system SHALL return an error: "Could not connect to qBittorrent at <host>:<port>. Ensure qBittorrent is running with Web UI enabled (Tools → Preferences → Web UI)."

#### Scenario: Authentication failure
- **WHEN** the system receives an authentication error from qBittorrent
- **THEN** the system SHALL return an error: "qBittorrent authentication failed. Check QBT_USERNAME and QBT_PASSWORD in your .env file."

### Requirement: Tool adds magnet URLs to qBittorrent
The system SHALL add each provided magnet URL to qBittorrent for download with an organized save path.

#### Scenario: Single magnet added
- **WHEN** the system adds a magnet URL to qBittorrent
- **THEN** the system SHALL set the save path to `<MEDIA_ROOT>/<Series>/Season NN/`

#### Scenario: Multiple magnets distributed across seasons
- **WHEN** the system receives 4 magnet URLs for 2 seasons
- **THEN** the system SHALL add 2 magnets to Season 01 and 2 magnets to Season 02

#### Scenario: Magnet add fails
- **WHEN** qBittorrent rejects the magnet URL
- **THEN** the system SHALL report the failure for that specific URL and continue processing remaining magnets

### Requirement: Tool returns search hints when no magnets provided
When no `magnet_urls` are provided, the system SHALL return formatted search queries for the agent to use with DuckDuckGo.

#### Scenario: Search hints for single season
- **WHEN** the tool receives `{ series_name: "Dark" }` without magnet_urls
- **THEN** the system SHALL return hints suggesting the agent search for "Dark S01"

#### Scenario: Search hints for multiple seasons
- **WHEN** the tool receives `{ series_name: "Dark", seasons: 3 }` without magnet_urls
- **THEN** the system SHALL return hints suggesting the agent search for "Dark S01", "Dark S02", and "Dark S03"

### Requirement: Tool config is environment-driven
The qBittorrent connection parameters SHALL be configured via environment variables.

#### Scenario: Full configuration provided
- **WHEN** QBT_HOST, QBT_PORT, QBT_USERNAME, and QBT_PASSWORD are all set in the environment
- **THEN** the system SHALL use those values to connect to qBittorrent

#### Scenario: Default configuration
- **WHEN** no QBT_* variables are set
- **THEN** the system SHALL default to host=localhost, port=8080, username=admin, password=adminadmin
