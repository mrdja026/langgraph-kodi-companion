## ADDED Requirements

### Requirement: Tool searches torrent sites for magnets
The system SHALL search public torrent trackers for a given query (e.g., "The Night Manager S01") and return found magnet URLs with metadata.

#### Scenario: Search by series and season query
- **WHEN** the system receives a search query like "The Night Manager S01"
- **THEN** the system SHALL query at least one public torrent site (1337x, TPB, BT4G)
- **THEN** the system SHALL extract magnet URLs and info hashes from search results
- **THEN** the system SHALL return each result with its magnet URL, title, seeders, and size

#### Scenario: No results found
- **WHEN** the search returns zero results
- **THEN** the system SHALL return an empty array

#### Scenario: Site unreachable
- **WHEN** a torrent site is temporarily unreachable
- **THEN** the system SHALL try the next site in the list
- **THEN** the system SHALL NOT fail — it returns whatever results it found

#### Scenario: Magnet URL construction from info hash
- **WHEN** a site only provides an info hash (not a full magnet link)
- **THEN** the system SHALL construct a valid magnet: URL from the info hash

### Requirement: Torrent search result format
Each search result SHALL include magnet URL, title, seeders count, and size.

#### Scenario: Result with all metadata
- **WHEN** the system finds a torrent with full metadata
- **THEN** the result SHALL include `magnetUrl` (string), `title` (string), `seeders` (number), `size` (string)

#### Scenario: Result with minimal metadata
- **WHEN** the system can only extract a magnet URL and title
- **WHEN** seeders or size are not available
- **THEN** the result SHALL still include the result with seeders=0 and size="Unknown"
