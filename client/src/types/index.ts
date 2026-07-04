export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ThreadResponse {
  thread_id: string;
}

export interface StreamCallbacks {
  onToken: (accumulatedContent: string) => void;
  onComplete: (finalContent: string) => void;
  onError: (error: string) => void;
}
