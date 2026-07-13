## ADDED Requirements

### Requirement: Scan qBittorrent for completed downloads
The `scan_completed_downloads` tool SHALL query the qBittorrent Web API for all torrents with `progress === 1` (100% complete), ordered by `completion_on` descending (most recently completed first). It SHALL return a structured list containing each torrent's name, save path, size, completion date, and inferred type (movie or TV).

The tool infers type by checking the `save_path`: if it contains `Movies\` it is a movie; if it contains a `Season` directory pattern it is a TV show; otherwise, it returns the raw save path for the agent or user to decide.

#### Scenario: Returns completed torrents
- **WHEN** `scan_completed_downloads` is called and qBittorrent has torrents with 100% progress
- **THEN** the result contains a list of those torrents with name, save path, size, completion date, and inferred type

#### Scenario: No completed torrents
- **WHEN** `scan_completed_downloads` is called and no torrents have 100% progress
- **THEN** the tool returns a message indicating no completed downloads were found

#### Scenario: qBittorrent unreachable
- **WHEN** qBittorrent is not running or the Web API is unreachable
- **THEN** the tool returns a descriptive error message indicating the connection failure

### Requirement: Integration with add_to_watchlist
After a successful `scan_completed_downloads` call, the agent SHOULD present the list of completed downloads to the user and offer to add them to the watchlist via `add_to_watchlist`. The tool itself SHALL NOT write to the watchlist — it only reads from qBittorrent.

#### Scenario: No side effects
- **WHEN** `scan_completed_downloads` executes
- **THEN** no files are created, modified, or deleted anywhere on the file system
