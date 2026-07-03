## ADDED Requirements

### Requirement: Conversational ReAct agent
The agent SHALL be built as a LangGraph ReAct agent (`create_react_agent`) operating over message state: on each user turn the LLM decides whether to answer directly or to call one or more tools, tool results are fed back into the loop as tool messages, and the turn ends with a conversational assistant message. The graph topology MUST NOT hard-code which tools run on a given turn.

#### Scenario: Direct answer without tools
- **WHEN** the user sends a message the model can answer from conversation context alone (e.g., "what did I just ask you?")
- **THEN** the agent responds conversationally without invoking any tool

#### Scenario: Tool-assisted answer
- **WHEN** the user asks something requiring external data (e.g., "what's on my watchlist?")
- **THEN** the LLM emits a tool call, the tool result is appended as a tool message, and the model produces a final assistant message grounded in that result

#### Scenario: Multiple tools chained in one turn
- **WHEN** a request requires several steps (e.g., "check my watchlist and search the web for which of those shows has a new season")
- **THEN** the loop executes multiple tool-call iterations within the same turn before producing the final answer

### Requirement: Dynamic tool binding at startup
The agent SHALL assemble its tool set at startup by discovering MCP tools from the server (converted to LangChain tools via `langchain-mcp-adapters`) and adding the native DuckDuckGo search tool. It MUST verify that `read_watchlist` and `download_and_format_series` are present in the discovered set and fail fast — naming the missing tool — before accepting any user input if either is absent.

#### Scenario: Tools discovered and bound
- **WHEN** the agent starts with the MCP server reachable
- **THEN** the ReAct loop has exactly three tools available: `read_watchlist`, `download_and_format_series`, and the DuckDuckGo search tool

#### Scenario: Missing tool fails fast
- **WHEN** the MCP server's `tools/list` omits `download_and_format_series`
- **THEN** the agent exits at startup with an error naming that tool, before the chat REPL opens

### Requirement: LLM-driven tool selection with correct arguments
Which tool to call, and with what arguments, SHALL be decided solely by the LLM's native tool calls — no keyword routing or hand-written dispatch logic. The system prompt MUST describe the agent's role and each tool's purpose so the model can choose appropriately.

#### Scenario: Watchlist request selects the MCP read tool
- **WHEN** the user asks "read my watchlist in 'movies/tv shows to watch'"
- **THEN** the model calls `read_watchlist` with `directory_path` set to that path, not the search or download tool

#### Scenario: Download intent selects the mutating tool
- **WHEN** the conversation establishes the user wants a specific series fetched
- **THEN** the model calls `download_and_format_series` with the series name as its argument

### Requirement: Bounded iteration
The ReAct loop SHALL run with a recursion limit configured via `AGENT_RECURSION_LIMIT` (default 25). When the limit is reached, the turn MUST end with an assistant message explaining the agent could not complete the request — the process MUST NOT crash and the conversation MUST remain usable.

#### Scenario: Runaway loop terminated gracefully
- **WHEN** the model keeps emitting tool calls until the recursion limit is hit
- **THEN** the user receives an explanatory assistant message and can continue chatting on the same thread

### Requirement: Chat-safe error handling
Tool failures (transport errors, timeouts, validation errors) SHALL be surfaced back into the conversation as tool/assistant messages so the model can react or apologize. A failed tool call MUST NOT terminate the REPL or corrupt the thread's checkpointed state.

#### Scenario: MCP server down mid-conversation
- **WHEN** a tool call fails because the MCP server is unreachable
- **THEN** the agent replies with a message stating the tool service is unavailable, and the next user turn works normally once the server is back

#### Scenario: Invalid tool arguments self-corrected
- **WHEN** the model emits a tool call with arguments that fail the tool's schema validation
- **THEN** the validation error is returned as the tool result and the model may retry with corrected arguments within the same turn's iteration budget

### Requirement: uv-only tooling and LangGraph Studio compatibility
The agent project SHALL be managed exclusively with `uv` as both package manager and environment manager (`pyproject.toml` with committed `uv.lock`; installation via `uv sync`; all commands via `uv run` — no pip, poetry, or conda). It SHALL include a `langgraph.json` manifest referencing the exported graph and `langgraph-cli[inmem]` as a dev dependency, so the agent runs in LangGraph Studio via `uv run langgraph dev`. The graph export referenced by the manifest MUST NOT attach a custom checkpointer (the dev server provides persistence).

#### Scenario: Studio dev server serves the graph
- **WHEN** `uv run langgraph dev` is executed in the agent project after `uv sync`
- **THEN** the local LangGraph API server starts, lists the `agent` graph from `langgraph.json`, and LangGraph Studio can open a chat against it

#### Scenario: Same behavior in Studio as in the CLI
- **WHEN** a user chats with the agent through the Studio UI
- **THEN** the same ReAct loop, dynamic tool selection, iteration bounds, and chat-safe error handling apply as in the CLI REPL

#### Scenario: No non-uv tooling referenced
- **WHEN** the agent's documentation, scripts, and manifests are inspected
- **THEN** every install/run instruction for the agent uses `uv` (`uv sync`, `uv add`, `uv run`) and none reference pip, poetry, or conda
