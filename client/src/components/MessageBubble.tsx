import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "../types";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-md px-4 py-3 rounded-[0.75rem] ${
          isUser
            ? "bg-primary text-white rounded-br-none"
            : "bg-card text-text-primary rounded-bl-none"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <>
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {message.toolCalls.map((tc, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                      tc.status === "completed"
                        ? "bg-green-900/30 text-green-400"
                        : tc.status === "error"
                          ? "bg-red-900/30 text-red-400"
                          : "bg-accent/20 text-accent"
                    }`}
                  >
                    {tc.status === "completed" && "✓"}
                    {tc.status === "error" && "✗"}
                    {tc.status === "calling" && (
                      <span className="loading-spinner inline-block w-2 h-2 rounded-full border border-accent border-t-transparent" />
                    )}
                    {tc.name}
                  </span>
                ))}
              </div>
            )}
            {message.content && (
              <div className="prose prose-invert prose-sm max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
