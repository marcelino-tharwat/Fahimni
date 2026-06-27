Design the "Quiz Taking" page for Fahimni (فهّمني), an Arabic-first RTL educational platform. This is the exam interface where students answer MCQ, True/False, and Essay questions with a timer, progress tracking, and submit with confirmation.

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B, Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981, Warning: #F59E0B, Error: #EF4444
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Buttons: 44px min-height, 12px radius
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)
- Modal: white, rounded-20px, padding-24px, shadow 0 8px 24px rgba(0,0,0,0.12), overlay black/50

LAYOUT:
- Focused exam layout — NO sidebar, NO bottom tab bar (distraction-free)
- Minimal top bar: 64px height, white, border-bottom #E5E7EB
  - Start side: Fahimni logo (small, GraduationCap cyan + "Fahimni" text)
  - Center: Timer countdown (prominent)
  - End side: "إنهاء الاختبار" button (danger variant, small)
- Content: max-width 768px (max-w-3xl), centered, bg #F4F4F4FA, px-16 py-24
- Route: /student/quizzes/:quizId
- Mobile: Same focused layout, no tab bar

=============================================
PAGE STRUCTURE
=============================================

--- EXAM TOP BAR (sticky top) ---
Height: 64px, white bg, border-bottom, z-50, sticky

Left/Start side:
- Fahimni logo: GraduationCap (cyan, 20px) + "فهّمني" (16px bold navy)

Center:
- Timer: Prominent countdown display
  - bg-navy-900, rounded-full, px-16px py-6px
  - Clock icon (white, 16px) + "٣٢:١٥" (18px bold white, monospace feel, letter-spacing 2px)
  - When < 5 minutes: bg changes to red-500, pulse animation (subtle)
  - When time runs out: Auto-submit triggered

Right/End side:
- "إنهاء الاختبار" button: Outline danger variant (border-red, text-red), small size, 36px height

--- QUIZ HEADER CARD ---
White card, rounded-14px, shadow, padding-20px

Row 1:
- Quiz title: "اختبار الباب الأول: الكيمياء العضوية" (20px bold navy-900)
- Chapter badge: "تالتة ثانوي — الباب الأول" (Badge info/purple variant, 12px)

Row 2 (stats row, gap-16px, 4 items):
- "١٥ سؤال" (14px text-secondary, icon: FileText)
- "٥٠ نقطة" (14px text-secondary, icon: Award)
- "٤٥ دقيقة" (14px text-secondary, icon: Clock)
- "محاولة واحدة" (14px text-secondary, icon: AlertCircle)

--- PROGRESS BAR + QUESTION NAVIGATOR ---
White card, rounded-14px, shadow-sm, padding-16px

Progress section:
- Label: "سؤال ٥ من ١٥" (14px semibold) + answered count "تم الإجابة على ٤ أسئلة" (12px text-secondary, end-aligned)
- Progress bar: Full width, 8px height, rounded-full
  - Track: gray-200
  - Fill: cyan-500, animated width (e.g., 33% for question 5/15)

Question navigator (below progress):
- Horizontal scrollable row of numbered circles (each 32px, gap-6px):
  - ANSWERED: bg-cyan-500, white text — filled/completed
  - CURRENT: border-2 border-cyan-500, bg-white, cyan text — currently viewing
  - UNANSWERED: bg-gray-100, text-secondary — not yet answered
  - FLAGGED/SKIPPED: bg-amber-100, border-amber-400, amber text (optional feature)
- Clickable: scrolls to that question
- Mobile: Horizontally scrollable with fade edges

--- QUESTIONS SECTION (sequential vertical list) ---
All questions displayed sequentially (scrollable page, not one-at-a-time pagination).
Each question is a card. gap-20px between cards.

=== MCQ QUESTION ===
White card, rounded-14px, shadow, padding-24px

Header row:
- Start: Question number circle (36px, bg-cyan-500, white text "٥") + "سؤال ٥" (14px semibold)
- End: Point value "٣ نقاط" (12px text-secondary, Badge default) + Type badge "اختيار من متعدد" (Badge default, 11px)

Question text: "ما هو الرمز الكيميائي لعنصر الصوديوم؟" (16px text-primary, mt-16px)

Options (4 radio-style rows, mt-16px, gap-10px):
Each option: rounded-12px, border-2, padding-14px, cursor-pointer, transition

- UNSELECTED: bg-white, border-gray-200
  - Start: Radio circle (20px, border-2 border-gray-300, empty inside)
  - Option label: "أ)" (14px bold text-secondary) + Option text "Na" (14px text-primary)

- SELECTED: bg-cyan-50 (very light cyan), border-cyan-500
  - Radio circle: border-cyan-500, inner dot filled cyan-500
  - Text becomes semibold

- HOVER (unselected): bg-gray-50, border-gray-300

Options data:
- أ) Na
- ب) K
- ج) Ca
- د) Mg

=== TRUE/FALSE QUESTION ===
White card, same structure

Header: Question number + "٢ نقاط" + Badge "صح أم خطأ"

Question: "الماء مركب كيميائي يتكون من ذرتي هيدروجين وذرة أكسجين" (16px)

Two large toggle buttons (row, gap-12px, mt-16px):
Each: min-width 140px, height 52px, rounded-12px, border-2, centered text, cursor-pointer

- "صح ✓": 
  - UNSELECTED: bg-white, border-gray-200, text-secondary
  - SELECTED: bg-cyan-50, border-cyan-500, text-cyan-700, font-semibold
- "خطأ ✗":
  - Same states

=== ESSAY / SHORT ANSWER QUESTION ===
White card, same structure

Header: Question number + "٥ نقاط" + Badge "إجابة قصيرة"

Question: "اشرح بإيجاز عملية التحليل الكهربائي للماء وما هي نواتجها" (16px)

Textarea:
- min-height: 150px, border-radius 10px, border-gray-200
- Focus: border-cyan-500 with ring
- Placeholder: "اكتب إجابتك هنا..." (text-muted)
- Character counter at bottom-end: "٠ / ٢٠٠٠" (12px text-muted)
- When typing: Counter updates, e.g., "٣٤٥ / ٢٠٠٠"
- Near limit (>1800): Counter turns amber
- At limit (2000): Counter turns red, can't type more

=== FILL IN THE BLANK QUESTION ===
White card, same structure

Header: Question number + "٢ نقاط" + Badge "أكمل الفراغ"

Question: "الرمز الكيميائي للماء هو ______" (16px, blank shown as underlined space)

Input field:
- Inline input: 200px width, 48px height, 10px radius, border-gray-200
- Centered below the question or inline where the blank is
- Focus: border-cyan-500
- Placeholder: "اكتب الإجابة" (text-muted)

--- SUBMIT SECTION (bottom, sticky on mobile) ---
White card, rounded-14px, shadow-elevated, padding-20px
OR: Sticky bottom bar on mobile

Content:
- Summary: "أجبت على ١٣ من ١٥ سؤال" (14px text-secondary)
  - If all answered: "أجبت على جميع الأسئلة ✓" (14px text-success)
- "تسليم الاختبار" button: Primary accent gradient, 48px height, full width on mobile / min-width 240px on desktop
  - Icon: Send (white, 18px)
  - If not all answered: Button still enabled but shows warning count

--- SUBMIT CONFIRMATION MODAL ---
Triggered when clicking "تسليم الاختبار"

Modal: white, rounded-20px, padding-24px, max-width 440px

IF all questions answered:
- Icon: CheckCircle (cyan, 48px) centered
- Title: "تأكيد تسليم الاختبار" (18px semibold)
- Message: "أجبت على جميع الأسئلة (١٥/١٥). هل تريد تسليم الاختبار؟" (14px text-secondary)
- Note: "لا يمكن التعديل بعد التسليم" (12px text-muted)
- Buttons: "تسليم" (primary accent, full width) + "مراجعة الإجابات" (ghost, full width)

IF some questions unanswered:
- Icon: AlertTriangle (amber, 48px) centered
- Title: "لديك أسئلة بدون إجابة!" (18px semibold, text-amber-600)
- Message: "لم تجب على ٢ سؤال من أصل ١٥. هل تريد التسليم على أي حال؟" (14px text-secondary)
- Unanswered list: "الأسئلة غير المجابة: ٧، ١٢" (12px text-error) — clickable to scroll to those questions
- Buttons: "تسليم على أي حال" (danger variant, full width) + "العودة والإجابة" (primary accent, full width)

--- SUBMITTING STATE ---
- Modal changes: Spinner (cyan, 32px) + "جارٍ تسليم الاختبار..." (16px semibold) + "لا تغلق الصفحة" (12px text-muted)
- All buttons disabled

--- VALIDATION ERROR STATE ---
When student tries to submit with unanswered questions (before modal):
- Unanswered question cards get: border-2 border-red-500 (pulsing briefly)
- Red error badge appears on question number in navigator: Small red dot overlay
- Error message below progress: "يوجد ٢ سؤال بدون إجابة" (12px text-error, with AlertCircle icon)
- Page auto-scrolls to first unanswered question

--- ERROR PAGES ---

403 — Not Enrolled:
- Centered content (no quiz shown):
  - Lock icon (64px, text-muted)
  - Title: "لا يمكنك الوصول لهذا الاختبار" (18px semibold)
  - Message: "يجب الاشتراك في الفصل أولاً للوصول للاختبارات" (14px text-secondary)
  - CTA: "تصفح المحتوى" (primary accent button)

400 — Already Attempted:
- Centered content:
  - ClipboardCheck icon (64px, text-cyan-500)
  - Title: "لقد أديت هذا الاختبار بالفعل" (18px semibold)
  - Message: "يمكنك مراجعة نتائجك من صفحة النتائج" (14px text-secondary)
  - CTA: "عرض النتائج" (primary accent button) → /student/quizzes/:quizId/results

=============================================
FRAMES TO DESIGN
=============================================

Frame 1 — Quiz in progress, mid-exam (desktop 1440px):
- Timer showing 32:15
- Progress: Question 5 of 15, 4 answered
- Navigator: 4 cyan circles (answered), 1 cyan-border (current), rest gray
- Show 5 visible questions: 1 MCQ (answered/selected), 1 TF (answered), 1 MCQ (current/unanswered), 1 Essay (empty), 1 Fill-blank (empty)
- Submit bar at bottom

Frame 2 — Timer warning state (desktop):
- Timer < 5 min: Red bg, pulse animation indicator
- Same layout, showing urgency

Frame 3 — Validation error state (desktop):
- 2 unanswered questions highlighted with red borders
- Red dots on navigator circles
- Error message "يوجد ٢ سؤال بدون إجابة"
- Submit button still enabled

Frame 4 — Submit confirmation modal — all answered (desktop):
- Green check modal, "تأكيد تسليم الاختبار"

Frame 5 — Submit confirmation modal — with unanswered (desktop):
- Amber warning modal, "لديك أسئلة بدون إجابة!"

Frame 6 — Submitting loading state (desktop):
- Modal with spinner "جارٍ تسليم الاختبار..."

Frame 7 — 403 Not Enrolled error (desktop):
- Lock icon centered, "لا يمكنك الوصول"

Frame 8 — 400 Already Attempted error (desktop):
- ClipboardCheck icon, "لقد أديت هذا الاختبار بالفعل"

Frame 9 — Mobile quiz in progress (375px):
- Same focused layout, no sidebar/tab bar
- Timer in top bar (smaller)
- Navigator horizontal scroll
- Questions full width, smaller padding
- Submit section sticky at bottom

Frame 10 — Mobile submit modal (375px):
- Full-width modal from bottom (sheet style)

Arabic text, Cairo font, RTL direction throughout all frames.