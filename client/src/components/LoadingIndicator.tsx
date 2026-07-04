export default function LoadingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-card rounded-[0.75rem] rounded-bl-none px-4 py-3 max-w-md">
        <div className="flex items-center gap-1">
          <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
          <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
          <span className="dot-bounce inline-block w-2 h-2 rounded-full bg-text-muted" />
        </div>
      </div>
    </div>
  );
}
