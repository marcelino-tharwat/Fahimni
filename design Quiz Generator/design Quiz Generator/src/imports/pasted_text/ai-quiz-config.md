Design the "AI Quiz Generator — Step 1: Configure Parameters" page for Fahimni (فهّمني), an Arabic-first RTL educational platform.

This is a TEACHER-FACING page where the teacher configures quiz parameters before AI generates questions. It's Step 1 of a 3-step wizard flow:
- Step 1: Configure parameters (THIS PAGE)
- Step 2: Review & edit generated questions
- Step 3: Publish & assign to chapter

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B (sidebar, dark sections)
- Accent cyan: #00C9DB (CTAs, active states, focus rings, progress indicators)
- Background: #F4F4F4FA (page body)
- Surface: #FFFFFF (cards, inputs)
- Border: #E5E7EB
- Text primary: #1A103D
- Text secondary: #6B7280
- Text muted: #9CA3AF
- Success: #10B981, Warning: #F59E0B, Error: #EF4444, Info/Purple: #7C3AED
- Inputs: 48px height, 10px border-radius, focus border cyan-500
- Buttons: 44px min-height, 12px border-radius
- Cards: white, 14px border-radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)
- Purple gradient: linear-gradient(135deg, #7C3AED, #6D28D9)

LAYOUT:
- TeacherLayout: Sidebar (260px fixed, bg navy-900 #0F0A2B) + Topbar (64px, white, border-bottom)
- Sidebar active item: "إنشاء اختبار" (Quiz Generator) — bg cyan-500, white text, icon: Sparkles or BrainCircuit
- Topbar: Page title on start side + notification bell + avatar dropdown on end side
- Content area: bg #F4F4F4FA, max-width 960px (max-w-4xl), centered, px-16 py-24
- Mobile: Sidebar as overlay drawer, content full width

PAGE STRUCTURE:

--- STEP INDICATOR (top of content) ---
Horizontal 3-step progress indicator:
- Step 1: "إعداد الاختبار" — ACTIVE (cyan-500 circle with "١", cyan text, bold)
- Step 2: "مراجعة الأسئلة" — INACTIVE (gray-300 circle with "٢", text-muted)
- Step 3: "نشر الاختبار" — INACTIVE (gray-300 circle with "٣", text-muted)
- Steps connected by horizontal line (gray-200, 2px)
- Active step line segment is cyan-500
- Each step: Numbered circle (32px) + Label below (12px)
- On mobile: Show numbers only, labels hidden or abbreviated

--- PAGE HEADER ---
- Title: "إنشاء اختبار بالذكاء الاصطناعي" — 24px extrabold navy-900
- Subtitle: "حدد إعدادات الاختبار وسيقوم الذكاء الاصطناعي بإنشاء الأسئلة تلقائياً" — 14px text-secondary
- Small AI sparkle icon (✨) next to title in cyan or purple

--- MAIN FORM CARD ---
White card, rounded-14px, shadow, padding-24px (desktop) / padding-16px (mobile)

SECTION 1 — Content Source (اختيار المحتوى):
- Section label: "اختيار المحتوى" (16px semibold, with BookOpen icon)
- Stage dropdown (Select):
  - Label: "المرحلة الدراسية"
  - Placeholder: "اختر المرحلة..."
  - Options: أولى ثانوي, تانية ثانوي, تالتة ثانوي
  - Height: 48px, border-radius: 10px
- Chapter dropdown (Select, dependent on Stage):
  - Label: "الفصل"
  - Placeholder: "اختر الفصل..."
  - Disabled until stage is selected (opacity-50)
- Lesson multi-select (optional):
  - Label: "الدروس (اختياري)"
  - Placeholder: "اختر دروس محددة أو اتركه فارغاً لكل الفصل..."
  - Chip/tag display for selected lessons (rounded-full, cyan-50 bg, cyan-700 text, X to remove)
  - Hint below: "اتركه فارغاً لتوليد أسئلة من كل دروس الفصل" (11px text-muted)
- Fields layout: 2 columns on desktop (Stage + Chapter side by side), Lessons full width below. Single column on mobile.

Divider line (border-#E5E7EB, my-20px)

SECTION 2 — Quiz Configuration (إعدادات الاختبار):
- Section label: "إعدادات الاختبار" (16px semibold, with Settings icon)

- Quiz Title:
  - Label: "عنوان الاختبار"
  - Input (48px, 10px radius)
  - Placeholder: "مثال: اختبار الباب الأول — الكيمياء العضوية"

- Number of Questions:
  - Label: "عدد الأسئلة"
  - Counter input: Minus button [-] + Number display (centered, 48px width) + Plus button [+]
  - Default value: 10, Min: 5, Max: 50
  - Buttons: 40px square, rounded-10px, border-gray-200, icon in center
  - Active button hover: bg-gray-100
  - OR: Slider input with number display (range 5-50, step 5, cyan track)

- Time Limit:
  - Label: "المدة الزمنية (بالدقائق)"
  - Counter input same style: Default 30, Min: 5, Max: 120, Step: 5
  - Hint: "٣٠ دقيقة = حوالي ٣ دقائق لكل سؤال" (11px text-muted, dynamically calculated)

- Layout: 2 columns (Questions + Time side by side), Title full width. Single column mobile.

Divider line

SECTION 3 — Question Types (أنواع الأسئلة):
- Section label: "أنواع الأسئلة" (16px semibold, with ListChecks icon)
- Instruction: "اختر نوع أو أكثر من أنواع الأسئلة" (12px text-secondary)

- Toggle cards — each is a selectable card (NOT a checkbox):
  - Layout: 2×2 grid on desktop, single column on mobile
  - Each card: border-2 rounded-14px padding-16px, cursor-pointer
    - UNSELECTED: border-gray-200, bg-white
    - SELECTED: border-cyan-500, bg-cyan-50/30 (#00C9DB at 8% opacity)
  - Content: Icon (24px, in circle bg) + Title (14px semibold) + Description (12px text-secondary)

  Card 1 — MCQ:
  - Icon: CircleDot (cyan gradient circle bg)
  - Title: "اختيار من متعدد"
  - Description: "٤ اختيارات مع إجابة واحدة صحيحة"
  - SELECTED by default

  Card 2 — True/False:
  - Icon: ToggleLeft (purple gradient circle bg)
  - Title: "صح أم خطأ"
  - Description: "أسئلة تحدد صحة العبارة"

  Card 3 — Fill in the Blank:
  - Icon: TextCursorInput (cyan gradient circle bg)
  - Title: "أكمل الفراغ"
  - Description: "أسئلة تكميلية للمصطلحات والمعادلات"

  Card 4 — Short Answer:
  - Icon: MessageSquare (purple gradient circle bg)
  - Title: "إجابة قصيرة"
  - Description: "أسئلة تحتاج إجابة مكتوبة قصيرة"

Divider line

SECTION 4 — Difficulty Level (مستوى الصعوبة):
- Section label: "مستوى الصعوبة" (16px semibold, with Gauge icon)

- Option 1 — Uniform difficulty:
  - 3 selectable pill buttons in a row (segmented control style):
    - "سهل" (Easy) — green tint when selected
    - "متوسط" (Medium) — amber/yellow tint when selected — DEFAULT SELECTED
    - "صعب" (Hard) — red tint when selected
  - Each pill: min-width 100px, height 40px, rounded-full, border
    - Unselected: border-gray-200, bg-white, text-secondary
    - Selected: colored border + light bg + colored text (e.g., medium = border-amber-400, bg-amber-50, text-amber-700)

- Option 2 — Mixed difficulty (toggle):
  - Toggle switch: "خليط من المستويات" (Mix of levels)
  - When ON: Shows 3 mini sliders/inputs for percentage per level:
    - سهل: 30% | متوسط: 50% | صعب: 20%
    - Total must equal 100% — show dynamic total indicator
  - When OFF: Show the 3 pills above

Divider line

SECTION 5 — Advanced Options (خيارات إضافية) — Collapsible:
- Collapsed by default: "خيارات إضافية" with ChevronDown icon, clickable to expand
- When expanded:

  - Shuffle Questions:
    - Toggle switch + Label "ترتيب عشوائي للأسئلة"
    - Default: ON

  - Shuffle Answer Choices:
    - Toggle switch + Label "ترتيب عشوائي للاختيارات"
    - Default: ON

  - Include Explanations:
    - Toggle switch + Label "تضمين شرح الإجابة الصحيحة"
    - Hint: "الذكاء الاصطناعي سيولد شرح لكل إجابة صحيحة" (11px text-muted)
    - Default: ON

  - Language:
    - Radio buttons: "عربي" (default) | "English" | "خليط (عربي + English)"

--- FORM ACTIONS (bottom of card) ---
- Right-aligned (start-aligned in RTL) button group, gap-12px
- "إلغاء" button: Ghost variant, text-secondary — navigates back to dashboard
- "إنشاء الاختبار ✨" button: Accent gradient (cyan-500 → sky-500), white text, bold, 48px height, min-width 200px, rounded-12px
  - Icon: Sparkles (white, 18px) before text
  - Shadow: 0 0 20px rgba(0,201,219,0.25) on hover (glow effect)
  - LOADING STATE: Spinner + "جارٍ الإنشاء..." (Generating...), disabled, opacity-90

--- STATES TO DESIGN ---

FRAME 1 — Default state (desktop 1440px):
- Empty form with defaults (Stage not selected, MCQ pre-selected, Medium difficulty, 10 questions, 30 minutes)

FRAME 2 — Filled state (desktop):
- Stage: تالتة ثانوي, Chapter: الباب الأول, Lessons: 2 chips selected
- Title filled, 15 questions, 45 minutes
- MCQ + True/False selected
- Mixed difficulty ON with sliders showing 30/50/20
- Advanced options expanded

FRAME 3 — Loading/Generating state (desktop):
- Form grayed out (opacity-60, pointer-events-none)
- Generate button shows spinner + "جارٍ الإنشاء..."
- Optional: Overlay card or inline progress showing "الذكاء الاصطناعي يحلل المحتوى..." with animated dots or progress bar

FRAME 4 — Validation error state (desktop):
- Stage not selected: Red border on Stage dropdown + "اختر المرحلة أولاً" error below
- No question type selected: Red border around question types section + "اختر نوع واحد على الأقل" error
- Title empty: Red border + "عنوان الاختبار مطلوب"

FRAME 5 — Mobile version (375px):
- Same form, single column layout
- All fields stack vertically
- Question type cards: Single column
- Difficulty pills: Full width row
- Generate button: Full width
- Step indicator: Numbers only, no labels

Design all 5 frames. Arabic text, Cairo font, RTL direction throughout.