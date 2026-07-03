## ADDED Requirements

### Requirement: LangSmith tracing enabled via environment
The agent SHALL enable LangSmith tracing through standard environment configuration: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, and `LANGSMITH_PROJECT` (default `langgraph-mcp-agent`). When the API key is absent, the agent MUST still run, log a startup warning that tracing is disabled, and skip all trace emission.

#### Scenario: Traces routed to configured project
- **WHEN** the agent runs with a valid `LANGSMITH_API_KEY` and default project
- **THEN** runs appear in the LangSmith project `langgraph-mcp-agent`

#### Scenario: Missing key degrades gracefully
- **WHEN** `LANGSMITH_API_KEY` is unset
- **THEN** the chat runs normally, no trace is sent, and a warning is logged at startup

### Requirement: Per-turn trace covering every ReAct iteration
Each user turn SHALL produce a LangSmith trace with one parent run for the turn containing, per ReAct iteration, the LLM run and any tool runs it triggered. Every LLM call and every tool invocation executed during the turn MUST appear in the trace — none may be absent.

#### Scenario: Multi-iteration turn fully traced
- **WHEN** a turn involves two tool calls before the final answer
- **THEN** the trace shows three LLM runs and two tool runs, nested under the turn's parent run, in execution order

#### Scenario: No-tool turn traced
- **WHEN** a turn is answered directly without tools
- **THEN** the trace contains the parent run and a single LLM run

### Requirement: Tool invocations traced as tool runs
Every tool execution — MCP tools (`read_watchlist`, `download_and_format_series`) and the DuckDuckGo search tool — SHALL appear as a LangSmith run of type `tool`, capturing the tool name, the exact arguments passed, and the raw result or error content. Failed tool calls MUST be traced with error status.

#### Scenario: MCP tool span captured
- **WHEN** the loop calls `read_watchlist`
- **THEN** the trace contains a tool run named for the tool with its `directory_path` argument and the raw returned data

#### Scenario: Search tool span captured
- **WHEN** the loop calls the DuckDuckGo tool
- **THEN** the trace contains a tool run with the query and the returned results

#### Scenario: Failed tool call still traced
- **WHEN** a tool call times out or returns an error
- **THEN** the tool run is recorded with error status and the error content

### Requirement: LLM runs traced with token usage
Each inference call SHALL be traced as an LLM run capturing the full message payload sent to the local endpoint (including tool schemas), the raw completion (including `tool_calls`), the model id, and token usage when the endpoint reports it.

#### Scenario: Inference run recorded
- **WHEN** the model completes a call that emits a tool call
- **THEN** the trace's LLM run shows the request messages, the `tool_calls` content, the model id, and token counts

### Requirement: Thread id in run metadata
Every turn's trace SHALL carry the conversation's `thread_id` in its run metadata so all turns of one conversation can be filtered together in LangSmith.

#### Scenario: Filtering a conversation
- **WHEN** three turns run on thread `movie-night`
- **THEN** filtering LangSmith runs by metadata `thread_id = movie-night` returns exactly those three turn traces

### Requirement: Non-blocking telemetry
Trace emission SHALL be asynchronous/fire-and-forget: LangSmith latency or unavailability MUST NOT delay turns beyond background queuing, and telemetry failures MUST NOT alter agent behavior or corrupt conversation state.

#### Scenario: LangSmith outage does not fail the chat
- **WHEN** LangSmith is unreachable during a turn
- **THEN** the turn completes with the same assistant output it would produce with tracing healthy
