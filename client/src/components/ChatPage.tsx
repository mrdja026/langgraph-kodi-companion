import { useState, useRef, useEffect, useCallback } from "react";
import type { Message } from "../types";
import { createThread, sendMessage } from "../api/langgraph";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import LoadingIndicator from "./LoadingIndicator";

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  // Create thread on mount
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const id = await createThread();
        if (!cancelled) {
          setThreadId(id);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            `Failed to connect to LangGraph server. Is it running on port 2024?\n${
              err instanceof Error ? err.message : "Unknown error"
            }`
          );
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Scroll when messages change or loading changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !threadId || isLoading) return;

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Create placeholder assistant message
    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;

    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    // We'll add the assistant message once the first token arrives
    let added = false;

    await sendMessage(threadId, text, {
      onToken: (accumulated) => {
        if (!added) {
          setMessages((prev) => [...prev, { ...assistantMsg, content: accumulated }]);
          added = true;
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: accumulated } : m
            )
          );
        }
      },
      onComplete: (finalContent) => {
        if (!added && finalContent) {
          setMessages((prev) => [
            ...prev,
            { ...assistantMsg, content: finalContent },
          ]);
        } else if (added) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: finalContent } : m
            )
          );
        }
        setIsLoading(false);
        streamingIdRef.current = null;
      },
      onError: (errorMsg) => {
        // Add error as a system-like assistant message
        const errMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**Error:** ${errorMsg}`,
          timestamp: Date.now(),
        };

        if (!added) {
          setMessages((prev) => [...prev, errMessage]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `**Error:** ${errorMsg}` }
                : m
            )
          );
        }
        setIsLoading(false);
        streamingIdRef.current = null;
      },
    });
  }, [input, threadId, isLoading]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-center px-4 py-3 border-b border-border">
        <h1 className="text-lg font-semibold text-text-primary tracking-wide">
          Kod-bot
        </h1>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
      >
        {error && (
          <div className="flex justify-center">
            <div className="bg-card border border-red-500/30 rounded-[0.75rem] px-4 py-3 max-w-md text-center">
              <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && !streamingIdRef.current && <LoadingIndicator />}
        {isLoading && streamingIdRef.current && messages.find(m => m.id === streamingIdRef.current && m.content === "") && (
          <LoadingIndicator />
        )}
      </div>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading || !threadId}
      />
    </div>
  );
}
