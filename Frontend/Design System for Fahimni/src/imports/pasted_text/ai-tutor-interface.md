Design the AI Tutor Chat Interface for Fahimni (فهّمني), an Arabic-first RTL educational platform. This is a messaging-style chat where students ask questions about their course content and get AI-generated answers with citation references.

Route: /student/ai-tutor

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B, Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981, Warning: #F59E0B, Error: #EF4444 (bg: #FEF2F2)
- Info/Purple: #7C3AED
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Buttons: 44px min-height, 12px radius
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)

LAYOUT:
- StudentLayout: Sidebar (260px, navy-900) + Topbar (64px, white) + Content
- Sidebar active: "المعلم الذكي" — bg cyan-500, white text, icon: Bot or BrainCircuit
- Mobile: Bottom tab bar (56px), "المعلم الذكي" tab active (cyan), sidebar hidden
- Content: NO max-width constraint — chat fills full available width/height
- Chat area takes FULL HEIGHT of content area (viewport height - topbar 64px - input area)

=============================================
CHAT LAYOUT STRUCTURE
=============================================

Three vertical zones (flex column, full height):

ZONE 1 — Chat Header (optional sticky bar inside content):
- Height: 48px, bg-white, border-b, px-16
- Start: Bot icon (BrainCircuit, cyan, 20px) + "المعلم الذكي" (16px semibold)
- End: "محادثة جديدة" button (ghost, small, icon RotateCcw) — clears chat

ZONE 2 — Messages Area (flex-1, scrollable):
- Full height, overflow-y auto, scroll-smooth
- Padding: px-16 py-20 (desktop), px-12 py-16 (mobile)
- Max-width for messages container: 768px, centered within the area
- Background: #F4F4F4FA (same as page bg, seamless)
- Auto-scrolls to bottom on new message

ZONE 3 — Input Area (sticky bottom):
- bg-white, border-t, px-16 py-12
- Max-width 768px, centered

=============================================
MESSAGE BUBBLES
=============================================

=== STUDENT MESSAGE (right-aligned in RTL = END side) ===
- Alignment: End-aligned (right side in RTL)
- Bubble: bg-cyan-500, text-white, rounded-14px rounded-tl-4px (sharp corner top-start)
- Max-width: 75% of container
- Padding: px-16 py-10
- Text: 14px regular Cairo, white
- Timestamp: "٢:٣٠ م" (11px, white/70 opacity, below bubble, end-aligned)

Example messages:
- "إيه الفرق بين التفاعلات الطاردة والماصة للحرارة؟"
- "اشرحلي التحليل الكهربائي بطريقة بسيطة"

=== AI MESSAGE (left-aligned in RTL = START side) ===
- Alignment: Start-aligned (left side in RTL)
- Avatar: Bot icon circle (32px, bg-navy-900, BrainCircuit white icon), top-start of bubble
- Bubble: bg-white, border border-#E5E7EB, rounded-14px rounded-tr-4px (sharp corner top-end)
- Max-width: 80% of container
- Padding: px-16 py-12
- Text: 14px regular Cairo, text-primary (#1A103D)
- Supports markdown-like formatting:
  - Bold text (font-semibold)
  - Bullet points / numbered lists
  - Chemical formulas inline (e.g., H₂O, NaOH)
- Timestamp: "٢:٣١ م" (11px, text-muted, below bubble, start-aligned)

AI message example (Arabic, multi-paragraph):
"التفاعلات الطاردة للحرارة هي التفاعلات اللي بتطلق طاقة حرارية للوسط المحيط، يعني درجة حرارة المحلول بتزيد.

أما التفاعلات الماصة للحرارة فهي العكس — بتمتص طاقة من الوسط المحيط، فدرجة الحرارة بتقل.

مثال على التفاعل الطارد: احتراق الوقود 🔥
مثال على التفاعل الماص: ذوبان ملح النشادر في الماء"

=== CITATION CHIPS (inside AI messages) ===
Inline clickable pills that appear within the AI response text:
- Style: bg-cyan-50, border border-cyan-200, rounded-full, px-8 py-2, inline-flex
- Text: "📖 الدرس ٣: الكيمياء الحرارية" (11px text-cyan-700, semibold)
- Icon: BookOpen (12px, cyan) before text
- Hover: bg-cyan-100, border-cyan-300, cursor-pointer
- Click: Navigates to the referenced lesson page
- Multiple citations can appear in one message

Example in context:
"...زي ما اتشرح في [📖 الدرس ٣: الكيمياء الحرارية] و [📖 الدرس ٥: الطاقة والتفاعلات]"

=== WELCOME MESSAGE (first thing shown, before any conversation) ===
Centered in messages area, not a bubble:
- Bot avatar large (64px, bg-navy-900, BrainCircuit white icon, centered)
- Title: "المعلم الذكي 🤖" (20px bold, centered)
- Message: "اسألني أي سؤال عن محتوى كورساتك" (14px text-secondary, centered)
- Subtitle: "هساعدك تفهم أي جزء صعب في المنهج" (12px text-muted, centered)
- Quick suggestion chips (horizontal wrap, centered, gap-8px, mt-16px):
  - "إيه أهم قوانين الكيمياء الحرارية؟" (chip style: bg-white, border-gray-200, rounded-full, px-12 py-6, 12px, hover:border-cyan-300)
  - "اشرحلي التحليل الكهربائي" (same chip)
  - "إيه الفرق بين الأحماض والقواعد؟" (same chip)
- Clicking a chip sends it as a student message

=== TYPING INDICATOR ===
Shows when AI is generating a response:
- Same position as AI message (start-aligned)
- Bot avatar (32px) + bubble with 3 animated dots
- Bubble: bg-white, border, rounded-14px, px-16 py-10
- Three dots: 8px circles, gray-400, bouncing animation (sequential, 0.4s delay between each)
- Text alternative below dots: "AI يكتب..." (11px text-muted)

=== ERROR MESSAGE BUBBLE ===
When AI response fails:
- Same position as AI message (start-aligned with bot avatar)
- Bubble: bg-red-50 (#FEF2F2), border-2 border-red-200, rounded-14px
- Icon: AlertCircle (red, 20px) + "حدث خطأ أثناء الإجابة" (14px text-error)
- Below: "حاول مرة أخرى" button (outline danger, small: 32px height, text-red)
  - Click retries the last student message
- Timestamp same style

=============================================
INPUT AREA
=============================================

Container: bg-white, border-t border-#E5E7EB, px-16 py-12

Input row (flex, gap-8px, max-width 768px, centered):

Textarea:
- flex-1, auto-resize (min 44px = 1 line, max 120px = ~4 lines)
- bg-gray-50, border border-gray-200, rounded-12px, px-14 py-10
- Focus: border-cyan-500, bg-white
- Placeholder: "اكتب سؤالك هنا..." (14px text-muted)
- Max: 500 characters
- RTL text direction
- Enter sends message, Shift+Enter creates new line
- Character counter appears near limit: "٤٨٠/٥٠٠" (10px text-muted, bottom-end of textarea)

Send Button:
- 44px circle, rounded-full
- DEFAULT (empty input): bg-gray-200, icon ArrowUp (gray-400), disabled, cursor-not-allowed
- ACTIVE (has text): bg-cyan-500, icon ArrowUp (white), hover:bg-cyan-600
- LOADING (waiting for AI): bg-cyan-500 with Spinner (white, animate-spin), disabled

Keyboard hint (desktop only, below input):
- "Enter للإرسال • Shift+Enter لسطر جديد" (10px text-muted, centered)

=============================================
LOADING STATE (waiting for AI response)
=============================================

When student sends message and waiting for AI:
- Student message appears immediately in chat
- Typing indicator shows below
- Send button: Spinner animation, disabled
- Textarea: Disabled, opacity-60, placeholder changes to "جارٍ الإجابة..."
- Input area slightly dimmed

=============================================
FRAMES TO DESIGN
=============================================

Frame 1 — Welcome state, empty chat (desktop 1440px):
- Chat header + empty messages area with centered welcome message
- Bot avatar large + title + subtitle + 3 suggestion chips
- Input area at bottom with empty textarea + disabled send button
- Sidebar with "المعلم الذكي" active

Frame 2 — Active conversation (desktop):
- 4-5 message pairs showing full conversation:
  - Student: "إيه الفرق بين التفاعلات الطاردة والماصة للحرارة؟"
  - AI: Long response with formatting + 2 citation chips inline
  - Student: "طب إيه أمثلة على التفاعلات الطاردة في الحياة اليومية؟"
  - AI: Response with bullet points + 1 citation chip
  - Student: "اشرحلي معادلة الطاقة"
  - AI: typing indicator (3 dots)
- Send button in loading state (spinner)
- Textarea disabled

Frame 3 — Error state (desktop):
- Same conversation but last AI message is error bubble
- Red border bubble + "حدث خطأ" + "حاول مرة أخرى" button
- Textarea re-enabled, send button active

Frame 4 — Long message with citations (desktop):
- AI message with 3+ paragraphs + bold text + chemical formulas
- 3 citation chips inline: "📖 الدرس ٣", "📖 الدرس ٥", "📖 الدرس ٧"
- Chips visually distinct within the text flow

Frame 5 — Input states (desktop, annotation frame):
- Show textarea in 4 states side by side:
  - Empty (placeholder, send disabled)
  - Typing (text entered, send active cyan)
  - Multi-line (3 lines, auto-resized, Shift+Enter)
  - Near limit (480/500 counter visible, amber)

Frame 6 — Mobile welcome state (375px):
- Full width, no sidebar
- Welcome message centered
- Suggestion chips wrap to 2 rows
- Input area full width, sticky bottom
- Bottom tab bar: "المعلم الذكي" active (cyan)

Frame 7 — Mobile active conversation (375px):
- Bubbles take more width (student: 85%, AI: 90%)
- Timestamps smaller
- Input area compact
- Bottom tab bar visible

Frame 8 — Mobile typing indicator (375px):
- 3 animated dots in AI bubble position
- "AI يكتب..." below dots

Arabic text, Cairo font, RTL direction throughout all frames.