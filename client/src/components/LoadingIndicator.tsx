interface Props {
  toolCalls?: { name: string; status: "calling" | "completed" | "error" }[];
}

export default function LoadingIndicator({ toolCalls }: Props) {
  return (
    <div className="flex justify-start">
      <div className="bg-card rounded-[0.75rem] rounded-bl-none px-4 py-3 max-w-md">
        {toolCalls && toolCalls.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
              <span className="loading-spinner inline-block w-3 h-3 rounded-full border-2 border-text-muted border-t-transparent" />
              Running:
            </div>
            {toolCalls.map((tc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {tc.status === "calling" ? (
                  <>
                    <span className="loading-spinner inline-block w-2.5 h-2.5 rounded-full border-2 border-accent border-t-transparent" />
                    <span className="text-accent font-mono">{tc.name}</span>
                  </>
                ) : tc.status === "completed" ? (
                  <>
                    <span className="text-green-500">✓</span>
                    <span className="text-text-muted font-mono line-through decoration-text-muted/50">{tc.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-red-500">✗</span>
                    <span className="text-red-400 font-mono">{tc.name}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
            <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
            <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
          </div>
        )}
      </div>
    </div>
  );
}
