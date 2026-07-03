# LangGraph Agent

Python conversational ReAct agent with MCP tool binding, local LLM inference, and LangSmith observability.

## Quickstart

```bash
cd agent/
python -m uv sync                    # install dependencies
python -m uv run python -m agent.main --thread my-chat
```

## Dependencies

Managed exclusively by **uv** — no pip, poetry, or conda:
```bash
python -m uv add <package>           # add a dependency
python -m uv add --dev <package>     # add a dev dependency
python -m uv sync                    # install everything
```

## Configuration

Copy `.env.example` to `.env` and edit. Key variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_BASE_URL` | `http://localhost:8000/v1` | OpenAI-compatible endpoint |
| `LLM_API_KEY` | `local` | API key for the endpoint |
| `LLM_MODEL` | (required) | Model name |
| `MCP_SERVER_URL` | `http://localhost:3001/mcp` | MCP tool server address |
| `WATCHLIST_ROOT` | (required) | Directory for watchlist reads |
| `MEDIA_ROOT` | (required) | Directory for placeholder files |
| `CHECKPOINT_DB` | `checkpoints.sqlite` | SQLite file for chat history |

## Chat Surfaces

**CLI REPL** (conversations persist in SQLite):
```bash
python -m uv run python -m agent.main --thread <thread-id>
```

**LangGraph Studio** (visual debugger, separate thread store):
```bash
python -m uv run langgraph dev --no-browser
```
Then open `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024`

## Startup Order

1. **Model server** (ollama, vLLM, etc.) — must expose OpenAI-compatible API with tool calling
2. **MCP server** — `cd ../server && npm run dev`
3. **Agent** — either CLI REPL or LangGraph Studio

## Tools

- `read_watchlist` — reads files from `WATCHLIST_ROOT` (over MCP)
- `download_and_format_series` — creates placeholder `.mp4` files (over MCP, stub)
- `duckduckgo_search` — web search via DuckDuckGo (in-process, free, no API key)

Agent startup verifies both MCP tools are discoverable and the LLM endpoint is reachable. Use `--skip-health-check` to bypass.

## TODO

- **Slow graph load in Studio (918ms):** The `graph()` factory connects to MCP and fetches tools on every call. In Studio, this adds ~900ms latency per request. Cache the MCP client connection or pre-warm it at startup.

## Project Structure

```
agent/
├── .env                        # your config
├── .env.example                # template with all variables
├── pyproject.toml              # uv project
├── uv.lock                     # locked dependencies
├── langgraph.json              # Studio manifest
└── src/agent/
    ├── __init__.py
    ├── config.py               # pydantic-settings (reads .env)
    ├── llm.py                  # ChatOpenAI + health check
    ├── tools.py                # MCP binding, retry interceptors, DuckDuckGo
    ├── graph.py                # create_react_agent
    └── main.py                 # CLI entry point
```
