## ADDED Requirements

### Requirement: Agent automates download end-to-end
The agent SHALL automatically find magnet URLs and download a series when the user requests it, without requiring manual magnet URL input.

#### Scenario: User requests series download
- **WHEN** the user says "download The Night Manager"
- **THEN** the agent SHALL call `download_and_format_series` without magnet_urls first
- **THEN** the tool SHALL return search hints and the agent SHALL use DuckDuckGo to search for "The Night Manager S01" magnets
- **THEN** the agent SHALL pass found magnet URLs back to `download_and_format_series`
- **THEN** the tool SHALL add magnets to qBittorrent

### Requirement: System prompt guides agent workflow
The agent's system prompt SHALL include concrete instructions for the automated download flow.

#### Scenario: Prompt contains step-by-step instructions
- **WHEN** the agent processes a download request
- **THEN** the system prompt SHALL guide it to:
  1. Call `download_and_format_series` without magnet_urls → get search queries
  2. Search DuckDuckGo for each query with " magnet" or " torrent" appended
  3. Look for info hashes (40-char hex) or `magnet:?xt=urn:btih:` links in search results
  4. Construct magnet URLs from info hashes: `magnet:?xt=urn:btih:<HASH>&dn=<name>`
  5. Call `download_and_format_series` again with the magnet_urls array
