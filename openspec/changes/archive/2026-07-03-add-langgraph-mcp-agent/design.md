## Context

This is a greenfield change defining two independent projects:

1. **LangGraph Agent (Client)** — a Python application hosting a conversational ReAct agent with persistent multi-turn memory. It performs no OS-level work itself; it reasons, searches the web, and delegates all file system side effects.
2. **Hono MCP Tool Server (Server)** — a standalone TypeScript network service running natively on its host OS, built as an industry-standard Hono project. It owns all file system operations and exposes them as MCP tools. Tool execution is **stubbed** — placeholder data only.

The two communicate exclusively over **MCP Streamable HTTP / SSE transport** carrying **JSON-RPC 2.0** messages. LLM inference is offloaded to a **local GPU** serving an open-weights model behind an **OpenAI-compatible API** (default `http://localhost:8000/v1`) that supports **native tool calling**. All LLM calls and tool invocations are traced to **LangSmith**.

This document is written as an implementation blueprint for lower-cost LLMs: decisions are made explicitly here so implementers do not need to make architectural choices.

Constraints:
- No cloud LLM inference. Outbound cloud dependencies are limited to LangSmith telemetry and anonymous DuckDuckGo search queries.
- Tool execution logic is stubbed: `download_and_format_series` fabricates placeholder data; only `read_watchlist` does a real (confined) directory read.
- The agent runtime must remain OS-agnostic; only the MCP server is OS-native.

## Goals / Non-Goals

**Goals:**
- Conversational, multi-turn chat: the user talks to the agent through a CLI REPL or the LangGraph Studio UI; conversation state persists across turns and process restarts.
- Runnable in LangGraph Studio: the agent project is uv-managed and serves its graph via `uv run langgraph dev`, so the Studio UI can chat with the agent and visualize the ReAct loop (LangSmith free tier covers the traces).
- ReAct-style dynamic tool selection: the LLM decides per turn *whether* it needs a tool, *which* one, and *with what arguments* — including chaining multiple tool calls in one turn.
- Three tools exposed to the loop: `read_watchlist` and `download_and_format_series` over MCP, plus a free agent-side DuckDuckGo web search.
- Clean process/network boundary between reasoning (Python agent) and OS execution (TypeScript Hono server).
- Industry-standard Hono project for the server: strict TypeScript, zod validation, vitest tests, conventional npm scripts.
- Full trace coverage: every ReAct iteration, LLM call, and tool invocation appears in LangSmith.
- Configuration via environment variables with sane localhost defaults, so everything runs on one machine out of the box.

**Non-Goals:**
- Implementing real tool execution logic (actual downloading, real media handling) — handlers are stubs returning placeholder data.
- Authentication/authorization on the MCP server beyond bind-to-localhost defaults (noted as a risk, not solved here).
- Model serving itself (vLLM/llama.cpp configuration is the operator's responsibility; we only consume the OpenAI-compatible API).
- Any custom-built GUI or web chat frontend — the chat surfaces are the CLI REPL and the stock LangGraph Studio UI only.
- Multi-user concurrency: one agent process, one SQLite checkpoint file.

## Decisions

### D1. Agent shape: `create_react_agent` over `MessagesState`
Use LangGraph's prebuilt `create_react_agent` (agent node ↔ tools node loop over message state) instead of a hand-built fixed pipeline. Alternatives considered: fixed four-node topology (rejected — the user needs conversational, per-turn tool decisions); hand-rolled `StateGraph` with a custom tool-calling loop (rejected — `create_react_agent` provides the same loop, checkpointer integration, and tracing with far less code for implementers to get wrong).

The state is the standard message list (`MessagesState`); the system prompt describes the agent's role (media watchlist assistant), the available tools, and when to use each. No custom state fields are required — tool results live in `ToolMessage`s.

The graph module (`src/agent/graph.py`) exposes a module-level compiled graph **without a checkpointer** (see D2/D8) that `langgraph.json` references, so the identical graph serves both the CLI REPL and LangGraph Studio.

### D2. Memory: dual persistence — SqliteSaver for the CLI, dev-server storage for Studio
The exported graph carries NO custom checkpointer: the LangGraph dev server (`langgraph dev`) supplies its own thread persistence and ignores (with a warning) any checkpointer baked into the graph. Persistence therefore depends on the runtime:

- **CLI mode**: the CLI entry point attaches `langgraph-checkpoint-sqlite`'s `SqliteSaver` at compile time, database path from `CHECKPOINT_DB` (default `agent/checkpoints.sqlite`). Each conversation is identified by a `thread_id` passed in the run config; the REPL lets the user start a new thread or resume an existing one by id.
- **Studio mode**: threads are created and resumed through the Studio UI and persisted by the dev server's local storage across dev-server restarts.

The two stores are separate by design — a CLI thread id does not resolve in Studio and vice versa; this is documented in the README. Alternatives considered: `MemorySaver` (rejected — lost on restart, the user wants durable chats), Postgres (rejected — external infrastructure for no benefit at this scale), a single shared store (rejected — the dev server does not accept a custom checkpointer).

### D3. MCP connectivity: `langchain-mcp-adapters` with dynamic tool binding
The agent connects with `MultiServerMCPClient` (streamable HTTP transport) from `langchain-mcp-adapters`, which performs the MCP `initialize` handshake, calls `tools/list`, and converts discovered tools into LangChain tool objects bound directly into the ReAct loop. Alternative considered: raw `mcp` SDK client with hand-wrapped tools (rejected — now that tools are selected dynamically by the LLM, the adapter's automatic schema-to-tool conversion is exactly the right abstraction). At startup the agent verifies both expected tools (`read_watchlist`, `download_and_format_series`) are present and fails fast naming any missing tool.

JSON-RPC framing, session IDs, and SSE event parsing are delegated entirely to the SDK/adapter — implementers MUST NOT hand-roll the wire protocol.

### D4. Inference: OpenAI-compatible endpoint with native tool calling
The agent's chat model targets `LLM_BASE_URL` (default `http://localhost:8000/v1`) via an OpenAI-compatible client (`ChatOpenAI` or the `openai` SDK wrapped for LangChain) with a dummy API key (`LLM_API_KEY`, default `"local"`) and `LLM_MODEL`. The serving endpoint MUST support the OpenAI `tools` request parameter and emit `tool_calls` in responses (e.g., vLLM started with `--enable-auto-tool-choice` and the appropriate `--tool-call-parser`). The old forced-JSON `{"action": ...}` routing contract is dropped — routing is native tool calls interpreted by the ReAct loop. Malformed tool-call arguments are handled by the loop: the tool returns a validation error as a `ToolMessage` and the model gets a chance to correct itself, bounded by the recursion limit (D5).

### D5. Tool set and safety policy
Three tools are bound to the agent:
- `read_watchlist` (MCP, read-only) — may be retried once on transport failure.
- `download_and_format_series` (MCP, mutating-stub) — NEVER auto-retried after a transport failure; the failure is reported into the conversation instead.
- `duckduckgo_search` (native, in-process) — LangChain community DuckDuckGo tool backed by the free `ddgs` package; no API key; it does not cross the MCP boundary because it needs no OS access.

The ReAct loop runs with a recursion limit (`AGENT_RECURSION_LIMIT`, default 25) so a confused model cannot loop tool calls forever; hitting the limit surfaces as an apologetic assistant message, not a crash.

### D6. Server: industry-standard Hono TypeScript project
The server is a conventional Hono project:

```
server/
  package.json        # scripts: dev (tsx watch), build (tsc), start, test (vitest), lint
  tsconfig.json       # strict: true
  .env.example
  src/
    index.ts          # Hono app + @hono/node-server bootstrap, binds MCP_BIND_HOST:MCP_BIND_PORT
    mcp.ts            # McpServer (from @modelcontextprotocol/sdk) wired to Hono at /mcp via @hono/mcp
    config.ts         # env parsing with defaults
    tools/
      watchlist.ts    # read_watchlist: zod schema + real confined directory read
      series.ts       # download_and_format_series: zod schema + STUB handler (placeholder data)
  test/               # vitest unit tests for both tools and path guards
```

`@hono/mcp`'s `StreamableHTTPTransport` bridges the Hono route to the MCP TS SDK's `McpServer`, giving Streamable HTTP/SSE for free. Tool inputs are declared as zod schemas (the SDK derives JSON Schema for `tools/list`). The `download_and_format_series` handler is explicitly a stub: it writes empty placeholder files in the standardized layout and returns the created paths — no network transfer occurs. Alternative considered: Express + SDK transport (rejected — Hono was requested and `@hono/mcp` is the first-party bridge).

### D7. Observability: LangSmith via environment + adapter-provided spans
Enable `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT` (default `langgraph-mcp-agent`). `create_react_agent` auto-traces the loop: each turn produces a parent run containing alternating LLM runs (with messages, completions, model id, token usage) and tool runs (with arguments and results) — one pair per ReAct iteration. MCP tools arrive as LangChain tools via the adapter, so they are traced as `tool` runs automatically; the DuckDuckGo tool likewise. The `thread_id` MUST be attached to run metadata so conversations can be filtered in LangSmith. If `LANGSMITH_API_KEY` is unset the agent runs untraced with a startup warning. Alternative considered: manual `@traceable` wrappers around tool calls (no longer needed — the adapter path already yields distinct tool spans).

### D8. Packaging & runtime: uv-only, LangGraph Studio via `langgraph dev`
The agent project is managed **exclusively by uv** as both package manager and environment manager: `pyproject.toml` with a committed `uv.lock`, `uv sync` to create the venv and install, `uv add` for dependency changes, and every command executed through `uv run` — pip, poetry, and conda are prohibited in docs, scripts, and tasks. The agent uses a `src/` layout:

```
agent/
  pyproject.toml      # uv-managed; deps from proposal; dev dep: langgraph-cli[inmem]
  uv.lock
  langgraph.json      # {"dependencies": ["."], "graphs": {"agent": "./src/agent/graph.py:graph"}, "env": ".env"}
  .env.example
  src/agent/
    __init__.py
    config.py         # env parsing with defaults
    llm.py            # OpenAI-compatible chat model (tool calling)
    tools.py          # MCP tool binding + DuckDuckGo tool
    graph.py          # create_react_agent export, NO checkpointer (Studio-compatible)
    main.py           # CLI REPL entry: attaches SqliteSaver, run via `uv run python -m agent.main`
```

`uv run langgraph dev` boots the local LangGraph API server and opens LangGraph Studio against the `agent` graph. The Hono server keeps npm — uv applies only to the Python project. Alternatives considered: pip/poetry (rejected — uv-only is an explicit requirement driven by the `uv run langgraph dev` workflow).

## Risks / Trade-offs

- **[Small local models are often weak at tool calling]** → Document that the chosen open-weights model must be instruct-tuned with tool-call support (e.g., served by vLLM with `--enable-auto-tool-choice`); keep tool descriptions short and unambiguous; cap the loop with `AGENT_RECURSION_LIMIT` so a flailing model terminates gracefully.
- **[Unauthenticated MCP server executes file system operations]** → Default bind to `127.0.0.1`; document loudly that exposing beyond localhost requires adding an auth layer (out of scope). The server MUST reject `read_watchlist` paths that escape `WATCHLIST_ROOT` (path traversal guard is part of the tool contract).
- **[Mutating tool retried after ambiguous failure → duplicate side effects]** → Policy in D5: `download_and_format_series` is never auto-retried; the error is surfaced into the conversation and the user decides.
- **[SQLite checkpointer assumes a single agent process]** → Accepted: one process, one DB file; document that running two agent instances against the same `CHECKPOINT_DB` is unsupported.
- **[Two persistence stores (Studio vs CLI) may confuse users]** → README documents that thread ids are per-surface; pick one surface per conversation.
- **[Local GPU endpoint or MCP server down at invocation time]** → Startup health checks (models list on the LLM endpoint; tool discovery on MCP) with clear operator-facing errors; per-call timeouts (LLM 120s, MCP 30s); mid-chat failures become assistant-visible error messages, never REPL crashes.
- **[DuckDuckGo rate-limits anonymous queries]** → Accepted for a personal agent; the tool returns its error text into the conversation and the model can answer without search.
- **[LangSmith is a cloud dependency in an otherwise-local system]** → Tracing is fire-and-forget and non-blocking; if `LANGSMITH_API_KEY` is unset, the system runs untraced rather than failing (trade-off: silent observability loss — mitigated by a startup warning log).

## Migration Plan

Greenfield — no migration. Deployment order for a working system:
1. Start the local model server (operator-provided, tool calling enabled) at `http://localhost:8000/v1`.
2. Start the Hono MCP tool server (`server/`, `npm run dev` or `npm start`) at `http://localhost:3001/mcp`.
3. One-time `uv sync` in `agent/`, then — with LangSmith env vars set — either `uv run langgraph dev` (LangGraph Studio UI) or `uv run python -m agent.main --thread <id>` (CLI REPL).

Rollback = stop the two new processes; nothing else is touched. Deleting `CHECKPOINT_DB` erases all conversation history.

## Open Questions

- Which open-weights model to recommend in docs — it must handle tool calling reliably; implementer may pick any tool-call-capable instruct model served by vLLM, but the D4 contract must hold regardless.
- Whether the CLI REPL should list existing `thread_id`s from the checkpoint DB on startup, or accept only an explicit `--thread` argument — default to the simpler explicit argument; revisit if resuming proves clumsy.
