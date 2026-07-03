## Why

We need a locally-hosted, privacy-preserving agent the user can *chat with* across multiple turns — one that reasons over personal media watchlists, searches the web for free, and acts on the host file system without sending data to cloud LLM providers. Today there is no orchestration layer that (a) runs inference on a local GPU, (b) holds a persistent multi-turn conversation, (c) decides for itself when a tool is needed, and (d) executes OS-native tasks safely behind a network boundary — this change establishes that architecture as a blueprint precise enough for lower-cost LLMs to implement the functional code from spec alone.

## What Changes

- Introduce a **conversational ReAct agent** (Client) built with LangGraph Python (`create_react_agent`): the LLM decides per turn whether it needs a tool, which one, and with what arguments — no fixed pipeline.
- Add **multi-turn conversation memory**: LangGraph SQLite checkpointing (`SqliteSaver`) keyed by `thread_id`, so conversations survive agent restarts with zero external infrastructure.
- Introduce an **industry-standard Hono (TypeScript) MCP tool server** (Server): a standalone network service running natively on its host OS, serving the MCP Streamable HTTP / SSE endpoint at `/mcp` (via `@hono/mcp` + the MCP TypeScript SDK) over JSON-RPC 2.0, with strict TypeScript, zod-validated tool inputs, and vitest tests.
- Tool handlers are **stubbed**: `download_and_format_series` fabricates placeholder data only (no real downloading or media handling) while still materializing the standardized `Show Name/Season 01/S01E01.mp4` directory structure; `read_watchlist` performs a real directory read within a confined root.
- Add a **DuckDuckGo web search tool** running agent-side as a native LangChain tool — free, no API key, in-process (it never crosses the MCP boundary).
- MCP tools are **discovered and bound dynamically** at startup via `tools/list` (using `langchain-mcp-adapters`), rather than called by hard-coded name.
- The agent project is managed **exclusively with `uv`** as both package manager and environment manager: `pyproject.toml` with a committed `uv.lock`, `uv sync` to install, and every command executed via `uv run` — no pip, poetry, or conda.
- Add **LangGraph Studio support**: a `langgraph.json` manifest plus `langgraph-cli[inmem]` as a dev dependency so the agent runs under `uv run langgraph dev`, making the Studio UI a second chat surface alongside the CLI REPL (LangSmith free tier covers the traces).
- Offload all LLM inference to a **local GPU endpoint** serving an open-weights model behind an OpenAI-compatible API (default `http://localhost:8000/v1`) that supports native **tool calling**; no cloud inference dependency.
- Route **complete telemetry** — every ReAct iteration, LLM call, and tool invocation (MCP and DuckDuckGo) — to LangSmith traces, with `thread_id` in run metadata.

## Capabilities

### New Capabilities
- `agent-orchestration`: Conversational ReAct loop — dynamic tool binding at startup, per-turn tool-use decisions by the LLM, tool results fed back into the loop, iteration limits, and chat-safe error handling.
- `conversation-memory`: Multi-turn persistence — SQLite checkpointer, `thread_id` scoping, context carry-over across turns, and survival across process restarts.
- `local-inference`: Local GPU inference layer — OpenAI-compatible endpoint contract with native tool calling, model configuration, and timeout/failure handling.
- `mcp-transport`: Client↔Server connection over MCP Streamable HTTP / SSE — session lifecycle, dynamic tool discovery, JSON-RPC 2.0 framing, endpoint configuration, and error/retry semantics.
- `mcp-tool-service`: Standalone OS-native Hono TypeScript MCP server — industry-standard project structure, tool registration with zod schemas, and the `read_watchlist` / `download_and_format_series` contracts (execution stubbed to placeholder data).
- `observability`: LangSmith telemetry mapping — per-turn trace hierarchy across ReAct iterations, LLM runs with token usage, tool spans for MCP and web-search calls, thread metadata.
- `web-search`: Agent-side DuckDuckGo search tool — free, keyless, in-process web lookups available to the ReAct loop.

### Modified Capabilities

<!-- None — this is a greenfield change; no existing specs in openspec/specs/. -->

## Impact

- **New code**: two independent projects — the LangGraph agent (Python client runtime with CLI chat REPL) and the Hono MCP tool server (TypeScript host-OS service). No existing code is modified.
- **Dependencies (agent, Python)**: `langgraph`, `langgraph-checkpoint-sqlite`, `langchain-core`, `langchain-mcp-adapters`, a DuckDuckGo search tool package (`langchain-community` + `ddgs`), `langsmith`, and the `openai` SDK (or `langchain-openai`) for the local endpoint; dev dependency: `langgraph-cli[inmem]`. All agent dependencies are managed by `uv` only, with a committed `uv.lock`.
- **Dependencies (server, TypeScript)**: `hono`, `@hono/mcp`, `@modelcontextprotocol/sdk`, `zod`; tooling: `typescript` (strict), `tsx`, `vitest`, lint/format.
- **External systems**: local GPU model server with tool-calling support (e.g., vLLM with `--enable-auto-tool-choice`) at `http://localhost:8000/v1`; LangSmith (API key + project) for traces; DuckDuckGo (anonymous, free) for web search; LangGraph Studio (local `langgraph dev` server) as the graphical chat/debug surface.
- **Security surface**: the MCP server executes local file system operations — it is the trust boundary; it binds to localhost by default and confines reads/writes to configured roots. The agent itself never touches the target OS directly.
