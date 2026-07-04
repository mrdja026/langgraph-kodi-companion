## ADDED Requirements

### Requirement: Thread creation on app mount
The API client SHALL create a new thread by calling `POST /threads` on the LangGraph dev server when the application mounts. The returned `thread_id` SHALL be stored in React state and reused for all subsequent messages in the session.

#### Scenario: App loads and creates thread
- **WHEN** the application mounts for the first time
- **THEN** a `POST /threads` request is sent to the LangGraph dev server and the returned `thread_id` is stored

#### Scenario: Thread creation fails
- **WHEN** the `POST /threads` request fails (server unreachable, network error)
- **THEN** an error message is displayed inline in the chat area and the user can retry by refreshing

### Requirement: Send message with SSE streaming
The API client SHALL send user messages by calling `POST /threads/{thread_id}/runs/stream` with `assistant_id: "agent"`, `input: { messages: [{ role: "human", content: "<user text>" }] }`, and `stream_mode: ["messages"]`. The response SHALL be consumed as an SSE stream.

#### Scenario: Successful message send and stream
- **WHEN** the user sends a message
- **THEN** the API client sends a POST request to the streaming endpoint and begins consuming the SSE response

#### Scenario: Request body structure
- **WHEN** a message is sent to the streaming endpoint
- **THEN** the request body contains `assistant_id` set to `"agent"`, `input.messages` as an array with the user's message, and `stream_mode` set to `["messages"]`

### Requirement: SSE event parsing for token streaming
The API client SHALL parse SSE events from the streaming response. It SHALL extract content from `messages/partial` events that contain assistant messages and update the displayed bot message content incrementally to produce a typewriter effect.

#### Scenario: Partial message events update UI
- **WHEN** `messages/partial` SSE events arrive with assistant message content
- **THEN** the bot message bubble updates its displayed text with the accumulated content from each partial event, creating a real-time typewriter effect

#### Scenario: Non-assistant events are ignored
- **WHEN** SSE events contain tool calls, metadata, or other non-assistant-content events
- **THEN** those events are ignored and do not affect the displayed message

#### Scenario: Stream completes
- **WHEN** the SSE stream ends (connection closes or `end` event received)
- **THEN** the loading state is cleared and the final bot message is preserved in the messages array

### Requirement: Vite dev proxy for API requests
The Vite dev server SHALL proxy requests with the path prefix `/api` to the LangGraph dev server at `http://localhost:2024`. The API client SHALL use relative URLs (e.g., `/api/threads`) so all requests are routed through the proxy.

#### Scenario: API request proxied
- **WHEN** the client makes a request to `/api/threads`
- **THEN** Vite proxies the request to `http://localhost:2024/threads` (stripping the `/api` prefix)

### Requirement: Error handling for API failures
The API client SHALL handle network errors, non-2xx responses, and stream interruptions gracefully. Errors SHALL be surfaced as inline system messages in the chat.

#### Scenario: Network error during streaming
- **WHEN** the network connection drops during an SSE stream
- **THEN** the loading state is cleared and an error message is displayed in the chat

#### Scenario: Server returns non-2xx status
- **WHEN** the streaming endpoint returns a 4xx or 5xx status code
- **THEN** the loading state is cleared and an error message with the status is displayed in the chat
