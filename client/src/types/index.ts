export interface ToolCallInfo {
  name: string;
  status: "calling" | "completed" | "error";
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  timestamp: number;
}

export interface ThreadResponse {
  thread_id: string;
}

export interface StreamCallbacks {
  onToken: (accumulatedContent: string) => void;
  onToolCall: (toolName: string) => void;
  onToolResult: (toolName: string) => void;
  onComplete: (finalContent: string) => void;
  onError: (error: string) => void;
}
