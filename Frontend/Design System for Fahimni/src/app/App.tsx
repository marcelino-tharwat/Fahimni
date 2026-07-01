import { useState, useRef, useEffect } from "react";
import {
  GraduationCap, Bell, ChevronDown, LogOut, Menu, X,
  LayoutDashboard, BookOpen, Settings, BrainCircuit,
  RotateCcw, ArrowUp, AlertCircle, Loader2,
  Home, GraduationCap as Cap, Bot, User, ClipboardList,
} from "lucide-react";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const G_CYAN = "linear-gradient(135deg,#00C9DB,#0EA5E9)";
const G_NAVY = "linear-gradient(135deg,#251758,#0F0A2B)";

/* ═══════════════════════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════════════════════ */

function Av({ i, sz = 36 }: { i: string; sz?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: sz, height: sz, fontSize: sz <= 40 ? 12 : 15, background: G_NAVY, flexShrink: 0 }}>
      {i}
    </div>
  );
}

/* ── Bot avatar ──────────────────────────────────────────────────────────── */
function BotAv({ sz = 32 }: { sz?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white shrink-0"
      style={{ width: sz, height: sz, background: "#0F0A2B", flexShrink: 0 }}>
      <BrainCircuit size={sz * 0.5} />
    </div>
  );
}

/* ── Citation chip ───────────────────────────────────────────────────────── */
function Citation({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all duration-150 mx-0.5"
      style={{ background: "rgba(0,201,219,0.08)", borderColor: "rgba(0,201,219,0.3)", color: "#0CA5AB" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(0,201,219,0.15)"; el.style.borderColor = "rgba(0,201,219,0.5)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(0,201,219,0.08)"; el.style.borderColor = "rgba(0,201,219,0.3)"; }}>
      <BookOpen size={10} />📖 {label}
    </button>
  );
}

/* ── Typing dots ─────────────────────────────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-[#9CA3AF]"
          style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
      ))}
      <style>{`@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAYOUT
═══════════════════════════════════════════════════════════════════════════ */

const SB_NAV = [
  { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "لوحة التحكم"   },
  { id: "content",   icon: <BookOpen size={18} />,        label: "المحتوى"        },
  { id: "ai",        icon: <BrainCircuit size={18} />,    label: "المعلم الذكي",  active: true },
  { id: "settings",  icon: <Settings size={18} />,        label: "الإعدادات"      },
];

function Sidebar({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  return (
    <aside className="flex flex-col h-full shrink-0" style={{ width: 260, background: "#0F0A2B" }}>
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: G_CYAN }}>
            <GraduationCap size={19} />
          </div>
          <span className="text-xl font-extrabold text-white">فهّمني</span>
        </div>
        {mobile && <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>}
      </div>
      <div className="mx-4 h-px bg-white/10 mb-3" />
      <div className="mx-3 mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Av i="أم" sz={32} />
        <div>
          <p className="text-xs font-semibold text-white">أحمد محمد</p>
          <p className="text-[10px] text-white/40">طالب — ث٣</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3 flex-1">
        {SB_NAV.map(n => {
          const a = !!n.active;
          return (
            <div key={n.id} onClick={() => mobile && onClose?.()}
              className={cx("flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all",
                a ? "text-white" : "text-[#E0DEEF]/60 hover:bg-white/08 hover:text-[#E0DEEF]")}
              style={a ? { background: "#00C9DB" } : undefined}>
              <span className={a ? "text-white" : "text-[#E0DEEF]/40"}>{n.icon}</span>
              {n.label}
            </div>
          );
        })}
      </nav>
      <div className="px-3 pb-5 shrink-0">
        <div className="h-px bg-white/10 mb-3" />
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[#EF4444]/70 hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all cursor-pointer">
          <LogOut size={18} />تسجيل الخروج
        </div>
      </div>
    </aside>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center gap-4 px-5 shrink-0"
      style={{ boxShadow: "0 1px 0 #E5E7EB" }}>
      <button onClick={onMenu} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4]">
        <Menu size={20} />
      </button>
      <h1 className="text-[22px] font-bold text-[#1A103D]">المعلم الذكي</h1>
      <div className="flex-1" />
      <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4] shrink-0">
        <Bell size={18} />
        <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[#00C9DB] border-2 border-white" />
      </button>
      <div className="flex items-center gap-2.5 ps-3 border-s border-[#E5E7EB] shrink-0">
        <Av i="أم" sz={34} />
        <div className="hidden sm:block text-end">
          <p className="text-sm font-semibold text-[#1A103D] leading-none">أحمد محمد</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">طالب — ث٣</p>
        </div>
        <ChevronDown size={14} className="text-[#9CA3AF]" />
      </div>
    </header>
  );
}

function BottomTabBar() {
  const tabs = [
    { icon: Home,          label: "الرئيسية" },
    { icon: BookOpen,      label: "المحتوى"  },
    { icon: Cap,           label: "كورساتي" },
    { icon: BrainCircuit,  label: "الذكي",  active: true },
    { icon: User,          label: "حسابي" },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 start-0 end-0 z-30 h-14 bg-white border-t border-[#E5E7EB] flex"
      style={{ boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
      {tabs.map(({ icon: Icon, label, active }) => (
        <button key={label} className="flex-1 flex flex-col items-center justify-center gap-0.5">
          <Icon size={20} style={{ color: active ? "#00C9DB" : "#9CA3AF" }} />
          <span className="text-[10px] font-medium" style={{ color: active ? "#00C9DB" : "#9CA3AF" }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MESSAGE TYPES
═══════════════════════════════════════════════════════════════════════════ */

type MsgRole = "student" | "ai" | "typing" | "error";

interface Msg {
  id: number; role: MsgRole; time: string;
  text?: string; parts?: React.ReactNode[]; error?: boolean;
}

/* ── Student bubble ──────────────────────────────────────────────────────── */
function StudentBubble({ msg }: { msg: Msg }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[75%] px-4 py-2.5 rounded-[14px] rounded-tl-[4px] text-sm text-white leading-relaxed"
        style={{ background: "linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
        {msg.text}
      </div>
      <span className="text-[11px] text-[#9CA3AF] px-1">{msg.time}</span>
    </div>
  );
}

/* ── AI bubble ───────────────────────────────────────────────────────────── */
function AIBubble({ msg }: { msg: Msg }) {
  return (
    <div className="flex items-start gap-2.5">
      <BotAv sz={32} />
      <div className="flex flex-col gap-1 min-w-0">
        <div className="max-w-[80%] px-4 py-3 rounded-[14px] rounded-tr-[4px] bg-white border border-[#E5E7EB] text-sm text-[#1A103D] leading-relaxed"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {msg.parts ?? msg.text}
        </div>
        <span className="text-[11px] text-[#9CA3AF] px-1">{msg.time}</span>
      </div>
    </div>
  );
}

/* ── Typing bubble ───────────────────────────────────────────────────────── */
function TypingBubble() {
  return (
    <div className="flex items-start gap-2.5">
      <BotAv sz={32} />
      <div className="flex flex-col gap-1">
        <div className="px-4 py-3 rounded-[14px] rounded-tr-[4px] bg-white border border-[#E5E7EB]"
          style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <TypingDots />
        </div>
        <span className="text-[11px] text-[#9CA3AF] px-1">AI يكتب...</span>
      </div>
    </div>
  );
}

/* ── Error bubble ────────────────────────────────────────────────────────── */
function ErrorBubble({ time }: { time: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <BotAv sz={32} />
      <div className="flex flex-col gap-1">
        <div className="px-4 py-3 rounded-[14px] rounded-tr-[4px] border-2 flex flex-col gap-2"
          style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={16} style={{ color: "#EF4444" }} className="shrink-0" />
            <p className="text-sm font-medium text-[#EF4444]">حدث خطأ أثناء الإجابة</p>
          </div>
          <button className="self-start h-8 px-3 rounded-lg text-xs font-semibold border-2 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white transition-all">
            حاول مرة أخرى
          </button>
        </div>
        <span className="text-[11px] text-[#9CA3AF] px-1">{time}</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   WELCOME SCREEN
═══════════════════════════════════════════════════════════════════════════ */

const SUGGESTIONS = [
  "إيه أهم قوانين الكيمياء الحرارية؟",
  "اشرحلي التحليل الكهربائي",
  "إيه الفرق بين الأحماض والقواعد؟",
];

function WelcomeScreen({ onSuggest }: { onSuggest: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 px-6 text-center">
      {/* large bot avatar */}
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg"
        style={{ background: "#0F0A2B", boxShadow: "0 0 32px rgba(0,201,219,0.2)" }}>
        <BrainCircuit size={32} style={{ color: "#00C9DB" }} />
      </div>

      <div>
        <h2 className="text-xl font-bold text-[#1A103D]">المعلم الذكي</h2>
        <p className="text-sm text-[#6B7280] mt-1">اسألني أي سؤال عن محتوى كورساتك</p>
        <p className="text-xs text-[#9CA3AF] mt-0.5">هساعدك تفهم أي جزء صعب في المنهج</p>
      </div>

      {/* suggestion chips */}
      <div className="flex flex-wrap justify-center gap-2 mt-2 max-w-lg">
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => onSuggest(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E5E7EB] text-[#6B7280] transition-all hover:border-[#00C9DB]/50 hover:text-[#00C9DB] hover:bg-[#F0FDFE]">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   INPUT AREA
═══════════════════════════════════════════════════════════════════════════ */

function InputArea({ value, onChange, onSend, disabled = false, loading = false }: {
  value: string; onChange: (v: string) => void; onSend: () => void;
  disabled?: boolean; loading?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX = 500;
  const nearLimit = value.length >= 480;
  const hasText = value.trim().length > 0;

  function resize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasText && !disabled && !loading) onSend();
    }
  }

  return (
    <div className="bg-white border-t border-[#E5E7EB] px-4 py-3 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end">
          {/* textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => { onChange(e.target.value.slice(0, MAX)); resize(); }}
              onKeyDown={handleKey}
              disabled={disabled || loading}
              placeholder={loading ? "جارٍ الإجابة..." : "اكتب سؤالك هنا..."}
              dir="rtl"
              rows={1}
              className={cx(
                "w-full resize-none rounded-xl border px-4 py-2.5 text-sm text-[#1A103D] placeholder:text-[#9CA3AF] outline-none transition-all duration-150 leading-relaxed",
                disabled || loading ? "opacity-60 cursor-not-allowed bg-[#F9FAFB] border-[#E5E7EB]"
                  : "bg-[#F9FAFB] border-[#E5E7EB] focus:border-[#00C9DB] focus:bg-white focus:ring-2 focus:ring-[#00C9DB]/15"
              )}
              style={{ minHeight: 44, maxHeight: 120 }}
            />
            {/* char counter near limit */}
            {nearLimit && (
              <p className="absolute bottom-2 start-3 text-[10px] font-medium"
                style={{ color: value.length >= MAX ? "#EF4444" : "#F59E0B" }}>
                {value.length}/{MAX}
              </p>
            )}
          </div>

          {/* send button */}
          <button
            onClick={onSend}
            disabled={!hasText || disabled || loading}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 active:scale-[0.93]"
            style={{
              background: hasText && !disabled && !loading ? G_CYAN : "#E5E7EB",
              cursor: hasText && !disabled && !loading ? "pointer" : "not-allowed",
            }}>
            {loading
              ? <Loader2 size={18} className="animate-spin text-white" />
              : <ArrowUp size={18} style={{ color: hasText && !disabled ? "white" : "#9CA3AF" }} />
            }
          </button>
        </div>

        {/* keyboard hint */}
        <p className="hidden sm:block text-center text-[10px] text-[#C4C9D0] mt-1.5">
          Enter للإرسال • Shift+Enter لسطر جديد
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT CONVERSATIONS (pre-built for frames)
═══════════════════════════════════════════════════════════════════════════ */

const CONV_ACTIVE: Msg[] = [
  {
    id: 1, role: "student", time: "٢:٣٠ م",
    text: "إيه الفرق بين التفاعلات الطاردة والماصة للحرارة؟",
  },
  {
    id: 2, role: "ai", time: "٢:٣١ م",
    parts: [
      <span key="p">
        <strong>التفاعلات الطاردة للحرارة</strong> هي التفاعلات اللي بتطلق طاقة حرارية للوسط المحيط، يعني درجة حرارة المحلول بتزيد.
        <br /><br />
        أما <strong>التفاعلات الماصة للحرارة</strong> فهي العكس — بتمتص طاقة من الوسط المحيط، فدرجة الحرارة بتقل.
        <br /><br />
        مثال على التفاعل الطارد: احتراق الوقود 🔥<br />
        مثال على التفاعل الماص: ذوبان ملح النشادر في الماء
        <br /><br />
        اتشرحت التفاصيل أكتر في <Citation label="الدرس ٣: الكيمياء الحرارية" /> و <Citation label="الدرس ٥: الطاقة والتفاعلات" />
      </span>,
    ],
  },
  {
    id: 3, role: "student", time: "٢:٣٢ م",
    text: "طب إيه أمثلة على التفاعلات الطاردة في الحياة اليومية؟",
  },
  {
    id: 4, role: "ai", time: "٢:٣٣ م",
    parts: [
      <span key="p">
        في أمثلة كتير حواليك:<br /><br />
        • <strong>احتراق الوقود</strong> في السيارات والمحركات<br />
        • <strong>التنفس الخلوي</strong> في جسمك — بيطلق طاقة من السكر<br />
        • <strong>انفجار المفرقعات</strong> — تفاعل سريع طارد جداً<br />
        • <strong>الصدأ</strong> — تأكسد الحديد مع الأكسجين ببطء
        <br /><br />
        شوف <Citation label="الدرس ٧: تطبيقات عملية" /> للمزيد.
      </span>,
    ],
  },
  { id: 5, role: "student", time: "٢:٣٤ م", text: "اشرحلي معادلة الطاقة" },
  { id: 6, role: "typing",  time: "" },
];

const CONV_ERROR: Msg[] = [
  ...CONV_ACTIVE.slice(0, 5),
  { id: 6, role: "error", time: "٢:٣٤ م" },
];

const CONV_CITATION: Msg[] = [
  {
    id: 1, role: "student", time: "٣:١٠ م",
    text: "اشرحلي التحليل الكهربائي للماء بالتفصيل مع المعادلات",
  },
  {
    id: 2, role: "ai", time: "٣:١١ م",
    parts: [
      <span key="p">
        <strong>التحليل الكهربائي للماء (Electrolysis of Water)</strong>
        <br /><br />
        هو عملية تمرير تيار كهربائي في الماء المحلول لتحليله إلى عنصرَيه الأساسيَّين:
        <br /><br />
        🔵 <strong>عند القطب السالب (الكاثود):</strong><br />
        يتصاعد غاز الهيدروجين H₂<br />
        المعادلة: <code className="bg-[#F4F4F4] px-1 rounded text-xs">2H⁺ + 2e⁻ → H₂↑</code>
        <br /><br />
        🔴 <strong>عند القطب الموجب (الأنود):</strong><br />
        يتصاعد غاز الأكسجين O₂<br />
        المعادلة: <code className="bg-[#F4F4F4] px-1 rounded text-xs">2H₂O → O₂↑ + 4H⁺ + 4e⁻</code>
        <br /><br />
        <strong>المعادلة الكلية:</strong><br />
        <code className="bg-[#F4F4F4] px-1.5 py-0.5 rounded text-xs font-bold">2H₂O → 2H₂ + O₂</code>
        <br /><br />
        نسبة حجم H₂ إلى O₂ = 2 : 1 (زي النسبة في جزيء الماء!)
        <br /><br />
        اقرأ أكتر في <Citation label="الدرس ١: مقدمة للكهروكيمياء" /> و{" "}
        <Citation label="الدرس ٣: التحليل الكهربائي" /> و{" "}
        <Citation label="الدرس ٧: تطبيقات الكهرباء الكيميائية" />
      </span>,
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT PAGE
═══════════════════════════════════════════════════════════════════════════ */

type FrameId = "welcome" | "active" | "error" | "citation" | "input-states" | "mobile-welcome" | "mobile-active" | "mobile-typing";

function ChatPage({ frame }: { frame: FrameId }) {
  const [inputVal, setInputVal] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages: Msg[] =
    frame === "active"   ? CONV_ACTIVE :
    frame === "error"    ? CONV_ERROR  :
    frame === "citation" ? CONV_CITATION :
    frame === "mobile-active"  ? CONV_ACTIVE :
    frame === "mobile-typing"  ? CONV_ACTIVE :
    [];

  const isWelcome = frame === "welcome" || frame === "mobile-welcome";
  const isLoading  = frame === "active" || frame === "mobile-typing";

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [frame]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* chat sub-header */}
      <div className="flex items-center justify-between px-5 h-12 border-b border-[#E5E7EB] bg-white shrink-0">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} style={{ color: "#00C9DB" }} />
          <span className="text-sm font-semibold text-[#1A103D]">المعلم الذكي</span>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#1A103D] transition-colors px-3 py-1.5 rounded-xl hover:bg-[#F4F4F4]">
          <RotateCcw size={13} />محادثة جديدة
        </button>
      </div>

      {/* messages area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5" style={{ background: "#F4F4FA" }}>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">

          {isWelcome ? (
            <WelcomeScreen onSuggest={s => setInputVal(s)} />
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "student" && <StudentBubble msg={msg} />}
                  {msg.role === "ai"      && <AIBubble msg={msg} />}
                  {msg.role === "typing"  && <TypingBubble />}
                  {msg.role === "error"   && <ErrorBubble time={msg.time} />}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}

        </div>
      </div>

      {/* input states showcase */}
      {frame === "input-states" && (
        <div className="px-4 sm:px-6 py-5 overflow-y-auto" style={{ background: "#F4F4FA" }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-4">حالات منطقة الإدخال</p>
            <div className="grid gap-4">
              {/* Empty */}
              <div>
                <p className="text-[11px] text-[#9CA3AF] mb-1.5">١ — فارغ (زر الإرسال معطّل)</p>
                <div className="flex gap-2 items-end bg-white border-t border-[#E5E7EB] px-4 py-3 rounded-xl">
                  <div className="flex-1 h-11 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-4 flex items-center">
                    <span className="text-sm text-[#9CA3AF]">اكتب سؤالك هنا...</span>
                  </div>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 bg-[#E5E7EB]">
                    <ArrowUp size={18} className="text-[#9CA3AF]" />
                  </div>
                </div>
              </div>
              {/* Has text */}
              <div>
                <p className="text-[11px] text-[#9CA3AF] mb-1.5">٢ — يحتوي نصاً (زر الإرسال نشط)</p>
                <div className="flex gap-2 items-end bg-white border-t border-[#E5E7EB] px-4 py-3 rounded-xl">
                  <div className="flex-1 h-11 bg-white border-2 border-[#00C9DB] rounded-xl px-4 flex items-center"
                    style={{ boxShadow: "0 0 0 3px rgba(0,201,219,0.12)" }}>
                    <span className="text-sm text-[#1A103D]">اشرحلي التحليل الكهربائي</span>
                  </div>
                  <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{ background: G_CYAN }}>
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
              {/* Multi-line */}
              <div>
                <p className="text-[11px] text-[#9CA3AF] mb-1.5">٣ — متعدد السطور (Shift+Enter)</p>
                <div className="flex gap-2 items-end bg-white border-t border-[#E5E7EB] px-4 py-3 rounded-xl">
                  <div className="flex-1 bg-white border-2 border-[#00C9DB] rounded-xl px-4 py-3 text-sm text-[#1A103D] leading-relaxed"
                    style={{ boxShadow: "0 0 0 3px rgba(0,201,219,0.12)" }}>
                    اشرحلي التحليل الكهربائي<br/>
                    وإيه المعادلة الكيميائية؟<br/>
                    وإيه أهم التطبيقات؟
                  </div>
                  <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white self-end"
                    style={{ background: G_CYAN }}>
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
              {/* Near limit */}
              <div>
                <p className="text-[11px] text-[#9CA3AF] mb-1.5">٤ — قرب الحد الأقصى (٤٨٠/٥٠٠)</p>
                <div className="flex gap-2 items-end bg-white border-t border-[#E5E7EB] px-4 py-3 rounded-xl">
                  <div className="flex-1 relative bg-white border-2 border-[#F59E0B] rounded-xl px-4 py-2.5 text-sm text-[#1A103D]"
                    style={{ boxShadow: "0 0 0 3px rgba(245,158,11,0.12)" }}>
                    <span className="text-[#9CA3AF] line-clamp-1">سؤال طويل جداً يملأ معظم الحد المسموح به...</span>
                    <span className="absolute bottom-2 start-3 text-[10px] font-semibold" style={{ color: "#F59E0B" }}>
                      ٤٨٠/٥٠٠
                    </span>
                  </div>
                  <button className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{ background: G_CYAN }}>
                    <ArrowUp size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* input area */}
      {frame !== "input-states" && (
        <InputArea
          value={inputVal}
          onChange={setInputVal}
          onSend={() => {}}
          disabled={false}
          loading={isLoading}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP SHELL + FRAME SWITCHER
═══════════════════════════════════════════════════════════════════════════ */

const FRAMES: { id: FrameId; label: string }[] = [
  { id: "welcome",       label: "١ — ترحيب"           },
  { id: "active",        label: "٢ — محادثة نشطة"     },
  { id: "error",         label: "٣ — خطأ"              },
  { id: "citation",      label: "٤ — روابط مرجعية"    },
  { id: "input-states",  label: "٥ — حالات الإدخال"   },
  { id: "mobile-welcome",label: "٦ — موبايل: ترحيب"   },
  { id: "mobile-active", label: "٧ — موبايل: محادثة"  },
  { id: "mobile-typing", label: "٨ — موبايل: يكتب..."  },
];

export default function App() {
  const [frame, setFrame] = useState<FrameId>("welcome");
  const [drawer, setDrawer] = useState(false);

  return (
    <div dir="rtl" style={{ fontFamily: "Cairo, sans-serif", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* control strip */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap"
        style={{ background: "#0F0A2B", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
            style={{ background: G_CYAN }}>
            <BrainCircuit size={13} />
          </div>
          <span className="text-xs font-extrabold text-white">فهّمني</span>
          <span className="text-white/30 mx-1">·</span>
          <span className="text-xs text-white/50">المعلم الذكي</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FRAMES.map(({ id, label }) => {
            const active = frame === id;
            return (
              <button key={id} onClick={() => setFrame(id)}
                className={cx("px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap",
                  active ? "text-white" : "text-white/50 hover:text-white/80")}
                style={active ? { background: G_CYAN } : undefined}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* layout */}
      <div className="flex flex-1 overflow-hidden" style={{ background: "#F4F4FA" }}>
        {/* desktop sidebar */}
        <div className="hidden lg:flex flex-col h-full shrink-0"><Sidebar /></div>

        {/* mobile drawer */}
        {drawer && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
            <div className="relative z-50 flex flex-col h-full"><Sidebar mobile onClose={() => setDrawer(false)} /></div>
          </div>
        )}

        {/* main column */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onMenu={() => setDrawer(true)} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <ChatPage key={frame} frame={frame} />
          </div>
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}
