## ADDED Requirements

### Requirement: Progressive token rendering in the chat bubble

The React client SHALL render the assistant's response progressively as tokens arrive from the LangGraph API's `messages/partial` SSE events. The client SHALL treat each `AIMessageChunk.content` value in a `messages/partial` event as a **delta** and SHALL concatenate deltas to build the running message text. The client SHALL update the corresponding assistant message's `content` field on each non-empty delta so React re-renders the growing text.

#### Scenario: LLM streams a multi-token response
- **WHEN** the LangGraph API emits three `messages/partial` events with contents `"The"`, `" movie"`, and `" was great"` in order
- **THEN** the chat bubble displays `"The"`, then `"The movie"`, then `"The movie was great"` as each event arrives — each intermediate state SHALL be visible to the user

#### Scenario: Empty-content partial chunks are ignored
- **WHEN** a `messages/partial` event contains an `AIMessageChunk` with empty `content` (e.g. only `tool_call_chunks` are populated)
- **THEN** the client SHALL NOT modify the accumulated message content and SHALL NOT trigger a token update

#### Scenario: `messages/complete` overwrites the final content
- **WHEN** the LangGraph API emits a `messages/complete` event with the full authoritative message content
- **THEN** the client SHALL replace the accumulated content with the full-message content so the final rendered text matches the authoritative payload exactly

### Requirement: Currently running tool call is visible

The React client SHALL display the name of each tool call while it is executing. When the model requests a tool via `tool_call_chunks` in a `messages/partial` event, the client SHALL show the tool name with a running indicator (spinner) in the LoadingIndicator. When the corresponding `ToolMessage` arrives, the client SHALL update that tool's visible status to completed. The tool-call visibility SHALL update immediately — before the assistant's text message is added to the chat list.

#### Scenario: Tool call is announced before any text streams
- **WHEN** the model emits a `messages/partial` event containing `tool_call_chunks: [{ name: "search_and_download_tv_series" }]` and no text content
- **THEN** the LoadingIndicator SHALL display `search_and_download_tv_series` with a spinner within the same render cycle

#### Scenario: Tool call completes before response streams
- **WHEN** a `ToolMessage` event arrives for tool `search_and_download_tv_series` after that tool was announced
- **THEN** the LoadingIndicator SHALL display `search_and_download_tv_series` with a completed (✓) indicator

#### Scenario: Tool badges persist on the final message
- **WHEN** the stream completes and `isLoading` transitions to `false`
- **THEN** the LoadingIndicator SHALL disappear, and the assistant's final MessageBubble SHALL display all tool calls that ran during the response as completed badges

### Requirement: Streaming state is isolated per user turn

Each call to `sendMessage` SHALL initialize a fresh accumulator for streamed content, so tokens from a new turn do not concatenate with tokens from the previous turn. Each new user message SHALL result in exactly one streaming assistant message whose content grows from empty to the full response.

#### Scenario: Two consecutive messages don't share content
- **WHEN** the user sends message A, receives a full streamed response, then sends message B
- **THEN** the response to message B SHALL start from an empty string and accumulate only its own tokens
