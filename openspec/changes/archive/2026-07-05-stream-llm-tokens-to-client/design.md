## Context

The React client (`client/`) talks to the LangGraph API server (`langgraph dev` on `:2024`) via SSE. The client sends `stream_mode: ["messages"]` and processes two event types:

- `messages/partial` — one event per model chunk during streaming
- `messages/complete` — one event per finalized message (AI or tool)

Since `streaming=True` was added to `ChatOpenAI` in `agent/src/agent/llm.py`, the LangGraph server now emits genuine partial chunks. In LangGraph's `stream_mode="messages"`, each partial event carries an `AIMessageChunk` whose `content` field is the **delta** (new tokens since the previous chunk), not the running accumulated text. This matches LangChain's `AIMessageChunk` semantics: concatenating chunks with `+` yields the full message.

The current SSE handler in `client/src/api/langgraph.ts:96` treats `content` as if it were the accumulated text:

```typescript
lastContent = content;         // ← wrong: overwrites with just the delta
callbacks.onToken(lastContent);
```

Consequently the message state is set to a single token per event. The user visually observes no streaming — only the final `messages/complete` handler (which does have the full text) makes the response appear all at once.

The `LoadingIndicator` already receives `toolCalls` from state (fixed earlier), and shows tool names with a spinner. That path is correct; this change only touches token accumulation. We will verify the tool-call visibility still works after the accumulation change.

## Goals / Non-Goals

**Goals:**
- Chat bubble renders content progressively as tokens arrive
- Currently-running tool name is visible in the LoadingIndicator during its execution
- Final rendered text exactly matches the authoritative `messages/complete` payload
- No new dependencies, no server/agent changes

**Non-Goals:**
- Optimizing render throughput or debouncing renders (React handles per-event re-renders adequately at typical LLM token rates)
- Supporting `stream_mode="values"` or other stream modes
- Changing how tool call chunks are handled (already correct)
- Backend changes to how LangGraph emits SSE events

## Decisions

### D1: Accumulate deltas in `messages/partial`, replace in `messages/complete`

Change `lastContent = content` to `lastContent += content` **only** in the `messages/partial` handler. Leave the `messages/complete` handler as `lastContent = content` since that event carries the full authoritative text.

**Rationale:** `AIMessageChunk.content` is defined by LangChain as a delta — the chunk's contribution to the message, not the running total. Concatenation is the documented aggregation. Keeping `messages/complete` as replace guarantees the final displayed content matches the server's authoritative full-message content, so any accumulation drift (e.g., a dropped chunk) self-corrects at end-of-stream.

**Alternative considered:** Track a separate accumulator per message ID and never trust `messages/complete`. Rejected — more state, no benefit, and the current single-`lastContent` design already assumes one streaming assistant message per `sendMessage` call.

### D2: Reset `lastContent` per `sendMessage` call

`lastContent` is a local variable inside `sendMessage`, already reset to `""` on each call. No change needed. This isolates accumulation to a single stream and prevents cross-message pollution.

### D3: Keep the `content.length > 0` guard

Continue skipping empty-content chunks (which occur when the model emits a chunk with only `tool_call_chunks` and no text). Adding an empty string via `+=` is a no-op, so the guard is a mild optimization rather than a correctness requirement — retain it for clarity and to avoid a needless `onToken` firing.

### D4: Tool call visibility is already correct

The `toolCalls` state (React state, not just ref) was added in the previous fix. On `onToolCall`, we push to the ref, mirror to state via `setToolCalls`, and the LoadingIndicator renders from state. No changes required here; verification only.

## Risks / Trade-offs

- **[Risk: LangGraph API version emits accumulated content, not deltas]** → If a future `langgraph-api` version changes `messages/partial` to emit accumulated text, `+=` would produce doubled content. **Mitigation:** The `messages/complete` handler will overwrite with the correct full text at stream end, so the user still sees the correct final result — just with a garbled transient during streaming. If observed, we would switch back to replace. Currently pinned versions (`langgraph-api 0.10.0`, `langchain-core >=1.4.8`) emit deltas.

- **[Risk: Very fast streams cause React to batch renders]** → Not addressed by this change; existing per-token `setMessages` calls will still be batched by React 18 under heavy load. In practice, ollama+Qwen3:14B on local hardware runs slow enough that each token triggers a visible render.

- **[Trade-off: Simple accumulator vs. per-message tracking]** → We use a single `lastContent` per `sendMessage` call. This assumes exactly one streaming assistant message per user turn, which matches the current `create_react_agent` behavior for text responses. If the graph ever streamed multiple concurrent assistant messages, this would need per-message-ID accumulators. Not a concern today.
