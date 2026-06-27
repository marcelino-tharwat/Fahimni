Design the "Quiz Results" page for Fahimni (فهّمني), an Arabic-first RTL educational platform. This is a STUDENT-FACING page shown after submitting a quiz, displaying score, per-question review with correct/wrong highlighting, and essay questions pending grading.

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B, Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981 (bg: #ECFDF5, border: #10B981)
- Warning: #F59E0B (bg: #FFFBEB, border: #F59E0B)
- Error: #EF4444 (bg: #FEF2F2, border: #EF4444)
- Info/Purple: #7C3AED
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Buttons: 44px min-height, 12px radius
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)

LAYOUT:
- StudentLayout: Sidebar (260px, navy-900) + Topbar (64px, white) + Content (bg #F4F4F4FA)
- Mobile: Bottom tab bar (56px, 5 tabs), sidebar hidden
- Content: max-width 768px (max-w-3xl), centered, px-16 py-24
- Route: /student/quizzes/:quizId/results

=============================================
PAGE STRUCTURE
=============================================

--- BREADCRUMB / BACK NAV ---
- "← الرجوع للوحة التحكم" link at top (ChevronRight icon in RTL + text, ghost style, text-secondary, hover:text-cyan-500)

--- SCORE HERO CARD ---
Large white card, rounded-14px, shadow, padding-32px, centered content

PASS STATE (score ≥ 50%):
- Circular progress ring (120px diameter):
  - Track: gray-200 (4px stroke)
  - Fill: Success green #10B981 (4px stroke, animated from 0 to score%)
  - Center: Score percentage "٧٨%" (36px extrabold, text-success)
- Below ring: "أحسنت! لقد اجتزت الاختبار 🎉" (18px semibold, text-success)
- Score detail: "١٢ / ١٥ إجابة صحيحة" (14px text-secondary)
- Points: "٣٩ / ٥٠ نقطة" (14px text-secondary)

FAIL STATE (score < 50%):
- Same ring but fill: Error red #EF4444
- Center: "٣٢%" (36px extrabold, text-error)
- Below: "للأسف لم تجتز الاختبار" (18px semibold, text-error)
- Encouraging: "لا تقلق، راجع إجاباتك وحاول مرة أخرى 💪" (14px text-secondary)

Stats Row (below score, 3 mini stats horizontal, gap-16px):
- Each stat: bg-gray-50, rounded-12px, padding-12px, centered
  - Stat 1: "١٢" (20px bold) + "صحيحة" (11px text-secondary) — icon CheckCircle green
  - Stat 2: "٢" (20px bold) + "خاطئة" (11px text-secondary) — icon XCircle red
  - Stat 3: "١" (20px bold) + "بانتظار التصحيح" (11px text-secondary) — icon Clock amber

Quiz info line: "اختبار الباب الأول: الكيمياء العضوية • تالتة ثانوي • ١٥ سؤال • ٤٥ دقيقة" (12px text-muted, centered)

--- QUESTION NAVIGATION BAR ---
White card, rounded-14px, shadow-sm, padding-12px
- Horizontal scrollable row of numbered circles (each 36px):
  - Correct answer: bg-success/green-500, white text number
  - Wrong answer: bg-error/red-500, white text number
  - Pending (essay): bg-warning/amber-500, white text number
  - Example: ①② green, ③ red, ④⑤⑥ green, ⑦ amber, ⑧ red, etc.
- Scroll arrows on mobile (ChevronLeft/Right at edges)
- Click scrolls to that question below

--- QUESTIONS REVIEW SECTION ---
Title: "مراجعة الإجابات" (18px semibold) + filter pills:
- "الكل" (all, default active), "صحيحة" (correct), "خاطئة" (wrong), "بانتظار" (pending)
- Pills: same tab style, active = cyan border + text

Vertical stack of question cards, gap-16px:

=== QUESTION TYPE 1: MCQ (Correct Answer) ===
Card: white, rounded-14px, padding-20px
- Left accent border: 4px solid #10B981 (green, start side)
- Header row:
  - Question number + status: "سؤال ١" (14px semibold) + CheckCircle icon (green, 18px) + "إجابة صحيحة" (12px text-success)
  - Points: "+٣ نقاط" (12px text-success, end-aligned)
  - Question type badge: "اختيار من متعدد" (Badge default, 11px)
- Question text: "ما هو الرمز الكيميائي لعنصر الصوديوم؟" (16px text-primary, mt-12px)
- Answer options (4 radio-style rows, mt-12px, gap-8px):
  - Each option: rounded-10px, padding-12px, border-1px
  - CORRECT (selected by student = correct answer): bg-success-50 (#ECFDF5), border-success (#10B981), CheckCircle icon (green) + "Na" (14px semibold text-success)
  - INCORRECT NOT SELECTED: bg-white, border-gray-200, text-secondary — "K", "Ca", "Mg"
  - Radio circle indicator on the end side of each row

=== QUESTION TYPE 2: MCQ (Wrong Answer) ===
Card: white, rounded-14px, padding-20px
- Left accent border: 4px solid #EF4444 (red)
- Header: "سؤال ٣" + XCircle (red) + "إجابة خاطئة" (text-error)
- Points: "٠ نقاط" (12px text-error)
- Question: "أي من التالي يمثل حمضاً قوياً؟" (16px)
- Options:
  - WRONG (student selected this): bg-red-50 (#FEF2F2), border-red (#EF4444), XCircle icon (red) + "CH₃COOH" (14px text-error, strikethrough or highlighted)
  - CORRECT (not selected by student): bg-green-50 (#ECFDF5), border-green (#10B981), CheckCircle icon (green) + "HCl" (14px text-success) + small label "الإجابة الصحيحة" (11px text-success)
  - NEUTRAL: bg-white, border-gray-200 — "NaOH", "H₂O"
- Explanation section (if available):
  - bg-purple-50, rounded-10px, padding-12px, mt-12px
  - Icon: Lightbulb (purple) + "الشرح:" (12px semibold purple)
  - Text: "حمض الهيدروكلوريك HCl هو حمض قوي لأنه يتأين بالكامل في الماء..." (12px text-primary)

=== QUESTION TYPE 3: True/False (Correct) ===
Card: white, rounded-14px, padding-20px
- Left accent border: 4px solid #10B981
- Header: "سؤال ٥" + CheckCircle (green) + "إجابة صحيحة" + Badge "صح أم خطأ"
- Question: "الماء مركب كيميائي يتكون من ذرتي هيدروجين وذرة أكسجين" (16px)
- Two toggle buttons (row, gap-12px):
  - "صح ✓" button: bg-green-50, border-green, text-success, rounded-10px, px-24px py-12px — SELECTED & CORRECT
  - "خطأ ✗" button: bg-white, border-gray-200, text-secondary — NOT SELECTED

=== QUESTION TYPE 4: True/False (Wrong) ===
Card: same but red accent border
- "صح ✓" SELECTED but WRONG: bg-red-50, border-red, text-error, with XCircle
- "خطأ ✗" is the CORRECT answer: bg-green-50, border-green, text-success, small "الإجابة الصحيحة" label

=== QUESTION TYPE 5: Fill in the Blank (Correct) ===
Card: green accent border
- Question: "الرمز الكيميائي للماء هو ______" (16px, with blank underlined)
- Student answer: Input-like display showing "H₂O" — bg-green-50, border-green, rounded-10px, padding-12px, CheckCircle

=== QUESTION TYPE 6: Fill in the Blank (Wrong) ===
Card: red accent border
- Student answer: "HO₂" — bg-red-50, border-red, XCircle, strikethrough
- Correct answer below: "الإجابة الصحيحة: H₂O" — bg-green-50, border-green, CheckCircle

=== QUESTION TYPE 7: Essay / Short Answer (Pending) ===
Card: white, rounded-14px, padding-20px
- Left accent border: 4px solid #F59E0B (amber/warning)
- Header: "سؤال ٧" + Clock icon (amber) + "بانتظار التصحيح" (text-amber-600)
- Badge: "بانتظار التصحيح" (Badge warning variant, amber)
- Points: "— / ٥ نقاط" (12px text-muted)
- Question type badge: "إجابة قصيرة" (Badge default)
- Question: "اشرح بإيجاز عملية التحليل الكهربائي للماء" (16px)
- Student's submitted answer:
  - bg-amber-50 (#FFFBEB), border-amber-200, rounded-10px, padding-16px
  - Label: "إجابتك:" (12px semibold text-amber-700)
  - Text: "التحليل الكهربائي هو عملية تمرير تيار كهربائي في الماء لتحويله إلى غازي الهيدروجين والأكسجين..." (14px text-primary)
- Info note: "سيتم تصحيح هذا السؤال من قبل المعلم" (11px text-muted, with Info icon)

--- PAGE FOOTER ACTIONS ---
Gap-12px, centered
- "العودة للوحة التحكم" button: Primary accent gradient, 48px, min-width 200px
  - Icon: Home (white) before text
- "إعادة الاختبار" link: Ghost variant, text-cyan-500 (if retake is allowed)

=============================================
FRAMES TO DESIGN
=============================================

Frame 1 — PASS result (desktop 1440px):
- Score hero: 78%, green ring, pass message
- Stats: 12 correct, 2 wrong, 1 pending
- Navigation bar with colored circles
- Show 4-5 questions: 2 MCQ correct, 1 MCQ wrong, 1 TF correct, 1 Essay pending
- All filters showing

Frame 2 — FAIL result (desktop):
- Score hero: 32%, red ring, fail message with encouragement
- Stats: 5 correct, 9 wrong, 1 pending
- Same question review section

Frame 3 — Wrong answers filter (desktop):
- "خاطئة" filter active
- Only showing wrong answer cards (MCQ wrong + TF wrong + Fill-in wrong)

Frame 4 — Loading state (desktop):
- Skeleton: Large circle skeleton for score + 3 stat skeleton rectangles
- 3 question card skeletons (pulse animation, gray rectangles)

Frame 5 — Mobile PASS result (375px):
- Single column, full width cards
- Score ring: 96px diameter (smaller)
- Stats row: Stack vertically or 3 col tight grid
- Question navigation: Horizontal scroll with arrows
- Question cards: Full width, slightly smaller padding (16px)
- Bottom tab bar visible

Frame 6 — Mobile FAIL result (375px):
- Same as Frame 5 but with red fail state

Arabic text, Cairo font, RTL direction throughout all frames.