## ADDED Requirements

### Requirement: SQLite-backed checkpointing in CLI mode
When run via the CLI REPL, the agent SHALL persist conversation state with LangGraph's SQLite checkpointer (`SqliteSaver`), using a database file configured via `CHECKPOINT_DB` (default `agent/checkpoints.sqlite`). The checkpointer MUST be attached by the CLI entry point at compile time — NOT baked into the exported graph, which must remain checkpointer-free for LangGraph Studio.

#### Scenario: Checkpoint written per CLI turn
- **WHEN** a user turn completes in the CLI REPL (assistant message produced)
- **THEN** the full message state for that thread is persisted in the SQLite database

#### Scenario: Database created on first run
- **WHEN** the CLI REPL starts and `CHECKPOINT_DB` does not exist
- **THEN** the database file is created automatically and the first conversation proceeds normally

#### Scenario: Exported graph stays checkpointer-free
- **WHEN** the graph object referenced by `langgraph.json` is inspected
- **THEN** it has no custom checkpointer attached; `SqliteSaver` appears only in the CLI entry path

### Requirement: Studio-mode persistence delegated to the dev server
When run under `uv run langgraph dev`, conversation persistence SHALL be provided by the LangGraph dev server's own storage: threads are created and resumed through the Studio UI, and Studio threads MUST survive dev-server restarts via its local storage.

#### Scenario: Studio thread survives dev-server restart
- **WHEN** the dev server is stopped and restarted after several turns on a Studio thread
- **THEN** reopening that thread in Studio shows the full prior conversation and the next turn continues with that context

#### Scenario: Stores are independent
- **WHEN** a conversation exists on a CLI thread id
- **THEN** that thread does not appear in Studio (and Studio threads do not resolve in the CLI) — the two stores are separate by design

### Requirement: Thread-scoped conversations
Each conversation SHALL be identified by a `thread_id` supplied in the run configuration. The CLI REPL MUST let the user start a new thread or resume an existing one by id; in Studio, threads are managed through the UI. Messages from one thread MUST never appear in another thread's context.

#### Scenario: Resuming a CLI thread by id
- **WHEN** the user starts the REPL with an existing `thread_id`
- **THEN** the conversation continues with the full prior message history available to the model

#### Scenario: Threads are isolated
- **WHEN** two threads exist and the user chats on thread B
- **THEN** nothing said in thread A influences the model's context or answers on thread B

### Requirement: Multi-turn context carry-over
Within a thread, prior turns — including earlier tool results — SHALL be part of the model's context on subsequent turns, enabling follow-up questions without re-invoking tools. This applies on both surfaces (CLI and Studio).

#### Scenario: Follow-up uses earlier tool result
- **WHEN** turn 1 read the watchlist and turn 2 asks "which of those is a comedy?"
- **THEN** the model answers from the watchlist content already in the thread history, without necessarily calling `read_watchlist` again

### Requirement: CLI memory survives restarts
CLI conversation history SHALL survive agent process restarts: stopping the agent and starting it again with the same `CHECKPOINT_DB` and `thread_id` MUST restore the conversation exactly where it left off.

#### Scenario: Restart and resume
- **WHEN** the agent process is killed after several turns and relaunched with the same thread id
- **THEN** the next user message is answered with awareness of all pre-restart turns
