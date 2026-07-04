## 1. Project Scaffolding

- [x] 1.1 Create `client/` directory with Vite + React 18 + TypeScript project (`package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`)
- [x] 1.2 Install dependencies: `react`, `react-dom`, `react-markdown`, `remark-gfm`, `lucide-react`, `tailwindcss`, `postcss`, `autoprefixer`
- [x] 1.3 Configure Tailwind CSS (`tailwind.config.ts`, `postcss.config.js`) with custom color scheme (background, card, border, primary, text-primary, text-muted)
- [x] 1.4 Create `src/index.css` with Tailwind directives and bouncing-dots keyframe animation
- [x] 1.5 Create `src/main.tsx` entry point rendering `<App />`

## 2. Vite Proxy Configuration

- [x] 2.1 Add Vite dev proxy rule in `vite.config.ts`: `/api` → `http://localhost:2024` (rewrite to strip `/api` prefix)

## 3. API Client (langgraph-api-client)

- [x] 3.1 Create `src/types/index.ts` with `Message` type (`id`, `role`, `content`, `timestamp`) and API response types
- [x] 3.2 Create `src/api/langgraph.ts` with `createThread()` function (`POST /api/threads`)
- [x] 3.3 Implement `sendMessage(threadId, content, onToken, onComplete, onError)` function with SSE streaming via `fetch()` + `ReadableStream`
- [x] 3.4 Implement SSE event parser that extracts assistant content from `messages/partial` events and calls `onToken` callback
- [x] 3.5 Handle stream completion (`end` event or connection close) and error cases (non-2xx, network errors)

## 4. Chat UI Components

- [x] 4.1 Create `src/components/LoadingIndicator.tsx` — 3 bouncing dots in a bot-styled message bubble
- [x] 4.2 Create `src/components/MessageBubble.tsx` — right-aligned user bubbles (primary accent, `rounded-br-none`) and left-aligned bot bubbles (card bg, `rounded-bl-none`, markdown rendered via react-markdown + remark-gfm)
- [x] 4.3 Create `src/components/ChatInput.tsx` — auto-expanding textarea (max 120px), send button with Lucide Send icon, Enter-to-send / Shift+Enter for newline, disabled states
- [x] 4.4 Create `src/components/ChatPage.tsx` — full layout: fixed header, scrollable message area with auto-scroll, input bar, message state management, thread creation on mount, loading state

## 5. App Entry & Integration

- [x] 5.1 Create `src/App.tsx` rendering `ChatPage` directly (no router)
- [x] 5.2 Wire up state flow: user sends message → add to messages → call `sendMessage` → stream tokens into bot message → clear loading on complete

## 6. Monorepo Integration

- [x] 6.1 Add `pixi.toml` tasks: `install-client`, `dev-client`, `build-client`; update `install-all` and `build-all` to include client

## 7. Verification

- [x] 7.1 Run `npm install` and `npm run dev` in `client/` to confirm the app builds and renders
- [x] 7.2 Verify the UI renders correctly: header, empty chat area, input bar with placeholder text, dark theme colors
