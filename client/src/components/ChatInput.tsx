import { useRef, useCallback } from "react";
import { Send } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({ value, onChange, onSend, disabled }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    adjustHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
        // Reset height after send
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        });
      }
    }
  };

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-3 px-4 py-3 border-t border-border">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your watchlist, search for series..."
        rows={1}
        disabled={disabled}
        className="flex-1 resize-none bg-card text-text-primary placeholder-text-muted rounded-[0.75rem] px-4 py-3 border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-50"
        style={{ maxHeight: "120px" }}
      />
      <button
        onClick={onSend}
        disabled={!canSend}
        className="p-3 bg-primary text-white rounded-[0.75rem] transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send size={20} />
      </button>
    </div>
  );
}
