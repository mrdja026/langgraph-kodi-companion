## 1. Fix SSE token accumulation

- [x] 1.1 In `client/src/api/langgraph.ts`, change the `messages/partial` handler's array branch (line ~96) from `lastContent = content` to `lastContent += content` so deltas accumulate
- [x] 1.2 In the same file, apply the same accumulation change to the `messages/partial` non-array branch (line ~119) — `lastContent += content` instead of `lastContent = content`
- [x] 1.3 Verify `messages/complete` handlers remain `lastContent = content` (replace with authoritative full content) — no change needed, but confirm both array and non-array branches
- [x] 1.4 Keep the `content.length > 0` guard so empty-content chunks (tool-call-only chunks) don't fire `onToken`

## 2. Verify tool call visibility during streaming

- [x] 2.1 Confirm `onToolCall` in `client/src/components/ChatPage.tsx` still calls `setToolCalls([...])` before or independent of the message being added to state (so LoadingIndicator re-renders immediately when a tool starts)
- [x] 2.2 Confirm `LoadingIndicator` reads from the `toolCalls` state prop (not `toolCallsRef.current`) so it re-renders on state change
- [x] 2.3 Ensure the LoadingIndicator remains visible while streaming text into a new/empty assistant message — no regression from earlier render-condition fixes

## 3. Build and verify

- [x] 3.1 Run `pixi run build-client` and confirm the client compiles cleanly (no TypeScript errors)
- [x] 3.2 Restart `pixi run agent` (LangGraph API server) and `pixi run dev-client`
- [x] 3.3 Send a test message and observe: tokens appear progressively in the chat bubble; tool call name shows in the LoadingIndicator with a spinner during its execution and updates to ✓ when done
- [x] 3.4 Send a second message in the same session and confirm content starts from empty (no cross-turn accumulation)
