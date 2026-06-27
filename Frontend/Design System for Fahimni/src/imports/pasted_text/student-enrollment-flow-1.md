Design the complete Student Enrollment Flow for Fahimni (فهّمني), an Arabic-first RTL educational platform. This covers the full journey: browsing locked chapters → clicking "Subscribe" → payment page → success → returning to unlocked content.

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B, Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981 (bg: #ECFDF5), Warning: #F59E0B, Error: #EF4444 (bg: #FEF2F2)
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Buttons: 44px min-height, 12px radius
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)
- Modal: white, rounded-20px, padding-24px, shadow 0 8px 24px rgba(0,0,0,0.12), overlay black/50

LAYOUT:
- StudentLayout: Sidebar (260px, navy-900) + Topbar (64px, white) + Content (bg #F4F4F4FA)
- Mobile: Bottom tab bar (56px, 5 tabs), sidebar hidden
- Payment page: Same StudentLayout

=============================================
STEP 1: ALL CONTENT TAB — LOCKED vs UNLOCKED CHAPTERS
=============================================

Context: Student dashboard, "كل المحتوى" (All Content) tab active.
Content tree showing stages → chapters with enrollment status.

STAGE ACCORDION (expanded):
- Stage header: "تالتة ثانوي" (18px semibold) + chapter count badge "٥ فصول"
- Below: List of chapter cards

UNLOCKED CHAPTER CARD (enrolled):
- White card, rounded-14px, shadow-sm, padding-16px
- Row layout:
  - Start: Chapter icon (BookOpen, cyan, in bg-cyan-50 circle 40px)
  - Middle: Chapter name "الباب الأول: الكيمياء العضوية" (14px semibold) + "٨ دروس" (12px text-secondary)
  - End: Badge "مشترك" (success green pill) + ChevronLeft icon (for RTL navigation)
- Clickable — navigates to lesson list
- Subtle hover: bg-gray-50

LOCKED CHAPTER CARD (not enrolled):
- White card, rounded-14px, shadow-sm, padding-16px, border border-dashed border-gray-300
- Row layout:
  - Start: Lock icon (Lock, text-muted, in bg-gray-100 circle 40px)
  - Middle: Chapter name "الباب الثاني: الكيمياء الكهربية" (14px semibold text-secondary/dimmed) + "١٠ دروس" (12px text-muted)
  - End: "اشترك الآن" button (primary accent, small size: height 36px, px-12, text-13px)
- "اشترك الآن" button has small sparkle/lock-open icon before text
- Hover on card: border becomes solid border-cyan-200, card lifts slightly
- Click "اشترك الآن" → navigates to /student/payment/:chapterId

MIXED LIST EXAMPLE (show 5 chapters):
1. الباب الأول: الكيمياء العضوية — ✅ مشترك (enrolled)
2. الباب الثاني: الكيمياء الكهربية — 🔒 اشترك الآن (locked)
3. الباب الثالث: الاتزان الكيميائي — 🔒 اشترك الآن (locked)
4. الباب الرابع: الكيمياء الحرارية — ✅ مشترك (enrolled)
5. الباب الخامس: كيمياء العناصر — 🔒 اشترك الآن (locked)

=============================================
STEP 2: PAYMENT PAGE (/student/payment/:chapterId)
=============================================

Layout: StudentLayout, content max-width 640px centered

BACK NAV:
- "← الرجوع لكل المحتوى" (ghost link, text-secondary)

PAGE TITLE: "إتمام الاشتراك" (22px bold)

CHAPTER DETAILS CARD:
- White card, rounded-14px, shadow, padding-24px
- Chapter info:
  - Stage badge: "تالتة ثانوي" (Badge info/purple)
  - Chapter name: "الباب الثاني: الكيمياء الكهربية" (20px bold)
  - Lesson count: "١٠ دروس" (14px text-secondary, FileText icon)
  - Quiz count: "٣ اختبارات" (14px text-secondary, ClipboardList icon)
  - Access type: "وصول مدى الحياة ♾️" (12px text-success, with infinity icon)
- Divider

PRICE SECTION:
- Price: "١٥٠ ج.م" (28px extrabold cyan-500)
- Hint: "دفعة واحدة — بدون اشتراك شهري" (12px text-muted)

PAYMENT OPTIONS:
Section title: "اختر طريقة الدفع" (16px semibold)

Option 1 — Paymob Electronic Payment:
- Selectable card: border-2 rounded-14px padding-16px, cursor-pointer
  - UNSELECTED: border-gray-200, bg-white
  - SELECTED: border-cyan-500, bg-cyan-50/30
- Layout:
  - Radio circle (start) + Icon area: CreditCard (24px) in cyan gradient circle (40px)
  - Title: "الدفع الإلكتروني" (14px semibold)
  - Description: "بطاقة بنكية • محفظة إلكترونية • فوري" (12px text-secondary)
  - Payment method icons row: Visa, Mastercard, Fawry, Vodafone Cash logos (small 24px grayscale icons)
  - End: Radio filled when selected

Option 2 — Promo Code:
- Same card structure
  - Icon: Ticket (24px) in purple gradient circle (40px)
  - Title: "كود تفعيل" (14px semibold)
  - Description: "أدخل كود التفعيل من الدعم الفني" (12px text-secondary)
  - End: Badge "مجاناً" (success green pill)

PROMO CODE INPUT (appears when Option 2 is selected):
- Slides in below Option 2 with smooth animation
- Input: 48px height, 10px radius, text-center, uppercase, letter-spacing 2px
- Placeholder: "أدخل الكود هنا" (text-muted)
- "تحقق" button next to input (outline cyan)
- Validation states:
  - Valid: Green border + "✓ الكود صالح" (text-success)
  - Invalid: Red border + "✗ كود غير صحيح" (text-error)
  - Expired: Red border + "✗ كود منتهي الصلاحية"
  - Used: Red border + "✗ تم استخدام هذا الكود"

ORDER SUMMARY:
- bg-gray-50, rounded-12px, padding-16px
- Row: "الباب الثاني: الكيمياء الكهربية" + "١٥٠ ج.م"
- If promo valid: Discount row: "خصم كود التفعيل" + "-١٥٠ ج.م" (text-success) + strikethrough on original price
- Divider
- Total row: "الإجمالي" (16px bold) + "١٥٠ ج.م" (16px bold cyan) OR "مجاناً" (if promo)

ACTION BUTTON:
- If Paymob selected: "ادفع ١٥٠ ج.م" (primary accent gradient, full width, 48px)
- If promo valid: "تفعيل الاشتراك" (primary accent gradient, full width, 48px)
- If promo selected but not validated: Button disabled
- Loading: Spinner + "جارٍ المعالجة..."

SECURE PAYMENT BADGE:
- Centered below button: Lock icon + "دفع آمن ومشفر" (11px text-muted)

=============================================
STEP 3: SUCCESS STATE — AFTER PAYMENT/REDEEM
=============================================

Success modal OR full-page success (overlay on payment page):

- Large green check circle (72px), animated
- Title: "تم الاشتراك بنجاح! 🎉" (22px bold, centered)
- Chapter: "الباب الثاني: الكيمياء الكهربية" (14px text-secondary)
- Access badge: "وصول مدى الحياة ♾️" (Badge success)
- Message: "يمكنك الآن الوصول لجميع دروس واختبارات هذا الباب" (14px text-secondary)

Two CTAs:
- "ابدأ الدرس الأول" (primary accent gradient, full width) → navigates to chapter lesson list
- "عرض كورساتي" (ghost, text-cyan-500) → navigates to My Courses tab

=============================================
STEP 4: AFTER SUCCESS — UPDATED STATES
=============================================

ALL CONTENT TAB — Updated chapter status:
- The previously locked chapter (الباب الثاني) now shows:
  - Enrolled card style (no dashed border, no lock icon)
  - Badge: "مشترك" (success green) + "جديد" (small cyan badge, temporary)
  - BookOpen icon replaces Lock icon
  - Clickable to navigate to lessons

MY COURSES TAB — New course appears:
- New course card at the top of the grid:
  - "جديد" ribbon/badge on the card (cyan, top-start corner)
  - Chapter name + teacher name
  - Progress bar at 0% (empty track, "٠/١٠ دروس")
  - "ابدأ التعلم" button (primary)
- Subtle highlight animation (brief glow border) for the new card

=============================================
STEP 5: ERROR STATES
=============================================

PAYMENT FAILURE:
- Same payment page, but with error banner at top:
  - bg-red-50, border-s-4 border-red-500, rounded-10px, padding-16px
  - Icon: XCircle (red) + "فشلت عملية الدفع" (14px semibold text-error)
  - Message: "حدث خطأ أثناء معالجة الدفع. تأكد من بيانات البطاقة وحاول مرة أخرى." (12px text-secondary)
  - "حاول مرة أخرى" link (text-cyan-500)
- All form fields remain filled (not cleared)
- Payment button re-enabled

ALREADY ENROLLED:
- If student navigates to payment page for already-enrolled chapter:
  - Centered message:
    - CheckCircle icon (64px, cyan)
    - "أنت مشترك في هذا الفصل بالفعل" (18px semibold)
    - "يمكنك الوصول لكل الدروس والاختبارات" (14px text-secondary)
    - "الذهاب للدروس" button (primary)

=============================================
FRAMES TO DESIGN
=============================================

Frame 1 — All Content tab with mixed enrolled/locked chapters (desktop 1440px):
- 5 chapters: 2 enrolled, 3 locked with "اشترك الآن" buttons
- "كل المحتوى" tab active

Frame 2 — Payment page — Paymob selected (desktop):
- Chapter details card + price + Paymob option selected + order summary + pay button

Frame 3 — Payment page — Promo Code selected + valid code (desktop):
- Promo option selected, code input with green valid state
- Order summary shows discount, total = "مجاناً"
- "تفعيل الاشتراك" button enabled

Frame 4 — Payment page — Promo Code invalid (desktop):
- Red error on promo input
- Button disabled

Frame 5 — Payment processing loading (desktop):
- Button shows spinner "جارٍ المعالجة..."
- Form fields slightly dimmed

Frame 6 — Success state (desktop):
- Green check + "تم الاشتراك بنجاح!" + CTAs

Frame 7 — All Content tab AFTER enrollment (desktop):
- Same 5 chapters but الباب الثاني now shows "مشترك" + "جديد" badge
- Visual before/after comparison

Frame 8 — My Courses tab with new course (desktop):
- Grid with the newly enrolled course card highlighted with "جديد" ribbon
- Progress at 0%

Frame 9 — Payment error state (desktop):
- Error banner at top of payment page
- Form still filled

Frame 10 — Already enrolled state (desktop):
- Centered message "أنت مشترك بالفعل"

Frame 11 — Mobile payment page (375px):
- Full width, single column
- Payment options stacked
- Bottom tab bar visible behind content

Frame 12 — Mobile success state (375px):
- Full screen success overlay

Arabic text, Cairo font, RTL direction throughout all frames.