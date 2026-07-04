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
        } else if (line.startsWith("data: ") && eventType === "messages/partial") {
          try {
            const data = JSON.parse(line.slice(6));
            // The data is an array of message chunks. We want the last
            // assistant message content.
            if (Array.isArray(data)) {
              for (const msg of data) {
                if (msg.type === "ai" || msg.role === "assistant") {
                  const content = msg.content ?? "";
                  if (typeof content === "string" && content.length > 0) {
                    lastContent = content;
                    callbacks.onToken(lastContent);
                  }
                }
              }
            } else if (
              data &&
              (data.type === "ai" || data.role === "assistant")
            ) {
              const content = data.content ?? "";
              if (typeof content === "string" && content.length > 0) {
                lastContent = content;
                callbacks.onToken(lastContent);
              }
            }
          } catch {
            // Ignore malformed JSON chunks
          }
        } else if (line.startsWith("data: ") && eventType === "messages/complete") {
          try {
            const data = JSON.parse(line.slice(6));
            if (Array.isArray(data)) {
              for (const msg of data) {
                if (msg.type === "ai" || msg.role === "assistant") {
                  const content = msg.content ?? "";
                  if (typeof content === "string" && content.length > 0) {
                    lastContent = content;
                  }
                }
              }
            } else if (
              data &&
              (data.type === "ai" || data.role === "assistant")
            ) {
              const content = data.content ?? "";
              if (typeof content === "string" && content.length > 0) {
                lastContent = content;
              }
            }
          } catch {
            // Ignore malformed JSON
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
