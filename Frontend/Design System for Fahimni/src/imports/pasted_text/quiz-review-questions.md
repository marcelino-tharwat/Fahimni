Design Step 2 of the Quiz Generator wizard for Fahimni (فهّمني). This is a CONTINUATION of the Step 1 design already created — the teacher has just generated questions via AI and now reviews, edits, deletes, reorders, and adds manual questions before publishing.

IMPORTANT: This page uses the EXACT same layout, sidebar, topbar, and step indicator from Step 1 (already designed). The only difference is Step 2 is now active in the indicator, and the content area shows the question review interface instead of the parameter form.

DESIGN SYSTEM (same as Step 1):
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B, Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981, Warning: #F59E0B, Error: #EF4444
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Buttons: 44px min-height, 12px radius
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)
- Modal: white, rounded-20px, padding-24px, overlay black/50

LAYOUT (same as Step 1):
- TeacherLayout: Sidebar (260px, navy-900) + Topbar (64px, white) + Content (bg #F4F4F4FA)
- Sidebar active: "إنشاء اختبار" (cyan-500)
- Content: max-width 960px centered, px-16 py-24

=============================================
STEP INDICATOR (same component, Step 2 now active)
=============================================

- Step 1: "إعداد الاختبار" — COMPLETED (cyan-500 filled circle with ✓ checkmark, cyan text)
- Step 2: "مراجعة الأسئلة" — ACTIVE (cyan-500 circle with "٢", cyan bold text)
- Step 3: "نشر الاختبار" — INACTIVE (gray-300 circle with "٣", text-muted)
- Line between Step 1→2: cyan-500 (completed), Line 2→3: gray-200 (pending)

=============================================
PAGE HEADER
=============================================

Row layout:
- Start side:
  - Title: "مراجعة الأسئلة" (24px extrabold navy-900)
  - Subtitle: "راجع الأسئلة المولدة وعدّل أو احذف أو أعد ترتيبها حسب حاجتك" (14px text-secondary)
- End side:
  - Question count badge: "١٥ سؤال" (Badge cyan, 14px) — updates dynamically
  - Total points: "٥٠ نقطة" (Badge purple/info, 14px)

Quiz context line below:
- "اختبار الباب الأول: الكيمياء العضوية • تالتة ثانوي • متوسط" (12px text-muted)

=============================================
TOOLBAR ROW
=============================================

White card, rounded-14px, shadow-sm, padding-12px, horizontal row, items centered

Start side:
- "إضافة سؤال" button: Outline cyan, icon Plus, small size (36px height)
- Type filter pills (optional, horizontal): "الكل" (active) | "اختيار من متعدد" | "صح/خطأ" | "إجابة قصيرة"
  - Each pill: rounded-full, px-12, py-4, 12px text
  - Active: bg-cyan-50, text-cyan-700, border-cyan-200
  - Inactive: bg-white, text-secondary, border-gray-200

End side:
- "حفظ كمسودة" button: Ghost, text-secondary, small
- Collapse/Expand all toggle: Eye icon + "طي الكل" (12px text-secondary)

=============================================
QUESTION LIST (vertical stack, gap-16px)
=============================================

Each question is a card. Show 5-6 questions with different types.

=== MCQ QUESTION CARD (View Mode) ===
White card, rounded-14px, shadow, padding-0 (structured sections)

Card Header (bg-gray-50, rounded-t-14px, px-20px, py-12px):
- Start: Drag handle icon (GripVertical, 16px, text-muted, cursor-grab) + "سؤال ١" (14px semibold)
- Middle: Type badge "اختيار من متعدد" (Badge default, 11px) + Difficulty "متوسط" (Badge amber small) + Points "٣ نقاط" (12px text-secondary)
- End: Action buttons row (gap-4px):
  - Edit: Pencil icon button (ghost, 32px square, hover:bg-cyan-50)
  - Delete: Trash2 icon button (ghost, 32px square, hover:bg-red-50, hover:text-red)
  - More: MoreVertical icon button (ghost, 32px square)

Card Body (px-20px, py-16px):
- Question text: "ما هو الرمز الكيميائي لعنصر الصوديوم؟" (15px text-primary)
- Options (mt-12px, gap-6px):
  - 4 rows, each: rounded-10px, px-12px py-8px, border
  - Format: Letter label + Option text
  - CORRECT answer highlighted: bg-green-50, border-green-200, text-success, CheckCircle icon (12px)
    - "أ) Na" ✓
  - Wrong options: bg-white, border-gray-100, text-secondary
    - "ب) K"
    - "ج) Ca"
    - "د) Mg"
- Explanation (if exists, mt-12px):
  - bg-purple-50, rounded-8px, px-12px py-8px
  - "💡 الشرح: الصوديوم عنصر فلزي رمزه Na من الاسم اللاتيني Natrium" (12px)

=== TRUE/FALSE QUESTION CARD ===
Same header structure.
Body:
- Question: "الماء مركب يتكون من ذرتي هيدروجين وذرة أكسجين" (15px)
- Two chips:
  - Correct: "صح ✓" — bg-green-50, border-green, text-success, rounded-full px-16 py-6
  - Wrong: "خطأ" — bg-white, border-gray-200, text-secondary

=== ESSAY/SHORT ANSWER QUESTION CARD ===
Same header structure. Badge: "إجابة قصيرة"
Body:
- Question: "اشرح عملية التحليل الكهربائي للماء" (15px)
- Expected answer hint (if exists):
  - bg-blue-50, rounded-8px, px-12px py-8px
  - "📝 إرشادات التصحيح: يجب أن يذكر الطالب فصل الماء إلى هيدروجين وأكسجين باستخدام تيار كهربائي" (12px text-blue-700)
- Max characters: "الحد الأقصى: ٢٠٠٠ حرف" (11px text-muted)

=== DRAGGING STATE (question being reordered) ===
- Card being dragged: Elevated shadow (shadow-modal), slight scale (1.02), border-2 border-cyan-300, opacity-95
- Drop zone: Dashed border area (border-2 border-dashed border-cyan-300, bg-cyan-50/20, height 80px, rounded-14px) appears between other cards
- Other cards shift with smooth animation

=============================================
EDIT QUESTION MODAL
=============================================

Triggered by clicking edit (pencil) icon on any question.
Modal: white, rounded-20px, padding-0, max-width 640px

Modal Header (bg-gray-50, rounded-t-20px, px-24px, py-16px):
- Title: "تعديل السؤال" (18px semibold)
- Close button: X icon (end side)

Modal Body (px-24px, py-20px, max-height 70vh, scrollable):

Question Type (read-only display):
- Badge: "اختيار من متعدد" (can't change type after generation)

Question Text:
- Label: "نص السؤال" (14px medium)
- Textarea: min-height 80px, 10px radius, value pre-filled
- Hint: "يمكنك تعديل صياغة السؤال" (11px text-muted)

Points:
- Label: "النقاط"
- Number input: Width 100px, 48px height, value "٣"

FOR MCQ — Options Editor:
- Label: "الاختيارات" (14px medium)
- 4 option rows (gap-8px):
  - Each row: Radio button (to select correct) + Letter label (أ/ب/ج/د) + Text input (flex-1, 44px height) + Delete option button (X, ghost)
  - Correct option radio: Filled cyan-500
  - Correct row has subtle green-50 bg
- "إضافة اختيار" link below (+ icon, text-cyan-500, 12px) — max 6 options

FOR TRUE/FALSE — Correct Answer:
- Label: "الإجابة الصحيحة"
- Two radio buttons: "صح" / "خطأ"

FOR ESSAY — Grading Hint:
- Label: "إرشادات التصحيح (اختياري)"
- Textarea: placeholder "أضف ملاحظات تساعد في تصحيح هذا السؤال..."
- Max Characters:
  - Label: "الحد الأقصى للإجابة"
  - Number input, default 2000

Explanation (all types):
- Label: "شرح الإجابة (اختياري)"
- Textarea: placeholder "أضف شرحاً يظهر للطالب بعد حل الاختبار..."

Modal Footer (border-t, px-24px, py-16px):
- "حفظ التعديلات" button: Primary cyan, end-aligned
- "إلغاء" button: Ghost, text-secondary

=============================================
ADD NEW QUESTION MODAL
=============================================

Triggered by "إضافة سؤال" button.
Same modal structure as Edit, but empty fields.

Extra field at top:
- Question Type selector:
  - Label: "نوع السؤال"
  - 4 selectable cards in row (small, 100px each):
    - "اختيار من متعدد" (icon CircleDot)
    - "صح أم خطأ" (icon ToggleLeft)
    - "أكمل الفراغ" (icon TextCursorInput)
    - "إجابة قصيرة" (icon MessageSquare)
  - Selected: border-cyan-500, bg-cyan-50
  - Form fields below change based on selected type

Modal Footer:
- "إضافة السؤال" button: Primary cyan
- "إلغاء" button: Ghost

=============================================
DELETE CONFIRMATION DIALOG
=============================================

Small modal (max-width 400px):
- Icon: Trash2 (red, 40px) in red-50 circle (64px)
- Title: "حذف السؤال؟" (18px semibold)
- Message: "هل أنت متأكد من حذف \"ما هو الرمز الكيميائي لعنصر الصوديوم؟\"؟ لا يمكن التراجع." (14px text-secondary)
- Updated count: "سيصبح عدد الأسئلة ١٤ بدلاً من ١٥" (12px text-muted)
- Buttons: "حذف" (danger variant, full width) + "إلغاء" (ghost, full width)

=============================================
BOTTOM NAVIGATION BAR (sticky bottom on desktop)
=============================================

White bg, border-t, padding-16px, max-width 960px centered

- Start side: "← الرجوع للخطوة الأولى" button (ghost, text-secondary, ChevronRight icon for RTL)
  - Preserves all Step 1 parameters when going back
- End side: "المتابعة للخطوة الثالثة →" button (primary accent gradient, 44px, ChevronLeft icon for RTL)
  - Enabled when ≥ 1 question exists
  - Disabled (opacity-50) when 0 questions
  - Shows question count: "المتابعة (١٥ سؤال)"

=============================================
FRAMES TO DESIGN
=============================================

Frame 1 — Default review state (desktop 1440px):
- Step 2 active in indicator, Step 1 completed (✓)
- Header with "١٥ سؤال" + "٥٠ نقطة" badges
- Toolbar with "إضافة سؤال" + type filters
- 5 question cards: 3 MCQ (one with explanation shown), 1 TF, 1 Essay
- Correct answers highlighted green in each card
- Bottom nav: Back to Step 1 + Continue to Step 3

Frame 2 — Edit Question modal (desktop):
- MCQ question being edited
- Question text filled, 4 options with inputs, option أ selected as correct (green radio)
- Explanation textarea filled
- Save/Cancel buttons

Frame 3 — Add New Question modal (desktop):
- Type selector at top: "اختيار من متعدد" selected
- Empty form fields below
- "إضافة السؤال" button

Frame 4 — Delete confirmation dialog (desktop):
- Trash icon, question preview text, count update, Delete/Cancel buttons

Frame 5 — Drag reorder state (desktop):
- One card elevated with drag shadow
- Drop zone (dashed border) visible between two cards
- Other cards shifted

Frame 6 — Empty state (all questions deleted, desktop):
- No question cards
- Centered empty state: icon + "لا توجد أسئلة" + "أضف أسئلة يدوياً أو ارجع للخطوة الأولى لإعادة التوليد" + two buttons: "إضافة سؤال" (primary) + "إعادة التوليد" (outline)
- Continue button disabled

Frame 7 — Mobile review state (375px):
- Same content, single column
- Question cards full width, slightly smaller padding
- Toolbar wraps: filter pills scroll horizontally
- Bottom nav: stacked buttons (Continue on top, Back below)
- Drag handles still visible but reorder via up/down buttons instead of drag on mobile

Arabic text, Cairo font, RTL direction throughout all frames.