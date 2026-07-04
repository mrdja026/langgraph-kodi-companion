## ADDED Requirements

### Requirement: Full-height chat layout
The application SHALL render a full-height (`h-screen`) single-page layout with three vertically stacked zones: a fixed header, a scrollable message area, and a fixed input bar at the bottom.

#### Scenario: Page load renders all layout zones
- **WHEN** the user navigates to the application root
- **THEN** the page displays a fixed header with "Kod-bot" title (centered), a scrollable chat container occupying remaining vertical space, and a fixed input bar at the bottom

### Requirement: Dark navy-blue color scheme
The application SHALL use the following color scheme throughout:
- Background: `#1F3A52` (HSL 217 33% 16%)
- Card/message backgrounds: `#2A4A62` (HSL 217 39% 22%)
- Border color: `#3A5A72` (HSL 217 27% 30%)
- Primary accent (user messages, buttons, focus rings): `#6BA3FF` (HSL 243 75% 59%)
- Text primary: `#EAF0F8` (HSL 210 34% 92%)
- Text muted: `#9FAAB8` (HSL 210 34% 70%)
- Border radius: `0.75rem` on all rounded elements

#### Scenario: Visual inspection of color scheme
- **WHEN** the application renders
- **THEN** the background color is deep navy-blue, message bubbles use the card background color, borders use the muted blue, and user message bubbles use the primary accent color

### Requirement: User message bubbles right-aligned
User messages SHALL render as right-aligned bubbles with the primary accent background color, light text, and rounded corners with `rounded-br-none` (notched bottom-right).

#### Scenario: User sends a message
- **WHEN** a user message is displayed in the chat
- **THEN** it appears right-aligned with the primary accent background, white/light text, rounded corners except bottom-right, and a maximum width of `max-w-md` (28rem)

### Requirement: Bot message bubbles left-aligned with markdown
Bot messages SHALL render as left-aligned bubbles with the card background color, light text, and rounded corners with `rounded-bl-none` (notched bottom-left). Bot message content SHALL be rendered as markdown.

#### Scenario: Bot responds with markdown content
- **WHEN** the bot sends a response containing bold text, lists, and line breaks
- **THEN** the message renders left-aligned with markdown formatting applied (bold rendered as `<strong>`, lists as `<ul>/<li>`, line breaks preserved), using react-markdown with remark-gfm

#### Scenario: Bot responds with plain text
- **WHEN** the bot sends a response with no markdown syntax
- **THEN** the message renders as plain text within a left-aligned bubble

### Requirement: Auto-scrolling to latest message
The chat container SHALL automatically scroll to the bottom when a new message is added or when a streaming response is updated.

#### Scenario: New message triggers auto-scroll
- **WHEN** a user sends a message or the bot's streaming response updates
- **THEN** the chat container scrolls to the bottom with smooth animation

### Requirement: Auto-expanding textarea input
The input area SHALL contain a textarea that starts at 1 row height and expands automatically as the user types, up to a maximum height of 120px (~4 rows). It SHALL have placeholder text: "Ask about your watchlist, search for series..."

#### Scenario: User types a single line
- **WHEN** the user types text that fits on one line
- **THEN** the textarea remains at its minimum height (1 row)

#### Scenario: User types multiple lines
- **WHEN** the user types text that wraps to 4+ lines or uses Shift+Enter to add newlines
- **THEN** the textarea expands up to 120px maximum height and becomes scrollable beyond that

### Requirement: Enter to send, Shift+Enter for newline
Pressing Enter (without Shift) SHALL send the current message. Pressing Shift+Enter SHALL insert a newline in the textarea.

#### Scenario: User presses Enter
- **WHEN** the user presses Enter with non-empty text in the textarea
- **THEN** the message is sent, the textarea is cleared and reset to minimum height

#### Scenario: User presses Shift+Enter
- **WHEN** the user presses Shift+Enter
- **THEN** a newline is inserted in the textarea and no message is sent

#### Scenario: User presses Enter with empty input
- **WHEN** the user presses Enter with an empty or whitespace-only textarea
- **THEN** no message is sent

### Requirement: Send button with disabled states
A send button with a Lucide React Send icon SHALL be displayed next to the textarea. The button SHALL be disabled when the textarea is empty or when the bot is loading.

#### Scenario: Send button enabled
- **WHEN** the textarea contains non-empty text and the bot is not loading
- **THEN** the send button is enabled and clickable

#### Scenario: Send button disabled during loading
- **WHEN** the bot is processing a response (loading state)
- **THEN** the send button is disabled with reduced opacity

### Requirement: Loading indicator with bouncing dots
While the bot is processing a response (after user sends, before first token arrives), a loading indicator with 3 bouncing dots SHALL be displayed as a bot message bubble.

#### Scenario: Loading state active
- **WHEN** the user sends a message and the bot has not yet started streaming
- **THEN** a bot-styled message bubble appears with 3 animated bouncing dots

#### Scenario: Loading state clears when streaming begins
- **WHEN** the first token of the bot's response arrives
- **THEN** the loading indicator is replaced by the streaming message content

### Requirement: Message spacing and layout
Messages SHALL be spaced with `space-y-4`. The chat container SHALL have `px-4` horizontal padding and `py-6` vertical padding. The input bar SHALL have `gap-3` between the textarea and send button.

#### Scenario: Message list rendering
- **WHEN** multiple messages are displayed
- **THEN** each message has consistent vertical spacing (space-y-4), the container has proper padding, and the input bar elements have a gap of 3 units

### Requirement: Responsive mobile-first design
The layout SHALL work on all screen sizes with touch-friendly button sizes (minimum `p-3` padding on the send button) and flexible element sizing.

#### Scenario: Narrow viewport
- **WHEN** the application is viewed on a narrow viewport (< 640px)
- **THEN** the layout fills the screen, message bubbles use `max-w-md` or available width (whichever is smaller), and buttons are comfortably tappable
