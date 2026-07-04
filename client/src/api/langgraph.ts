import type { ThreadResponse, StreamCallbacks } from "../types";

const API_BASE = "/api";

export async function createThread(): Promise<string> {
  const res = await fetch(`${API_BASE}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    throw new Error(`Failed to create thread: ${res.status} ${res.statusText}`);
  }

  const data: ThreadResponse = await res.json();
  return data.thread_id;
}

export async function sendMessage(
  threadId: string,
  content: string,
  callbacks: StreamCallbacks
): Promise<void> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}/threads/${threadId}/runs/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: "agent",
        input: {
          messages: [{ role: "human", content }],
        },
        stream_mode: ["messages"],
      }),
    });
  } catch (err) {
    callbacks.onError(
      `Network error: ${err instanceof Error ? err.message : "connection failed"}`
    );
    return;
  }

  if (!res.ok) {
    callbacks.onError(`Server error: ${res.status} ${res.statusText}`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No response body received");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let lastContent = "";
  const notifiedToolCalls = new Set<string>();

  // Extract tool call names from both tool_call_chunks and tool_calls fields
  function detectToolCalls(msg: Record<string, unknown>) {
    // Streaming chunks: tool_call_chunks
    if (msg.tool_call_chunks && Array.isArray(msg.tool_call_chunks)) {
      for (const chunk of msg.tool_call_chunks) {
        if (chunk.name && !notifiedToolCalls.has(chunk.name)) {
          notifiedToolCalls.add(chunk.name);
          callbacks.onToolCall(chunk.name);
        }
      }
    }
    // Finalized calls: tool_calls
    if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name && !notifiedToolCalls.has(tc.name)) {
          notifiedToolCalls.add(tc.name);
          callbacks.onToolCall(tc.name);
        }
      }
    }
  }

  function isAiMessage(msg: Record<string, unknown>) {
    return msg.type === "ai" || msg.type === "AIMessageChunk" || msg.role === "assistant";
  }

  function isToolMessage(msg: Record<string, unknown>) {
    return msg.type === "tool" || msg.type === "ToolMessage";
  }

  function processMessage(msg: Record<string, unknown>, emitToken: boolean) {
    if (isAiMessage(msg)) {
      detectToolCalls(msg);
      const content = (msg.content as string) ?? "";
      if (typeof content === "string" && content.length > 0) {
        // Server sends accumulated content — replace, don't append
        lastContent = content;
        if (emitToken) callbacks.onToken(lastContent);
      }
    } else if (isToolMessage(msg)) {
      const name = msg.name as string;
      if (name) callbacks.onToolResult(name);
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Keep incomplete last line in buffer
      buffer = lines.pop() ?? "";

      let eventType = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && (eventType === "messages/partial" || eventType === "messages/complete")) {
          try {
            const data = JSON.parse(line.slice(6));
            const emitToken = eventType === "messages/partial";
            if (Array.isArray(data)) {
              for (const msg of data) {
                if (msg && typeof msg === "object") processMessage(msg, emitToken);
              }
            } else if (data && typeof data === "object") {
              processMessage(data, emitToken);
            }
          } catch {
            // Ignore malformed JSON chunks
          }
        }
      }
    }

    callbacks.onComplete(lastContent);
  } catch (err) {
    callbacks.onError(
      `Stream error: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
