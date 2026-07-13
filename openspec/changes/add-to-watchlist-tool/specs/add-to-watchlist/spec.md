## ADDED Requirements

### Requirement: Add to watchlist with frontmatter
The `add_to_watchlist` tool SHALL accept `{ title, year?, type, imdb_url?, genre?, status? }`, sanitize the title for the filesystem, and write a markdown file with YAML frontmatter to `watchlist_root/movie/{Title}.md` or `watchlist_root/tv/{Title}.md` depending on the `type` field.

- `title` (string, required): The movie or show title. Used as the filename after sanitization.
- `year` (number, optional): Release year.
- `type` (string, required): Either `"movie"` or `"tv"`. Determines the subdirectory.
- `imdb_url` (string, optional): Full IMDB or TMDb URL.
- `genre` (string, optional): Comma-separated genres.
- `status` (string, optional): Defaults to `"downloaded"` if omitted.

The output file SHALL contain YAML frontmatter with all provided fields plus `date_added` set to the current ISO date, followed by a blank line and an optional body section.

#### Scenario: Create movie entry
- **WHEN** `add_to_watchlist` is called with `{ title: "The Matrix", year: 1999, type: "movie", imdb_url: "https://www.imdb.com/title/tt0133093/", genre: "Action, Sci-Fi", status: "downloaded" }`
- **THEN** the tool creates `watchlist_root/movie/The Matrix.md` with YAML frontmatter containing the provided fields and the current date

#### Scenario: Create TV show entry
- **WHEN** `add_to_watchlist` is called with `{ title: "Dark", type: "tv", status: "watchlist" }`
- **THEN** the tool creates `watchlist_root/tv/Dark.md` with frontmatter containing `title: Dark`, `type: tv`, `status: watchlist`, and `date_added`

#### Scenario: No overwrite without explicit flag
- **WHEN** the target file already exists and `overwrite` is not `true`
- **THEN** the tool returns an existing-entry message and does not modify the file

#### Scenario: Path traversal prevented
- **WHEN** the title contains path traversal characters like `../`
- **THEN** `sanitizeName` strips illegal characters and the resulting path stays within the watchlist root

### Requirement: YAML frontmatter format
The tool SHALL write frontmatter using standard YAML delimiters (`---`), with each non-null field on its own line as `key: value`. String values with special characters SHALL be escaped per YAML 1.2. The `date_added` field SHALL always be present in `YYYY-MM-DD` format.

#### Scenario: Frontmatter well-formed
- **WHEN** the tool creates a file
- **THEN** the file starts with `---\n`, contains valid YAML key-value pairs, ends with `\n---\n`, and can be parsed by a standard YAML parser
