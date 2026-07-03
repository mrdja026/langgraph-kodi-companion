## ADDED Requirements

### Requirement: Standalone OS-native Hono service
The MCP tool server SHALL be an independent, standalone TypeScript project built on the Hono web framework, running natively on its host operating system in a separate codebase from the agent, with its own dependency manifest and startup entry point. It MUST be startable and stoppable independently of the agent and MUST NOT import agent code.

#### Scenario: Server runs without the agent
- **WHEN** the MCP server is started and no agent is running
- **THEN** the server listens on its configured endpoint and responds to `initialize` and `tools/list` from any MCP client

#### Scenario: Independent shutdown
- **WHEN** the server process is stopped while the agent is idle
- **THEN** the agent process is unaffected until its next tool call, which fails with a structured connection error

### Requirement: Industry-standard project structure
The server project SHALL follow industry-standard TypeScript conventions: strict-mode `tsconfig.json`; a `src/` layout separating bootstrap (`index.ts`), MCP wiring (`mcp.ts`), configuration (`config.ts`), and one module per tool (`tools/watchlist.ts`, `tools/series.ts`); zod schemas for all tool inputs; vitest unit tests; and npm scripts for `dev`, `build`, `start`, `test`, and `lint`.

#### Scenario: Standard scripts work
- **WHEN** a developer runs `npm run dev`, `npm test`, or `npm run build` in `server/`
- **THEN** each script performs its conventional function (watch-mode server, test suite, compiled output) without custom setup steps

#### Scenario: Strict compilation
- **WHEN** the project is built with `npm run build`
- **THEN** it compiles under `"strict": true` with no type errors

### Requirement: MCP endpoint served through Hono
The server SHALL expose the MCP Streamable HTTP endpoint at the `/mcp` route of the Hono app, bridging to an `McpServer` instance from the MCP TypeScript SDK via the `@hono/mcp` transport.

#### Scenario: MCP served at /mcp
- **WHEN** an MCP client connects to `http://<host>:<port>/mcp`
- **THEN** the Streamable HTTP handshake and subsequent JSON-RPC exchange succeed through the Hono route

### Requirement: Tool registration with schemas
The server SHALL register exactly two tools — `read_watchlist` and `download_and_format_series` — each with a name, human-readable description, and a zod-defined input schema surfaced as JSON Schema via `tools/list`.

#### Scenario: Tool discovery
- **WHEN** a client sends `tools/list`
- **THEN** the response contains both tools with the input schemas specified below

### Requirement: read_watchlist tool contract
The `read_watchlist` tool SHALL accept `{"directory_path": <string>}` (e.g., `"movies/tv shows to watch"`), resolve it against the server's configured watchlist root (`WATCHLIST_ROOT`), and return the raw file system data from the host OS: for each regular file in the directory, its filename and full text content, concatenated into the tool result. This tool performs a real (confined) read — it is not a stub.

#### Scenario: Directory read returns raw contents
- **WHEN** `read_watchlist` is called with a path to a directory containing watchlist text files
- **THEN** the result contains the raw contents of those files, attributed by filename, with no summarization or transformation

#### Scenario: Missing directory is a tool error
- **WHEN** the resolved directory does not exist
- **THEN** the tool returns an MCP tool error result (not a transport failure) stating the path was not found

#### Scenario: Path traversal rejected
- **WHEN** `directory_path` resolves outside `WATCHLIST_ROOT` (e.g., contains `..` escaping the root)
- **THEN** the tool refuses with an error and performs no file system access outside the root

### Requirement: download_and_format_series tool contract (stub)
The `download_and_format_series` tool SHALL accept `{"series_name": <string>, "seasons": <integer, optional, default 1>, "episodes_per_season": <integer, optional, default 3>}`. Its handler is explicitly a STUB: it MUST NOT perform any real download or media transfer; it SHALL fabricate placeholder data and materialize the standardized directory structure `"<Show Name>/Season <NN>/S<NN>E<NN>.mp4"` (zero-padded) under the server's configured media root (`MEDIA_ROOT`), returning the created paths and a notice that the content is placeholder data.

#### Scenario: Standardized layout produced
- **WHEN** the tool is called with `{"series_name": "Dark", "seasons": 1, "episodes_per_season": 2}`
- **THEN** the resulting structure under the media root is `Dark/Season 01/S01E01.mp4` and `Dark/Season 01/S01E02.mp4`, and the tool result lists both paths and identifies them as placeholders

#### Scenario: No network transfer occurs
- **WHEN** the tool executes
- **THEN** no outbound network request for media content is made — created files contain placeholder bytes only

#### Scenario: Series name sanitized for the file system
- **WHEN** `series_name` contains characters illegal in host-OS paths (e.g., `:` or `/`)
- **THEN** the tool sanitizes the directory name deterministically and reports the sanitized name in its result

#### Scenario: Invalid arguments rejected by schema
- **WHEN** the tool is called without `series_name`
- **THEN** the server returns a JSON-RPC invalid-params error and creates nothing on disk

### Requirement: Server-side execution boundary
All file system operations SHALL execute exclusively inside the MCP server process on its host OS. Tool implementations MUST confine reads to `WATCHLIST_ROOT` and writes to `MEDIA_ROOT`, and the server MUST default its listen address to `127.0.0.1`.

#### Scenario: Writes confined to media root
- **WHEN** `download_and_format_series` executes
- **THEN** every path it creates is inside `MEDIA_ROOT`

#### Scenario: Localhost-only by default
- **WHEN** the server starts with no bind configuration
- **THEN** it listens only on `127.0.0.1` and is not reachable from other machines
