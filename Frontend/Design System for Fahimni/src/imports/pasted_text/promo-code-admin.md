Design the complete Promo Code system for Fahimni (فهّمني), an Arabic-first RTL educational platform. This includes TWO separate flows: an Admin management panel and a Student redemption flow.

DESIGN SYSTEM:
- Font: Cairo (Google Fonts), all text Arabic RTL
- Primary navy: #0F0A2B
- Accent cyan: #00C9DB
- Background: #F4F4F4FA, Surface: #FFFFFF, Border: #E5E7EB
- Text primary: #1A103D, Text secondary: #6B7280, Text muted: #9CA3AF
- Success: #10B981 (bg-light: #ECFDF5), Warning: #F59E0B, Error: #EF4444 (bg-light: #FEF2F2)
- Info/Purple: #7C3AED
- Inputs: 48px height, 10px radius, focus border cyan-500
- Buttons: 44px min-height, 12px radius
- Cards: white, 14px radius, shadow 0 2px 12px rgba(0,0,0,0.06)
- Accent gradient: linear-gradient(135deg, #00C9DB, #0EA5E9)
- Modal: white, rounded-20px, padding-24px, shadow 0 8px 24px rgba(0,0,0,0.12), overlay black/50

=============================================
FLOW 1: ADMIN PROMO CODES PANEL
=============================================

LAYOUT: AdminLayout — Sidebar (260px, navy-900) + Topbar (64px, white) + Content (bg #F4F4F4FA)
- Sidebar active item: "أكواد التفعيل" (Promo Codes) — bg cyan-500, white text, icon: Ticket or Tag
- Route: /admin/promo-codes
- Content: max-width 1200px, centered, px-16 py-24
- NOTE: Only admin role exists, no separate support role.

--- PAGE HEADER ---
- Row layout: Title on start side, Generate button on end side
- Title: "أكواد التفعيل" — 24px extrabold navy-900
- Subtitle: "إنشاء وإدارة أكواد التفعيل للطلاب" — 14px text-secondary
- Button: "إنشاء كود جديد" — Primary variant (accent gradient), icon Plus (white) before text, 44px height

--- STATS ROW (3 mini stat cards) ---
Horizontal row, 3 cards, gap-16px, responsive (3 cols desktop, 1 col mobile):

Card 1 — Total Codes:
- Icon: Ticket (cyan gradient circle, 36px)
- Value: "٢٤٥" (22px bold)
- Label: "إجمالي الأكواد" (12px text-secondary)

Card 2 — Used Codes:
- Icon: CheckCircle (green, success gradient circle)
- Value: "١٨٧" (22px bold)
- Label: "أكواد مستخدمة" (12px text-secondary)

Card 3 — Available Codes:
- Icon: Clock (purple gradient circle)
- Value: "٥٨" (22px bold)
- Label: "أكواد متاحة" (12px text-secondary)

--- FILTER TABS + TABLE CARD ---
White card, rounded-14px, shadow, padding-0 (table edge-to-edge)

Filter Tabs (inside card top, with padding-16px top and horizontal):
- 3 tabs (Tabs component):
  - "الكل" (All) — active by default, cyan border + text
  - "مستخدمة" (Used) — shows only isUsed: true
  - "غير مستخدمة" (Unused) — shows only isUsed: false
- Each tab shows count badge: "الكل (٢٤٥)" etc.

Table:
- Header row: bg-gray-50, text 12px medium text-secondary, text-start
- Columns:
  | الكود | تاريخ الإنشاء | تاريخ الانتهاء | الحالة | الطالب | وقت الاستخدام |
- Body rows: 14px text-primary, border-b border-gray-100, py-12px px-16px, hover bg-gray-50

Column details:
1. الكود (Code): Monospace font style (or Cairo bold), 8 characters uppercase
   - Display in a small inline code block: bg-gray-100, rounded-8px, px-8px py-4px, font-mono
   - Example: "AB12CD34"
   - Small copy icon button (Clipboard) next to code, hover:text-cyan-500

2. تاريخ الإنشاء (Created): "١٥ يونيو ٢٠٢٦" — 14px text-secondary

3. تاريخ الانتهاء (Expires): "١٥ يوليو ٢٠٢٦" — 14px text-secondary
   - If expired: text-red-500 + "منتهي" badge

4. الحالة (Status):
   - Used: Badge success variant — "مستخدم" (green pill)
   - Unused: Badge default variant — "غير مستخدم" (gray pill)
   - Expired: Badge danger variant — "منتهي" (red pill)

5. الطالب (Used By):
   - If used: Student name "يوسف أحمد" (14px text-primary)
   - If unused: "—" (text-muted)

6. وقت الاستخدام (Used At):
   - If used: "١٥ يونيو ٢٠٢٦، ٣:٤٥ م" (12px text-secondary)
   - If unused: "—" (text-muted)

Sample data: Show 8-10 rows with mix of used, unused, and 1 expired code.

Pagination (bottom of card, padding-16px):
- Right side: "صفحة ١ من ١٣" (14px text-secondary)
- Left side: Previous/Next buttons (outline variant, ChevronRight/ChevronLeft icons)
- 20 items per page

--- GENERATE CODE MODAL ---
Triggered by "إنشاء كود جديد" button.

Modal container: Overlay black/50, centered modal

STEP 1 — Confirm Generate:
- Modal: white, rounded-20px, padding-24px, max-width 440px
- Icon at top: Large Ticket icon (48px) in cyan gradient circle (72px), centered
- Title: "إنشاء كود تفعيل جديد" (18px semibold, centered)
- Description: "سيتم إنشاء كود عشوائي مكون من ٨ أحرف صالح لتفعيل وحدة تعليمية واحدة" (14px text-secondary, centered)
- Expiry info: "صالح لمدة ٣٠ يوم من تاريخ الإنشاء" (12px text-muted, centered)
- Two buttons (full width, stacked, gap-8px):
  - "إنشاء الكود" — Primary accent gradient, 48px height
  - "إلغاء" — Ghost variant, text-secondary

STEP 2 — Code Generated (same modal, transitions to this):
- Large success checkmark animation area (or static green check circle, 64px)
- Title: "تم إنشاء الكود بنجاح!" (18px semibold, centered, text-success)
- Generated code display:
  - Large code block: bg-navy-900, rounded-14px, padding-20px, centered
  - Code text: "XK7M2P9W" — 32px extrabold, white, letter-spacing 4px, font-mono style
  - Below code: Expiry date "صالح حتى: ٢٦ يوليو ٢٠٢٦" (12px text-gray-300)
- Copy button (below code block): Full width, outline variant with cyan border
  - Icon: Clipboard + "نسخ الكود" (Copy Code)
  - After click: Icon changes to ClipboardCheck + "تم النسخ!" (Copied!) — text becomes green for 2 seconds
- WhatsApp share hint: "انسخ الكود وأرسله للطالب عبر واتساب" (12px text-muted, centered, with small WhatsApp icon)
- "إغلاق" button: Ghost variant, full width

--- EMPTY STATE (when no codes exist) ---
- Centered in table area:
  - Icon: Ticket (64px, text-muted/gray-300)
  - Title: "لم يتم إنشاء أي أكواد بعد" (18px medium text-primary)
  - Description: "اضغط على \"إنشاء كود جديد\" لتوليد أول كود تفعيل" (14px text-secondary)
  - CTA: "إنشاء أول كود" button (primary accent)

--- LOADING STATES ---
- Table loading: 5 Skeleton rows (animate-pulse)
- Generate button loading: Spinner + "جارٍ الإنشاء..." (disabled)

=============================================
FLOW 2: STUDENT PROMO CODE REDEMPTION
=============================================

This flow happens when a student tries to access a LOCKED chapter.

LAYOUT: StudentLayout — Sidebar + Topbar + Content + Mobile bottom tab bar (56px)

--- SCENARIO: LOCKED CHAPTER CARD ---
Context: Student browsing "كل المحتوى" (All Content) tab, clicks on a locked chapter.

Locked Chapter Card (inline in content tree):
- Same chapter card style but with visual lock:
  - Overlay: semi-transparent white/80 over card content
  - Lock icon: Lock (24px, navy-700) centered or badge overlay
  - Chapter name visible but dimmed
  - "مقفل — اشترك للوصول" (12px text-secondary) below name
  - On click: Opens the Checkout/Payment options

--- CHECKOUT OPTIONS MODAL ---
Triggered when student clicks a locked chapter.

Modal: white, rounded-20px, padding-24px, max-width 480px, overlay black/50

Header:
- Chapter name: "الباب الأول: الكيمياء العضوية" (18px semibold)
- Chapter info: "تالتة ثانوي • ٨ دروس" (12px text-secondary)
- Divider below

Title: "اختر طريقة الدفع" (16px semibold)

Option 1 — Electronic Payment:
- Selectable card: border-2 rounded-14px padding-16px
  - Icon: CreditCard (24px) in cyan gradient circle (40px)
  - Title: "الدفع الإلكتروني" (14px semibold)
  - Description: "ادفع عبر بطاقة بنكية أو محفظة إلكترونية" (12px text-secondary)
  - Price: "١٥٠ ج.م" (16px bold cyan-500) — end-aligned
  - Powered by: "عبر Paymob" (11px text-muted)
- SELECTED state: border-cyan-500, bg-cyan-50/30

Option 2 — Promo Code:
- Selectable card: Same style
  - Icon: Ticket (24px) in purple gradient circle (40px)
  - Title: "لديك كود تفعيل؟" (14px semibold)
  - Description: "أدخل كود التفعيل الذي حصلت عليه من الدعم الفني" (12px text-secondary)
  - Badge: "مجاناً" (Badge success variant) — end-aligned

Action button (changes based on selection):
- If payment selected: "متابعة للدفع" (primary accent gradient, full width) → goes to Paymob
- If promo selected: "إدخال الكود" (primary accent gradient, full width) → transitions to promo input step

--- PROMO CODE INPUT STEP (same modal, next screen) ---

Back arrow: "رجوع" link at top-start (ChevronRight icon + text, ghost)

Title: "إدخال كود التفعيل" (18px semibold, centered)
Chapter reminder: "الباب الأول: الكيمياء العضوية" (Badge info variant, centered)

Code Input:
- Large single input field, centered
- Height: 56px (taller than normal inputs)
- Font: 20px bold, letter-spacing 3px, text-center, uppercase
- Placeholder: "XXXXXXXX" (text-muted, letter-spacing 4px)
- Max length: 8 characters
- Border-radius: 12px
- Auto converts to uppercase as user types
- Width: Full width of modal content

Validation States:
- DEFAULT: border-gray-200, no message
- FOCUS: border-cyan-500 with cyan ring
- VALIDATING: Small spinner icon inside input (end side) + "جارٍ التحقق..." below (12px text-muted)
- VALID: border-green-500, green ring, CheckCircle icon inside input (end side, green)
  - Message below: "✓ الكود صالح للاستخدام" (12px text-success)
- INVALID (used): border-red-500, red ring, XCircle icon inside input
  - Message: "✗ هذا الكود تم استخدامه بالفعل" (12px text-error)
- INVALID (expired): border-red-500
  - Message: "✗ هذا الكود منتهي الصلاحية" (12px text-error)
- INVALID (not found): border-red-500
  - Message: "✗ كود غير صحيح، تأكد من الكود وحاول مرة أخرى" (12px text-error)

Action Buttons:
- "تفعيل الكود" button: Primary accent gradient, full width, 48px
  - Disabled when input empty or validation failed (opacity-50)
  - Enabled only when validation returns VALID
  - Loading state: Spinner + "جارٍ التفعيل..."
- "إلغاء" link below: Ghost, text-secondary

--- SUCCESS STATE (same modal, transitions after redeem) ---
- Celebration area: Large green checkmark in circle (64px) OR confetti animation hint
- Title: "تم التفعيل بنجاح! 🎉" (22px bold, text-center)
- Message: "تم فتح الباب الأول: الكيمياء العضوية" (14px text-secondary, center)
- Sub-message: "يمكنك الآن الوصول لجميع دروس هذا الباب بشكل دائم" (12px text-muted)
- Lifetime badge: "وصول مدى الحياة ♾️" (Badge success, centered)
- CTA button: "ابدأ التعلم الآن" (primary accent gradient, full width, 48px)
  - Navigates to My Courses / the now-unlocked chapter
- Secondary: "عرض كورساتي" link (ghost, text-cyan-500)

=============================================
FRAMES TO DESIGN
=============================================

ADMIN PANEL FRAMES:
Frame 1 — Admin Promo List (desktop 1440px): Default state with data, "الكل" filter active, 8 rows, pagination
Frame 2 — Admin Promo List with filter (desktop): "غير مستخدمة" filter active, showing only unused codes
Frame 3 — Generate Modal Step 1 (desktop): Confirm generation dialog
Frame 4 — Generate Modal Step 2 (desktop): Code generated with copy button, success state
Frame 5 — Generate Modal Step 2 — Copied (desktop): After copy click, "تم النسخ!" green state
Frame 6 — Admin Empty State (desktop): No codes, empty state with CTA
Frame 7 — Admin Promo List (mobile 375px): Responsive table (horizontally scrollable or card layout on mobile)

STUDENT FLOW FRAMES:
Frame 8 — Locked Chapter Card (desktop): Chapter card with lock overlay in content tree
Frame 9 — Checkout Options Modal (desktop): Two payment options, promo code option selected
Frame 10 — Promo Code Input — empty (desktop): Input field with placeholder, button disabled
Frame 11 — Promo Code Input — validating (desktop): Spinner in input, "جارٍ التحقق..."
Frame 12 — Promo Code Input — valid (desktop): Green border, "الكود صالح", button enabled
Frame 13 — Promo Code Input — invalid (desktop): Red border, error message
Frame 14 — Redemption Success (desktop): Celebration, "تم التفعيل بنجاح!", CTA to start learning
Frame 15 — Student mobile (375px): Checkout modal + promo input adapted for mobile, bottom tab bar visible behind overlay

Arabic text, Cairo font, RTL direction throughout all frames.