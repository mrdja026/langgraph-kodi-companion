## ADDED Requirements

### Requirement: MCP Streamable HTTP / SSE transport
All communication between the LangGraph agent (client) and the MCP tool server SHALL use the Model Context Protocol Streamable HTTP transport (with SSE streaming for server-to-client messages), carrying JSON-RPC 2.0 messages. The client and server MUST use official MCP SDKs/adapters for transport framing — hand-rolled wire-protocol code is prohibited.

#### Scenario: Tool call over JSON-RPC
- **WHEN** the agent invokes an MCP tool
- **THEN** the request is sent as a JSON-RPC 2.0 `tools/call` message over the Streamable HTTP transport and the result is received as a JSON-RPC response (directly or via SSE stream)

#### Scenario: No direct OS access from agent
- **WHEN** the agent needs file system data or a file system mutation
- **THEN** the only mechanism used is an MCP tool call over this transport — the agent process performs no direct file system reads or writes on the target OS

### Requirement: Configurable server endpoint
The client SHALL resolve the MCP server endpoint from `MCP_SERVER_URL` (default `http://localhost:3001/mcp`). The server SHALL bind its listen address from `MCP_BIND_HOST`/`MCP_BIND_PORT` (defaults `127.0.0.1` and `3001`).

#### Scenario: Defaults connect on one machine
- **WHEN** both processes start with no transport-related environment variables set
- **THEN** the client successfully connects to the server at `http://localhost:3001/mcp`

#### Scenario: Remote server address
- **WHEN** `MCP_SERVER_URL` points at another host
- **THEN** the client connects to that host and performs no localhost fallback

### Requirement: Session lifecycle with dynamic tool discovery
The client SHALL perform the MCP `initialize` handshake before any tool call, then discover tools via `tools/list` and convert them into LangChain tool objects bound into the agent (via `langchain-mcp-adapters`). Discovery happens once at startup; the client MUST fail fast — naming the missing tool — if `read_watchlist` or `download_and_format_series` is absent, and MUST close sessions cleanly on shutdown.

#### Scenario: Handshake precedes tool calls
- **WHEN** the agent starts
- **THEN** the client completes `initialize` and capability negotiation before issuing any `tools/call` request

#### Scenario: Discovered schema drives tool binding
- **WHEN** `tools/list` returns the two tools with their input schemas
- **THEN** the agent binds tools whose names, descriptions, and argument schemas come from the server's response, not from hard-coded client definitions

### Requirement: Timeouts and error mapping
Every MCP tool call SHALL enforce a timeout (`MCP_TIMEOUT_S`, default 30 seconds). Transport failures (connection refused, timeout, dropped SSE session) and JSON-RPC error responses MUST be surfaced as structured tool errors (tool name, error kind, message) into the conversation — never as unhandled exceptions that kill the REPL.

#### Scenario: Timeout surfaces as tool error
- **WHEN** a tool call exceeds the configured timeout
- **THEN** the loop receives a tool result describing the timeout for that tool, and the assistant reports the problem conversationally

#### Scenario: JSON-RPC error passthrough
- **WHEN** the server returns a JSON-RPC error object (e.g., invalid params)
- **THEN** the tool error surfaced to the model includes the server-provided code and message

### Requirement: No automatic retry of mutating calls
The client SHALL NOT automatically retry `download_and_format_series` after a transport failure, because the mutation may have partially executed. Read-only calls (`read_watchlist`, `tools/list`) MAY be retried once.

#### Scenario: Dropped session during mutation
- **WHEN** the SSE session drops while `download_and_format_series` is in flight
- **THEN** the client reports the failure into the conversation without re-invoking the tool, and the user decides whether to try again
