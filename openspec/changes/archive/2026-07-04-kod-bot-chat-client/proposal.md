## Why

The LangGraph ReAct agent currently only has two interfaces: a CLI REPL and LangGraph Studio. Neither provides a user-friendly, visually polished experience for interacting with the TV series management assistant. A dedicated web chat client ("Kod-bot") will give users a modern, dark-themed conversational interface that streams agent responses in real-time via the LangGraph Dev Server API (port 2024), making the agent accessible from a browser without requiring terminal knowledge.

## What Changes

- Add a new `client/` directory at the monorepo root containing a React + TypeScript + Vite application
- Implement a single-page chat interface styled with Tailwind CSS using a deep navy-blue color scheme
- Integrate with the LangGraph Dev Server API for thread creation and streamed message exchange (SSE)
- Support real-time token streaming (typewriter effect) for bot responses
- Render bot responses as markdown using react-markdown with remark-gfm
- Provide an auto-expanding textarea input with Enter-to-send and Shift+Enter for newlines
- Show a bouncing-dots loading animation while the agent processes
- Proxy API requests through Vite dev server to avoid CORS issues during development
- Update `pixi.toml` with client dev/build/install tasks

## Capabilities

### New Capabilities
- `chat-ui`: Dark-themed React chat interface with message bubbles, auto-scroll, and responsive layout
- `langgraph-api-client`: API service layer for LangGraph Dev Server (thread management, SSE streaming, message parsing)

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

- **New dependency tree**: React 18, TypeScript, Vite, Tailwind CSS 3, lucide-react, react-markdown, remark-gfm
- **Monorepo structure**: New `client/` directory alongside existing `agent/` and `server/`
- **Runtime requirement**: Requires `langgraph dev` server running on port 2024 (in addition to MCP server on 3001 and Ollama on 11434)
- **Build tooling**: `pixi.toml` updated with new tasks for the client
- **No changes** to the existing agent code, MCP server, or system prompt
