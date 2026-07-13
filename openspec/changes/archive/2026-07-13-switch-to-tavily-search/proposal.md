## Why

DuckDuckGo search results are inconsistent and lack structured data, making it hard for the agent to get reliable, up-to-date recommendations for TV shows and movies. Tavily provides higher-quality, LLM-optimized search results with better relevance and structure, and the user already has an API key.

## What Changes

- **Replace** `duckduckgo_search` tool with `tavily_search` in the LangGraph agent
- Remove the `DuckDuckGoSearchRun` import and dependency from the agent
- Add `tavily` Python package as a dependency
- Add `TAVILY_API_KEY` configuration to the agent's settings
- Keep the parallel multi-search recommendation pattern unchanged
- Keep all MCP server tools unchanged (no server-side changes)

## Capabilities

### New Capabilities
- `web-search`: TV and movie assistant web search using Tavily API for reliable, LLM-optimized content discovery

### Modified Capabilities

None — this is a pure implementation swap with no requirement-level behavior changes.

## Impact

- **Agent** (`agent/`): Replace `langchain_community.tools.DuckDuckGoSearchRun` with `langchain_community.tools.TavilySearchResults`
- **Dependencies**: Remove implicit duckduckgo dependency; add `tavily-python` to `agent/pyproject.toml`
- **Configuration**: Add `TAVILY_API_KEY` env var to `agent/.env` and agent config model
- **Removed**: `duckduckgo_search` tool name and its description
- **No change**: MCP server, system prompt recommendation pattern, parallel search logic
