## 1. Dependency & Configuration

- [x] 1.1 Add `tavily-python` to `agent/pyproject.toml` dependencies
- [x] 1.2 Add `TAVILY_API_KEY` field to `agent/src/agent/config.py` Settings model
- [x] 1.3 Add `TAVILY_API_KEY` to `agent/.env`

## 2. Tool Implementation

- [x] 2.1 Replace import in `agent/src/agent/tools.py`: swap `DuckDuckGoSearchRun` for `TavilySearchResults`
- [x] 2.2 Rename `create_duckduckgo_tool()` to `create_web_search_tool()` with Tavily defaults (basic depth, 5 max results) and tool name `web_search`

## 3. Graph Integration

- [x] 3.1 Update `agent/src/agent/graph.py`: rename `create_duckduckgo_tool` import to `create_web_search_tool`; rename `duckduckgo` variable to `web_search`

## 4. Verification

- [x] 4.1 Run `agent` Python syntax/import check
- [x] 4.2 Start server + agent and verify `web_search` tool responds with Tavily results
