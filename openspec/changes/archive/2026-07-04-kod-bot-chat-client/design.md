## Context

The monorepo currently has a Python LangGraph ReAct agent (`agent/`) and a TypeScript MCP tool server (`server/`). The agent is accessible via a CLI REPL or LangGraph Studio. Running `langgraph dev` exposes a REST API on port 2024 that follows the LangGraph Platform API specification, including SSE streaming endpoints. This API is already available — no backend changes are needed.

The client will be a new `client/` directory at the monorepo root: a single-page React application built with Vite, TypeScript, and Tailwind CSS that communicates with the LangGraph dev server.

## Goals / Non-Goals

**Goals:**
- Provide a browser-based chat interface for the existing LangGraph agent
- Stream agent responses token-by-token (typewriter effect) using SSE
- Render markdown in bot responses (bold, lists, code blocks, line breaks)
- Mobile-first responsive design with the specified dark navy-blue color scheme
- Integrate cleanly into the monorepo with `pixi.toml` tasks

**Non-Goals:**
- Authentication or multi-user support
- Persistent chat history across browser sessions (threads live only in the LangGraph server's memory)
- Modifying the agent's system prompt, tools, or graph structure
- Production deployment or build optimization (dev-only for now)
- Tool call visualization (showing intermediate tool invocations in the UI)

## Decisions

### 1. API Communication: LangGraph Dev Server via Vite Proxy

**Decision**: Call the LangGraph Dev Server API (port 2024) with requests proxied through Vite's dev server to avoid CORS issues.

**Rationale**: The dev server already provides a full REST API with SSE streaming. Building a custom FastAPI wrapper would duplicate functionality. A Vite proxy (`/api` → `http://localhost:2024`) keeps the client code clean (relative URLs) and eliminates CORS configuration.

**Alternatives considered**:
- Direct cross-origin requests with CORS headers — fragile, requires server-side CORS config on LangGraph dev server which is not user-controlled
- Custom FastAPI wrapper — unnecessary duplication; more code to maintain

### 2. Streaming: `fetch()` with ReadableStream for SSE

**Decision**: Use the native `fetch()` API with `ReadableStream` to consume SSE streams from `/threads/{id}/runs/stream`.

**Rationale**: The LangGraph Platform API returns `text/event-stream` responses. Using the Fetch API with stream reading avoids adding an EventSource polyfill dependency and gives fine-grained control over parsing SSE events (event type, data payloads). This also handles the `stream_mode: "messages"` format which sends `messages/partial` and `messages/complete` events.

**Alternatives considered**:
- `EventSource` API — limited to GET requests; the streaming endpoint is POST
- Third-party SSE libraries (e.g., `@microsoft/fetch-event-source`) — adds a dependency for something achievable with ~40 lines of native code

### 3. Thread Management: Single Thread per Session

**Decision**: Create one thread on app mount via `POST /threads`. Reuse it for the entire browser session. No thread persistence or listing.

**Rationale**: Matches the simplicity of the CLI REPL experience. Thread management UI (listing, switching, deleting) adds significant complexity with no clear benefit for a single-user local tool.

### 4. Markdown Rendering: react-markdown + remark-gfm

**Decision**: Use `react-markdown` with the `remark-gfm` plugin for rendering bot responses.

**Rationale**: The agent produces markdown-formatted responses (bold text, lists, occasional code blocks). `react-markdown` is the standard React solution — it renders to React elements (no `dangerouslySetInnerHTML`), supports custom component overrides for Tailwind styling, and `remark-gfm` adds GitHub-flavored features (tables, strikethrough, task lists).

### 5. Project Setup: Vite + React 18 + Tailwind CSS 3

**Decision**: Use Vite as the build tool with React 18 and Tailwind CSS 3 (PostCSS-based).

**Rationale**: Matches the TypeScript ecosystem already used in the MCP server. Vite provides fast HMR, built-in proxy support, and minimal config. Tailwind CSS 3 with PostCSS is stable and well-documented.

### 6. Message State Shape

**Decision**: Messages stored as an array of `{ id, role, content, timestamp }` objects in React state. The `role` field is `"user"` or `"assistant"`. During streaming, the last assistant message's `content` is updated incrementally.

**Rationale**: Simple flat structure that maps directly to the LangGraph message format. No need for normalization or external state management — `useState` is sufficient for a single-page chat.

### 7. Assistant ID

**Decision**: Use `"agent"` as the `assistant_id` in API calls, matching the key in `agent/langgraph.json`.

**Rationale**: The LangGraph dev server derives assistant IDs from the graph keys in `langgraph.json`. The current config has `"agent": "./src/agent/graph.py:graph"`.

## Risks / Trade-offs

- **[LangGraph dev server stability]** The dev server is a development tool, not a production server. It may have memory leaks or instability over long sessions. → Mitigation: This is acceptable for a local dev tool. Users can restart the server.

- **[MCP reconnection latency]** The `graph()` factory reconnects to the MCP server on every call from Studio/dev server, adding ~900ms latency. → Mitigation: This is an existing known issue in the agent. The client does not make it worse. Could be addressed separately by optimizing the graph factory.

- **[SSE parsing complexity]** The LangGraph streaming format includes multiple event types (`metadata`, `messages/partial`, `messages/complete`, `end`). Partial messages contain accumulated content, not deltas. → Mitigation: The API client will handle event type filtering and extract content from partial message events.

- **[No error recovery UI]** If the agent errors (LLM unreachable, MCP server down), the user sees a generic error. → Mitigation: Display error messages inline as system messages. Sufficient for a local dev tool.
