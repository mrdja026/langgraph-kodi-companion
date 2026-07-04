import { useState, useRef, useEffect, useCallback } from "react";
import type { Message, ToolCallInfo, StreamCallbacks } from "../types";
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
  const [toolCalls, setToolCalls] = useState<ToolCallInfo[]>([]);
  const toolCallsRef = useRef(toolCalls);

  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingIdRef = useRef<string | null>(null);
  const addedRef = useRef(false);
  const greetedRef = useRef(false);

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

  // Auto-trigger greeting when thread is created
  useEffect(() => {
    if (threadId && !greetedRef.current) {
      greetedRef.current = true;
      triggerGreeting(threadId);
    }
  }, [threadId]);

  // Scroll when messages change or loading changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const updateAssistantMsg = useCallback((updates: Partial<Message>) => {
    const id = streamingIdRef.current;
    if (!id) return;
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === id);
      if (!exists) return prev;
      return prev.map((m) => (m.id === id ? { ...m, ...updates } : m));
    });
  }, []);

  function createStreamCallbacks(
    assistantMsg: Message,
    assistantId: string,
  ): StreamCallbacks {
    let added = false;

    return {
      onToken: (accumulated) => {
        if (!added) {
          setMessages((prev) => [
            ...prev,
            { ...assistantMsg, content: accumulated, toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined },
          ]);
          added = true;
          addedRef.current = true;
        } else {
          updateAssistantMsg({ content: accumulated, toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined });
        }
      },
      onToolCall: (toolName) => {
        const updated: ToolCallInfo[] = [...toolCallsRef.current, { name: toolName, status: "calling" as const }];
        toolCallsRef.current = updated;
        setToolCalls(updated);
        if (addedRef.current) {
          updateAssistantMsg({ toolCalls: updated });
        }
      },
      onToolResult: (toolName) => {
        const updated = toolCallsRef.current.map(tc =>
          tc.name === toolName ? { ...tc, status: "completed" as const } : tc,
        );
        toolCallsRef.current = updated;
        setToolCalls(updated);
        if (addedRef.current) {
          updateAssistantMsg({ toolCalls: updated });
        }
      },
      onComplete: (finalContent) => {
        const finalToolCalls = toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined;
        if (!added) {
          setMessages((prev) => [
            ...prev,
            { ...assistantMsg, content: finalContent || "", toolCalls: finalToolCalls },
          ]);
        } else {
          updateAssistantMsg({ content: finalContent || "", toolCalls: finalToolCalls });
        }
        setIsLoading(false);
        streamingIdRef.current = null;
      },
      onError: (errorMsg) => {
        const errMessage: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `**Error:** ${errorMsg}`,
          toolCalls: toolCallsRef.current.length > 0 ? [...toolCallsRef.current] : undefined,
          timestamp: Date.now(),
        };

        if (!added) {
          setMessages((prev) => [...prev, errMessage]);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, ...errMessage }
                : m
            )
          );
        }
        setIsLoading(false);
        streamingIdRef.current = null;
      },
    };
  }

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !threadId || isLoading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;
    addedRef.current = false;
    toolCallsRef.current = [];
    setToolCalls([]);

    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    const callbacks = createStreamCallbacks(assistantMsg, assistantId);
    await sendMessage(threadId, text, callbacks);
  }, [input, threadId, isLoading, updateAssistantMsg]);

  const triggerGreeting = useCallback(async (id: string) => {
    setIsLoading(true);

    const assistantId = crypto.randomUUID();
    streamingIdRef.current = assistantId;
    addedRef.current = false;
    toolCallsRef.current = [];
    setToolCalls([]);

    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    const callbacks = createStreamCallbacks(assistantMsg, assistantId);
    await sendMessage(id, "__greet__", callbacks);
  }, []);

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

        {isLoading && (
          <LoadingIndicator toolCalls={toolCalls.length > 0 ? toolCalls : undefined} />
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
