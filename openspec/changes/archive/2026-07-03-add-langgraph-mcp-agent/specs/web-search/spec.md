## ADDED Requirements

### Requirement: DuckDuckGo search tool available to the agent
The agent SHALL expose a DuckDuckGo web search tool to the ReAct loop, implemented with a free LangChain community tool backed by the `ddgs` package. It MUST require no API key and no paid account, and MUST carry a description that tells the model to use it for current/external information (e.g., release dates, new seasons).

#### Scenario: Web question triggers search
- **WHEN** the user asks something requiring current external information (e.g., "did Severance get a new season?")
- **THEN** the model calls the DuckDuckGo tool and grounds its answer in the returned results

#### Scenario: No credentials required
- **WHEN** the agent starts with no search-related environment variables set
- **THEN** the search tool is fully functional

### Requirement: Search runs in-process, not over MCP
The DuckDuckGo tool SHALL execute inside the agent process as a native tool. It MUST NOT be registered on, or routed through, the MCP server — the MCP boundary is reserved for tools needing host-OS access.

#### Scenario: Search with MCP server down
- **WHEN** the MCP server is stopped and the user asks a pure web-search question
- **THEN** the search tool still works and the agent answers normally

### Requirement: Search results enter the conversation as tool messages
Search output SHALL be returned to the loop as a tool message (result text/snippets), becoming part of the thread's checkpointed history like any other tool result.

#### Scenario: Follow-up on search results
- **WHEN** a search ran on turn 1 and turn 2 asks "summarize that in one line"
- **THEN** the model answers from the search results already in the thread history

### Requirement: Search failures degrade gracefully
DuckDuckGo errors (rate limiting, network failure) SHALL be returned as the tool's result text so the model can acknowledge the failure or answer from its own knowledge. A search failure MUST NOT crash the REPL or the turn.

#### Scenario: Rate-limited search
- **WHEN** the DuckDuckGo backend rejects a query due to rate limiting
- **THEN** the agent produces an assistant message noting search was unavailable (or answering without it), and the conversation continues
