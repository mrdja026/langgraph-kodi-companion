## Context

The agent currently uses `DuckDuckGoSearchRun` from `langchain_community.tools` for web searches. DuckDuckGo results are unreliable for media recommendations — they often return low-quality snippets, fail on structured queries, and lack the relevance ranking needed for TV/movie discovery. The user already has a Tavily API key, which provides LLM-optimized search results with better structure and relevance.

This is a pure implementation swap: same tool slot, same parallel fan-out pattern, same system prompt structure — just a better search backend.

## Goals / Non-Goals

**Goals:**
- Replace DuckDuckGo web search with Tavily in the LangGraph agent
- Reuse the existing parallel multi-search recommendation pattern (scan library → fan out per genre → synthesize)
- Keep the same tool interface so the system prompt and LLM behavior need minimal changes
- Add `TAVILY_API_KEY` to agent configuration

**Non-Goals:**
- No MCP server changes (server stays untouched)
- No changes to the recommendation workflow or system prompt recommendation logic
- No changes to the existing `scan_media_library` tool or watchlist tools
- Not adding Tavily as a fallback — DuckDuckGo is removed entirely

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Tool name | `web_search` (renamed from `duckduckgo_search`) | System prompt already references `web_search` in the recommendation workflow; this avoids confusing the LLM |
| Search depth | `basic` (default) | User preference; adequate for TV/movie queries |
| Max results | 5 (default) | Matches existing behavior |
| Retry behavior | No retry needed | Tavily is a paid API with reliable uptime; no need for DuckDuckGo's retry logic |
| API key source | `agent/.env` via config model | Consistent with existing `LANGSMITH_API_KEY` pattern |

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Tavily free tier limit (1000 searches/month) | Agent only searches on explicit user requests; typical usage should stay well under limit |
| Tavily API key exposure in `.env` | Already following same pattern as LangSmith key; `.env` is gitignored |
| Tavily outage breaks recommendations | Tavily has SLA-backed uptime; manual override would be to add a fallback later if needed |
| `tavily-python` package may need explicit install | Add to `pyproject.toml` dependencies explicitly |
