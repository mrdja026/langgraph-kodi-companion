# LangGraph MCP Agent

Conversational ReAct agent with an MCP tool server — local LLM inference, LangGraph orchestration, LangSmith observability.

This repo lives at: `C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation`

It contains **two independent projects** in one repo:

| Project         | Dir       | Lang       | Manager             | Port |
| --------------- | --------- | ---------- | ------------------- | ---- |
| LangGraph Agent | `agent/`  | Python     | uv (`python -m uv`) | —    |
| MCP Tool Server | `server/` | TypeScript | npm                 | 3001 |

They communicate over **MCP Streamable HTTP** (JSON-RPC 2.0). The LLM runs on a **local GPU endpoint** at port 8000.

---

## Step-by-Step: First Run

### 0. Prerequisites

| Tool         | How to check             | Where to get it  |
| ------------ | ------------------------ | ---------------- |
| Python 3.12+ | `python --version`       | python.org       |
| uv           | `python -m uv --version` | `pip install uv` |
| Node.js 22+  | `node --version`         | nodejs.org       |
| npm          | `npm --version`          | ships with Node  |

### 1. Install dependencies

**Agent (Python):**

```
cd C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\agent
python -m uv sync
```

**Server (TypeScript):**

```
cd C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\server
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` in both folders and edit them.

**`agent\.env`:**

```
LLM_BASE_URL=http://localhost:8000/v1
LLM_API_KEY=local
LLM_MODEL=                   # set your model name here
WATCHLIST_ROOT=C:\Users\Mrdjan\Documents\mrdjan.stajic\Tv_langgraph
MEDIA_ROOT=                  # where placeholder files go
LANGSMITH_API_KEY=           # optional, for LangSmith traces
LANGSMITH_TRACING=false      # set true if you set a key
```

**`server\.env`** (server automatically loads this via `dotenv`):

```
MCP_BIND_HOST=127.0.0.1
MCP_BIND_PORT=3001
WATCHLIST_ROOT=C:\Users\Mrdjan\Documents\mrdjan.stajic\Tv_langgraph
MEDIA_ROOT=
```

### 3. Start the LLM model server

Start a local model server with OpenAI-compatible API and tool calling support.

**Option A — ollama (recommended, CPU-friendly):**

```bash
ollama pull qwen2.5:3b   # or any tool-calling model
ollama serve             # already running if you used 'ollama pull'
```

Set `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama`, `LLM_MODEL=qwen2.5:3b` in `agent/.env`.

**Option B — vLLM (GPU):**

```bash
vllm serve <model-name> --enable-auto-tool-choice --tool-call-parser <parser>
```

Set `LLM_BASE_URL=http://localhost:8000/v1`, `LLM_API_KEY=local`, `LLM_MODEL=<model>` in `agent/.env`.

It must be reachable at the `LLM_BASE_URL` you set in `.env`. The model MUST support OpenAI-style tool calling (the `tools` parameter and `tool_calls` in responses).

### 4. Start the MCP server (Terminal 1)

```
cd C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\server
npm run dev
```

Expected output:

```
MCP server starting on 127.0.0.1:3001
MCP endpoint: http://127.0.0.1:3001/mcp
```

### 5. Start the agent

**Option A — CLI REPL (Terminal 2):**

```
cd C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\agent
python -m uv run python -m agent.main --thread my-first-chat
```

The `--thread` value is your conversation ID. Use the same ID later to resume the chat.

> **Note:** The server uses `dotenv` to load `.env` automatically. After changing `.env` values, restart the server for them to take effect.

**Option B — LangGraph Studio (Terminal 2):**

```
cd C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\agent
python -m uv run langgraph dev --no-browser
```

Then open this URL in your browser:

```
https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024
```

### 6. Chat

Try asking:

- "What's on my watchlist?" → calls `read_watchlist` MCP tool
- "Did any show get a new season?" → calls DuckDuckGo search
- "Download Dark for me" → calls `download_and_format_series` stub

**Test fixtures** (set `WATCHLIST_ROOT` and `MEDIA_ROOT` to these paths):

```
test-fixtures/
├── watchlist/
│   ├── Movies to watch.md    # 3 IMDB links
│   ├── Tv Series to Watch.md # Game of Thrones, Breaking Bad, Dark, Severance
│   └── Anime to Watch.md     # Attack on Titan, FMA: Brotherhood, Steins;Gate
└── media/                    # empty — placeholder files are created here
```

---

## Where everything is

```
C:\Users\Mrdjan\Documents\workspace\fable_playing\langgraph-automation\
│
├── pixi.toml                        # Monorepo commands (optional)
├── README.md                        # this file
│
├── agent\                           # ---- Python agent ----
│   ├── .env                         # YOUR config (edit this)
│   ├── .env.example                 # template with all vars
│   ├── pyproject.toml               # uv project (dependencies)
│   ├── uv.lock                      # locked versions
│   ├── langgraph.json               # Studio manifest
│   └── src\agent\
│       ├── __init__.py
│       ├── config.py                # reads env vars
│       ├── llm.py                   # ChatOpenAI setup + health check
│       ├── tools.py                 # MCP binding, retry logic, DuckDuckGo
│       ├── graph.py                 # ReAct loop (create_react_agent)
│       └── main.py                  # CLI entry point
│
└── server\                          # ---- TypeScript MCP server ----
    ├── .env                         # YOUR config (auto-loaded via dotenv)
    ├── .env.example                 # template
    ├── package.json                 # npm project (includes dotenv)
    ├── tsconfig.json                # strict TypeScript
    │
    ├── src\
    │   ├── index.ts                 # Hono server bootstrap (loads .env via dotenv)
    │   ├── mcp.ts                   # MCP tool registration
    │   ├── config.ts                # reads env vars
    │   └── tools\
    │       ├── watchlist.ts         # read_watchlist tool
    │       └── series.ts            # download_and_format_series (stub)
    │
    └── test\
        └── tools.test.ts            # 10 unit tests
```

---

## Pixi commands (optional shortcut from repo root)

| Command                | What it does                      |
| ---------------------- | --------------------------------- |
| `pixi run install-all` | install all deps (agent + server) |
| `pixi run test`        | run server unit tests             |
| `pixi run build`       | compile server TypeScript         |
| `pixi run dev-server`  | start MCP server                  |
| `pixi run dev-agent`   | start CLI REPL                    |

---

## Environment Variables

| Variable                | Default                     | Where       | Description                     |
| ----------------------- | --------------------------- | ----------- | ------------------------------- |
| `LLM_BASE_URL`          | `http://localhost:8000/v1`  | agent/.env  | OpenAI-compatible endpoint      |
| `LLM_API_KEY`           | `local`                     | agent/.env  | API key (dummy for local)       |
| `LLM_MODEL`             | (empty)                     | agent/.env  | Model name                      |
| `LLM_TIMEOUT_S`         | `120`                       | agent/.env  | LLM request timeout             |
| `MCP_SERVER_URL`        | `http://localhost:3001/mcp` | agent/.env  | MCP server address              |
| `MCP_TIMEOUT_S`         | `30`                        | agent/.env  | MCP call timeout                |
| `CHECKPOINT_DB`         | `checkpoints.sqlite`        | agent/.env  | SQLite file for chat history    |
| `AGENT_RECURSION_LIMIT` | `25`                        | agent/.env  | Max tool calls per turn         |
| `WATCHLIST_ROOT`        | (empty)                     | both        | Directory for watchlist reads   |
| `MEDIA_ROOT`            | (empty)                     | both        | Directory for placeholder files |
| `LANGSMITH_API_KEY`     | (empty)                     | agent/.env  | For LangSmith tracing           |
| `LANGSMITH_TRACING`     | `false`                     | agent/.env  | Set `true` to enable traces     |
| `LANGSMITH_PROJECT`     | `langgraph-mcp-agent`       | agent/.env  | LangSmith project name          |
| `MCP_BIND_HOST`         | `127.0.0.1`                 | server/.env | Server listen address           |
| `MCP_BIND_PORT`         | `3001`                      | server/.env | Server listen port              |

---

## TODO

- **Conversation feature to find what i want** - needs to search what is donwloaded, and maybe other obsidian vault (my case) or an location with md files
- **Slow graph load in Studio (918ms):** The `graph()` factory in `graph.py` connects to the MCP server and fetches tools on every call. In LangGraph Studio, this happens on each request, adding ~900ms latency. Cache the MCP client connection or pre-warm it at Studio startup.
- **TV Shows downloads are not formated** - Tv shows should be {show name} - {Season 0{n}} - [{Episode 0{n}}].
- **Feature** add tags to search magnet links for books/academic/tv/movies/anime/ect - (both client agent and server)

---

## Notes

- **`.env` is auto-loaded:** The server uses `dotenv` (`import "dotenv/config"` in `index.ts`) to load `server/.env`. No manual export needed. Restart the server after config changes.
- **Single-client MCP:** The MCP server maintains one session at a time. It's designed for a single agent instance.
- **Separate thread stores:** CLI threads (SQLite) and Studio threads (dev-server) are independent. Thread IDs do not cross over.
- **No real downloads:** `download_and_format_series` creates empty placeholder `.mp4` files in the standardized layout. No network transfer occurs.
- **LLM must support tool calling:** The model server must handle the OpenAI `tools` parameter and emit `tool_calls` in responses. Smaller models (e.g., 3B params) may be inconsistent at tool calling — use a 7B+ model or one fine-tuned for function calling if you encounter issues.
- **MCP server is the trust boundary:** It owns all file system operations. The agent never touches the OS directly.
- **Ollama users:** Set `LLM_BASE_URL=http://localhost:11434/v1`, `LLM_API_KEY=ollama`, and `LLM_MODEL` to your model name. Ollama must be running before the agent starts.
