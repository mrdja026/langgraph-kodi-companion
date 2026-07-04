## Why

The React client's chat bubble does not display LLM output progressively — text appears all at once after the model finishes, even after adding `streaming=True` on the LLM. The LangGraph API emits `messages/partial` SSE events with incremental token deltas (e.g. `"The"`, then `" movie"`, then `" was"`), but the client's SSE parser does `lastContent = content` (replace) instead of `lastContent += content` (accumulate). Only the last delta is ever visible, so the message content stays a single token until the `messages/complete` event overwrites it with the full text. The user experiences this as "the chat bubble does not stream, it only loads." The tool-call status ref already updates on `onToolCall`, but without a state change to trigger a re-render before the message is added to the list, the tool name isn't visibly "printed" while it runs.

## What Changes

- Change the `messages/partial` handler in `client/src/api/langgraph.ts` to accumulate content (`lastContent += content`) instead of replacing it, so each delta appends to the growing text
- Keep the `messages/complete` handler as `lastContent = content` (replace) since that event carries the full authoritative message
- Ensure the tool call currently being invoked is visibly printed in the client's LoadingIndicator during its execution — the `toolCalls` state is already wired via the previous re-render fix, verify it survives this change and that the tool name persists visibly through streaming start
- No API changes, no schema changes, no new dependencies

## Capabilities

### New Capabilities
- `client-streaming`: The React chat client renders LLM responses token-by-token as they arrive from the LangGraph API, and visibly prints the currently running tool call during multi-step reasoning

### Modified Capabilities
<!-- None — no existing specs in openspec/specs/ -->

## Impact

- **Code:** `client/src/api/langgraph.ts` (SSE parser accumulation), possibly `client/src/components/ChatPage.tsx` / `LoadingIndicator.tsx` (verify tool call rendering)
- **APIs:** None — client-only change
- **Dependencies:** None
- **Systems:** React chat client only; agent, MCP server, and LangGraph API server are unchanged
- **Risk:** Low — pure client-side behavior change; `messages/complete` still overwrites with the authoritative full text at stream end, so any accumulation drift is self-correcting
