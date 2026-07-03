## ADDED Requirements

### Requirement: OpenAI-compatible local endpoint
The agent SHALL send all inference requests to an OpenAI-compatible Chat Completions endpoint configured via `LLM_BASE_URL` (default `http://localhost:8000/v1`), using an OpenAI-compatible client with `LLM_API_KEY` (default `"local"`) and `LLM_MODEL` (the served open-weights model id). The agent MUST NOT call any cloud LLM provider.

#### Scenario: Default endpoint used
- **WHEN** `LLM_BASE_URL` is not set in the environment
- **THEN** inference requests are sent to `http://localhost:8000/v1/chat/completions`

#### Scenario: Endpoint override
- **WHEN** `LLM_BASE_URL` is set to `http://192.168.1.50:8000/v1`
- **THEN** all inference requests target that base URL and no request is made to `localhost:8000`

### Requirement: Native tool calling
Inference requests SHALL include the agent's bound tools via the OpenAI `tools` parameter, and the agent SHALL interpret `tool_calls` in responses as the model's tool-use decisions. The serving endpoint MUST support OpenAI-style tool calling (e.g., vLLM with `--enable-auto-tool-choice` and an appropriate tool-call parser); documentation MUST state this requirement for model selection.

#### Scenario: Tool schemas sent with each request
- **WHEN** the ReAct loop invokes the model
- **THEN** the request body contains the JSON Schema definitions of all three bound tools in the `tools` parameter

#### Scenario: Tool call parsed from response
- **WHEN** the model responds with a `tool_calls` entry naming `read_watchlist` and JSON arguments
- **THEN** the agent executes that tool with those arguments and feeds the result back as a tool message

### Requirement: Malformed tool calls handled in-loop
When the model emits a tool call whose arguments cannot be parsed or fail the tool's schema validation, the agent SHALL return the validation error as the tool's result message so the model can correct itself on the next iteration, bounded by the recursion limit. Malformed model output MUST NOT raise an unhandled exception.

#### Scenario: Bad arguments corrected
- **WHEN** the model calls `download_and_format_series` without `series_name`
- **THEN** the schema error is returned as the tool result and the model may retry with valid arguments within the same turn

### Requirement: Inference timeout and failure handling
Inference calls SHALL apply a request timeout (`LLM_TIMEOUT_S`, default 120 seconds). Connection failures, HTTP errors, and timeouts MUST be caught and surfaced as an assistant-visible error for that turn — the REPL and the thread's persisted state MUST remain intact.

#### Scenario: Endpoint unreachable mid-chat
- **WHEN** the local GPU endpoint refuses connections during a turn
- **THEN** the user sees an error message identifying the inference endpoint as unreachable, and the next turn works once the endpoint is back

### Requirement: Startup health check
At startup, before opening the chat REPL, the agent SHALL verify the inference endpoint is reachable (e.g., by listing models) and report a clear operator-facing error if it is not.

#### Scenario: Endpoint down at startup
- **WHEN** the agent starts while the model server is not running
- **THEN** the agent exits (or warns) with a message naming `LLM_BASE_URL` as unreachable rather than failing cryptically on the first turn
