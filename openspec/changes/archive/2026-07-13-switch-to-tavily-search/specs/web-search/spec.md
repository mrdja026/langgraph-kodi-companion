## ADDED Requirements

### Requirement: Web search via Tavily

The agent SHALL use Tavily API for web searches, replacing DuckDuckGo. The tool SHALL be named `web_search`. The agent SHALL use Tavily's default search settings (basic depth, 5 max results). The agent SHALL pass `TAVILY_API_KEY` from configuration when initializing the tool. The agent SHALL NOT retry failed Tavily searches (Tavily is a reliable paid API).

#### Scenario: Basic TV series query
- **WHEN** the LLM calls `web_search` with the query `"best crime thrillers 2026"`
- **THEN** the tool returns structured search results with titles, URLs, and LLM-optimized content snippets

#### Scenario: Parallel fan-out searches
- **WHEN** the LLM fires multiple `web_search` calls in a single turn (e.g., searches for crime, horror, and sci-fi recommendations in parallel)
- **THEN** each search executes independently and returns results, and the LLM synthesizes all responses

#### Scenario: API key missing
- **WHEN** `TAVILY_API_KEY` is not configured
- **THEN** the tool raises a clear configuration error at agent startup
