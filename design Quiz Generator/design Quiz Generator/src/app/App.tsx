import { useState, useRef, useEffect } from "react";
import {
  GraduationCap, Bell, ChevronDown, LogOut, Menu, X,
  LayoutDashboard, BookOpen, Settings, Users, Sparkles,
  BrainCircuit, ListChecks, Gauge, Minus, Plus,
  ChevronUp, CircleDot, ToggleLeft, MessageSquare,
  Shuffle, AlignLeft, Globe, Check, AlertCircle,
  Loader2, FileText, ClipboardList,
} from "lucide-react";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

// ══════════════════════════════════════════════════════════════════════════════
// TINY SHARED ATOMS
// ══════════════════════════════════════════════════════════════════════════════
function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size <= 40 ? 12 : 16,
        background: "linear-gradient(135deg,#251758,#0F0A2B)", flexShrink: 0 }}>
      {initials}
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} type="button"
      className="relative w-11 h-6 rounded-full transition-all duration-200 shrink-0 focus:outline-none"
      style={{ background: on ? "#00C9DB" : "#E5E7EB" }}>
      <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200"
        style={{ left: on ? "calc(100% - 22px)" : "2px" }} />
    </button>
  );
}

// ── Select dropdown ───────────────────────────────────────────────────────────
function Select({ label, value, onChange, options, placeholder, disabled = false, error }:
  { label: string; value: string; onChange: (v: string) => void;
    options: { val: string; label: string }[]; placeholder?: string;
    disabled?: boolean; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#1A103D]">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cx(
            "w-full h-12 px-4 pe-9 bg-white border rounded-[10px] text-sm outline-none appearance-none transition-all duration-150",
            disabled && "opacity-50 cursor-not-allowed bg-[#F9FAFB]",
            error ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                  : focused ? "border-[#00C9DB] ring-2 ring-[#00C9DB]/15"
                  : "border-[#E5E7EB] hover:border-[#C4C9D0]",
            !value ? "text-[#9CA3AF]" : "text-[#1A103D]"
          )}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <ChevronDown size={15} className="absolute top-1/2 start-3 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
      </div>
      {error && <p className="flex items-center gap-1 text-xs text-[#EF4444]"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

// ── Text input ────────────────────────────────────────────────────────────────
function TextInput({ label, value, onChange, placeholder, error }:
  { label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; error?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#1A103D]">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} dir="auto"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cx(
          "h-12 px-4 bg-white border rounded-[10px] text-sm outline-none transition-all duration-150 placeholder:text-[#9CA3AF]",
          error ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                : focused ? "border-[#00C9DB] ring-2 ring-[#00C9DB]/15"
                : "border-[#E5E7EB] hover:border-[#C4C9D0]",
          "text-[#1A103D]"
        )} />
      {error && <p className="flex items-center gap-1 text-xs text-[#EF4444]"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

// ── Counter ───────────────────────────────────────────────────────────────────
function Counter({ label, value, onChange, min, max, step = 1, hint }:
  { label: string; value: number; onChange: (v: number) => void;
    min: number; max: number; step?: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#1A103D]">{label}</label>
      <div className="flex items-center gap-0 border border-[#E5E7EB] rounded-[10px] overflow-hidden bg-white h-12">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))}
          className="w-12 h-full flex items-center justify-center text-[#6B7280] hover:bg-[#F4F4F4] transition-colors shrink-0 border-e border-[#E5E7EB]">
          <Minus size={16} />
        </button>
        <div className="flex-1 flex items-center justify-center text-base font-bold text-[#1A103D] select-none">
          {value}
        </div>
        <button type="button" onClick={() => onChange(Math.min(max, value + step))}
          className="w-12 h-full flex items-center justify-center text-[#6B7280] hover:bg-[#F4F4F4] transition-colors shrink-0 border-s border-[#E5E7EB]">
          <Plus size={16} />
        </button>
      </div>
      {hint && <p className="text-[11px] text-[#9CA3AF]">{hint}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <span className="text-[#6B7280]">{icon}</span>
      <div>
        <p className="text-base font-semibold text-[#1A103D]">{title}</p>
        {subtitle && <p className="text-xs text-[#9CA3AF] mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FormDivider() { return <div className="h-px bg-[#E5E7EB] my-6" />; }

// ══════════════════════════════════════════════════════════════════════════════
// STEP INDICATOR
// ══════════════════════════════════════════════════════════════════════════════
const STEPS = [
  { num: "١", label: "إعداد الاختبار" },
  { num: "٢", label: "مراجعة الأسئلة" },
  { num: "٣", label: "نشر الاختبار"  },
];

function StepIndicator({ active }: { active: number }) {
  return (
    <div className="flex items-start justify-center gap-0 mb-8">
      {STEPS.map(({ num, label }, i) => {
        const done    = i < active - 1;
        const current = i === active - 1;
        return (
          <div key={num} className="flex items-start">
            <div className="flex flex-col items-center gap-2">
              {/* circle */}
              <div className={cx(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                done    ? "text-white"   : current ? "text-white"   : "bg-[#F0F0F0] text-[#C4C9D0]"
              )}
                style={done || current ? { background: done ? "#10B981" : "linear-gradient(135deg,#00C9DB,#0EA5E9)" } : undefined}>
                {done ? <Check size={14} /> : num}
              </div>
              {/* label */}
              <span className={cx(
                "text-xs font-medium whitespace-nowrap hidden sm:block",
                current ? "text-[#00C9DB]" : done ? "text-[#10B981]" : "text-[#C4C9D0]"
              )}>
                {label}
              </span>
            </div>
            {/* connector */}
            {i < STEPS.length - 1 && (
              <div className="w-20 sm:w-32 h-0.5 mt-4 mx-2 transition-all duration-300"
                style={{ background: done ? "#10B981" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LESSON CHIPS (multi-select simulation)
// ══════════════════════════════════════════════════════════════════════════════
const LESSON_OPTIONS = [
  "مقدمة في الكيمياء العضوية",
  "الهيدروكربونات المشبعة",
  "الهيدروكربونات غير المشبعة",
  "المجموعات الوظيفية",
  "التفاعلات الكيميائية",
];

function LessonMultiSelect({ selected, onChange, error }:
  { selected: string[]; onChange: (v: string[]) => void; error?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function toggle(lesson: string) {
    onChange(selected.includes(lesson) ? selected.filter((l) => l !== lesson) : [...selected, lesson]);
  }

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-sm font-medium text-[#1A103D]">الدروس <span className="text-[#9CA3AF] font-normal">(اختياري)</span></label>
      <div
        onClick={() => setOpen(!open)}
        className={cx(
          "min-h-12 px-3 py-2 bg-white border rounded-[10px] flex flex-wrap gap-1.5 items-center cursor-pointer transition-all duration-150",
          error ? "border-[#EF4444] ring-2 ring-[#EF4444]/15"
                : open ? "border-[#00C9DB] ring-2 ring-[#00C9DB]/15"
                : "border-[#E5E7EB] hover:border-[#C4C9D0]"
        )}>
        {selected.map((l) => (
          <span key={l} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: "rgba(0,201,219,0.1)", color: "#0CA5AB", border: "1px solid rgba(0,201,219,0.25)" }}>
            {l}
            <button type="button" onClick={(e) => { e.stopPropagation(); toggle(l); }}
              className="hover:text-[#EF4444] transition-colors">
              <X size={11} />
            </button>
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-sm text-[#9CA3AF]">اختر دروس محددة أو اتركه فارغاً لكل الفصل...</span>
        )}
        <ChevronDown size={14} className={cx("text-[#9CA3AF] ms-auto shrink-0 transition-transform duration-150", open && "rotate-180")} />
      </div>
      {open && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1.5 z-20"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
          {LESSON_OPTIONS.map((l) => {
            const checked = selected.includes(l);
            return (
              <button key={l} type="button" onClick={() => toggle(l)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-start hover:bg-[#F9FAFB] transition-colors">
                <div className={cx("w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all",
                  checked ? "text-white" : "border border-[#E5E7EB] bg-white")}
                  style={checked ? { background: "#00C9DB" } : undefined}>
                  {checked && <Check size={10} />}
                </div>
                <span className={checked ? "text-[#1A103D] font-medium" : "text-[#6B7280]"}>{l}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-[#9CA3AF]">اتركه فارغاً لتوليد أسئلة من كل دروس الفصل</p>
      {error && <p className="flex items-center gap-1 text-xs text-[#EF4444]"><AlertCircle size={11} />{error}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// QUESTION TYPE CARDS
// ══════════════════════════════════════════════════════════════════════════════
const Q_TYPES = [
  {
    id: "mcq",   title: "اختيار من متعدد",
    desc: "٤ اختيارات مع إجابة واحدة صحيحة",
    icon: <CircleDot size={20} />, gradient: "linear-gradient(135deg,#00C9DB,#0EA5E9)",
  },
  {
    id: "tf",    title: "صح أم خطأ",
    desc: "أسئلة تحدد صحة العبارة",
    icon: <ToggleLeft size={20} />, gradient: "linear-gradient(135deg,#7C3AED,#6D28D9)",
  },
  {
    id: "fill",  title: "أكمل الفراغ",
    desc: "أسئلة تكميلية للمصطلحات والمعادلات",
    icon: <AlignLeft size={20} />, gradient: "linear-gradient(135deg,#00C9DB,#0EA5E9)",
  },
  {
    id: "short", title: "إجابة قصيرة",
    desc: "أسئلة تحتاج إجابة مكتوبة قصيرة",
    icon: <MessageSquare size={20} />, gradient: "linear-gradient(135deg,#7C3AED,#6D28D9)",
  },
];

function QuestionTypeCard({ type, selected, onClick, hasError }:
  { type: typeof Q_TYPES[0]; selected: boolean; onClick: () => void; hasError: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={cx(
        "border-2 rounded-[14px] p-4 text-start flex items-start gap-3 transition-all duration-150 cursor-pointer",
        selected
          ? "border-[#00C9DB]"
          : hasError ? "border-[#EF4444]" : "border-[#E5E7EB] hover:border-[#C4C9D0]"
      )}
      style={selected ? { background: "rgba(0,201,219,0.06)" } : { background: "white" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
        style={{ background: type.gradient }}>
        {type.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[#1A103D]">{type.title}</p>
          {selected && (
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
              style={{ background: "#00C9DB" }}>
              <Check size={11} />
            </div>
          )}
        </div>
        <p className="text-xs text-[#9CA3AF] mt-0.5">{type.desc}</p>
      </div>
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DIFFICULTY
// ══════════════════════════════════════════════════════════════════════════════
const DIFF_CONFIG = {
  easy:   { label: "سهل",   selBg: "#ECFDF5", selBorder: "#10B981", selText: "#059669" },
  medium: { label: "متوسط", selBg: "#FFFBEB", selBorder: "#F59E0B", selText: "#B45309" },
  hard:   { label: "صعب",   selBg: "#FEF2F2", selBorder: "#EF4444", selText: "#DC2626" },
};

function DifficultyPills({ value, onChange }: {
  value: "easy" | "medium" | "hard"; onChange: (v: "easy" | "medium" | "hard") => void;
}) {
  return (
    <div className="flex gap-2">
      {(Object.entries(DIFF_CONFIG) as [keyof typeof DIFF_CONFIG, typeof DIFF_CONFIG["easy"]][]).map(([key, c]) => {
        const sel = value === key;
        return (
          <button key={key} type="button" onClick={() => onChange(key)}
            className="flex-1 h-10 rounded-full text-sm font-medium transition-all duration-150 border"
            style={sel ? { background: c.selBg, borderColor: c.selBorder, color: c.selText }
                       : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

function MixSlider({ label, color, value, onChange }: {
  label: string; color: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-sm text-[#1A103D] w-20 shrink-0">{label}</span>
      <input type="range" min={0} max={100} step={5} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: color }} />
      <span className="text-sm font-bold w-10 text-end shrink-0" style={{ color }}>{value}٪</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERATING OVERLAY
// ══════════════════════════════════════════════════════════════════════════════
function GeneratingOverlay() {
  const [dots, setDots] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[14px]"
      style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(4px)" }}>
      <div className="flex flex-col items-center gap-5 p-8 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#00C9DB,#0EA5E9)", boxShadow: "0 0 30px rgba(0,201,219,0.4)" }}>
            <BrainCircuit size={30} className="text-white" />
          </div>
          <div className="absolute -top-1.5 -end-1.5 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>
            <Sparkles size={12} className="text-white" />
          </div>
        </div>
        <div>
          <p className="text-lg font-bold text-[#1A103D]">
            الذكاء الاصطناعي يحلل المحتوى{"·".repeat(dots + 1)}
          </p>
          <p className="text-sm text-[#6B7280] mt-1">يتم توليد الأسئلة بناءً على المحتوى المحدد</p>
        </div>
        {/* animated progress */}
        <div className="w-64">
          <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div className="h-full rounded-full animate-pulse"
              style={{ width: "65%", background: "linear-gradient(90deg,#00C9DB,#0EA5E9)" }} />
          </div>
          <div className="flex justify-between text-[11px] text-[#9CA3AF] mt-1.5">
            <span>تحليل النصوص</span>
            <span>٦٥٪</span>
          </div>
        </div>
        <div className="flex gap-2 text-xs text-[#9CA3AF]">
          {["📖 قراءة المحتوى", "🧠 توليد الأسئلة", "✅ مراجعة الجودة"].map((s, i) => (
            <span key={i} className={cx("flex items-center gap-1 px-2.5 py-1 rounded-full",
              i === 0 ? "bg-[#ECFDF5] text-[#10B981]" : i === 1 ? "bg-[#F0FDFE] text-[#00C9DB]" : "bg-[#F4F4F4] text-[#9CA3AF]")}>
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════════════════════════
const NAV = [
  { id: "dashboard", icon: <LayoutDashboard size={18} />, label: "لوحة التحكم"    },
  { id: "content",   icon: <BookOpen size={18} />,        label: "إدارة المحتوى" },
  { id: "quiz",      icon: <BrainCircuit size={18} />,    label: "إنشاء اختبار"  },
  { id: "students",  icon: <Users size={18} />,           label: "الطلاب"         },
  { id: "settings",  icon: <Settings size={18} />,        label: "الإعدادات"      },
];

function Sidebar({ active, onClose, mobile = false }:
  { active: string; onClose?: () => void; mobile?: boolean }) {
  return (
    <aside className="flex flex-col h-full" style={{ width: 260, background: "#0F0A2B" }}>
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
            <GraduationCap size={19} className="text-white" />
          </div>
          <span className="text-xl font-extrabold text-white">فهّمني</span>
        </div>
        {mobile && (
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18} /></button>
        )}
      </div>
      <div className="mx-4 h-px bg-white/10 mb-3" />

      {/* teacher pill */}
      <div className="mx-3 mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Avatar initials="أم" size={32} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white truncate">أ. محمد أحمد</p>
          <p className="text-[10px] text-white/40">مدرس كيمياء</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3 flex-1">
        {NAV.map((n) => {
          const isActive = n.id === active;
          return (
            <div key={n.id} onClick={() => mobile && onClose?.()}
              className={cx("flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150",
                isActive ? "text-white" : "text-[#E0DEEF]/60 hover:bg-white/08 hover:text-[#E0DEEF]")}
              style={isActive ? { background: "#00C9DB" } : undefined}>
              <span className={isActive ? "text-white" : "text-[#E0DEEF]/40"}>{n.icon}</span>
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

// ══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ══════════════════════════════════════════════════════════════════════════════
function Topbar({ onMenu }: { onMenu: () => void }) {
  const [drop, setDrop] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setDrop(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center gap-4 px-5 shrink-0"
      style={{ boxShadow: "0 1px 0 #E5E7EB" }}>
      <button onClick={onMenu}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4] transition-colors">
        <Menu size={20} />
      </button>
      <div className="flex items-center gap-2.5">
        <h1 className="text-[22px] font-bold text-[#1A103D] leading-none">إنشاء اختبار</h1>
      </div>
      <div className="flex-1" />
      <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4] transition-colors">
        <Bell size={18} />
        <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[#00C9DB] border-2 border-white" />
      </button>
      <div className="relative" ref={ref}>
        <button onClick={() => setDrop(!drop)}
          className="flex items-center gap-2.5 ps-3 border-s border-[#E5E7EB] rounded-xl py-1.5 pe-2 hover:bg-[#F4F4F4] transition-colors">
          <Avatar initials="أم" size={34} />
          <div className="hidden sm:block text-end">
            <p className="text-sm font-semibold text-[#1A103D] leading-none">أ. محمد أحمد</p>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">مدرس كيمياء</p>
          </div>
          <ChevronDown size={14} className={cx("text-[#9CA3AF] transition-transform duration-200", drop && "rotate-180")} />
        </button>
        {drop && (
          <div className="absolute end-0 top-[calc(100%+8px)] w-44 bg-white rounded-xl border border-[#E5E7EB] py-1 z-50"
            style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}>
            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[#374151] hover:bg-[#F9FAFB] text-start">
              <Settings size={13} className="text-[#9CA3AF]" />الإعدادات
            </button>
            <div className="h-px bg-[#E5E7EB] my-1" />
            <button className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-[#EF4444] hover:bg-[#FEF2F2] text-start">
              <LogOut size={13} />تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FRAME SELECTOR (demo nav)
// ══════════════════════════════════════════════════════════════════════════════
type FrameId = "default" | "filled" | "generating" | "error";
const FRAMES: { id: FrameId; label: string }[] = [
  { id: "default",    label: "١ — الحالة الافتراضية" },
  { id: "filled",     label: "٢ — مكتمل" },
  { id: "generating", label: "٣ — جاري الإنشاء" },
  { id: "error",      label: "٤ — أخطاء التحقق" },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN FORM
// ══════════════════════════════════════════════════════════════════════════════
function QuizForm({ frame }: { frame: FrameId }) {
  const isFilled     = frame === "filled" || frame === "generating";
  const isGenerating = frame === "generating";
  const isError      = frame === "error";

  // ── state ──────────────────────────────────────────────────────────────────
  const [stage,     setStage]     = useState(isFilled ? "s3" : "");
  const [chapter,   setChapter]   = useState(isFilled ? "c1" : "");
  const [lessons,   setLessons]   = useState<string[]>(isFilled ? LESSON_OPTIONS.slice(0, 2) : []);
  const [title,     setTitle]     = useState(isFilled ? "اختبار الباب الأول — الكيمياء العضوية" : "");
  const [qCount,    setQCount]    = useState(isFilled ? 15 : 10);
  const [timeLimit, setTimeLimit] = useState(isFilled ? 45 : 30);
  const [qTypes,    setQTypes]    = useState<string[]>(isFilled ? ["mcq", "tf"] : ["mcq"]);
  const [difficulty, setDiff]     = useState<"easy"|"medium"|"hard">("medium");
  const [mixMode,   setMixMode]   = useState(isFilled);
  const [mixVals,   setMixVals]   = useState({ easy: 30, medium: 50, hard: 20 });
  const [advanced,  setAdvanced]  = useState(isFilled);
  const [shuffle,   setShuffle]   = useState(true);
  const [shuffleAns, setShuffleAns] = useState(true);
  const [explanations, setExplanations] = useState(true);
  const [lang,      setLang]      = useState<"ar"|"en"|"mix">("ar");

  function toggleQType(id: string) {
    setQTypes((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  const timeHint = `${timeLimit} دقيقة = حوالي ${Math.round(timeLimit / qCount * 10) / 10} دقائق لكل سؤال`;

  const mixTotal = mixVals.easy + mixVals.medium + mixVals.hard;
  const mixOk    = mixTotal === 100;

  return (
    <div className={cx("relative flex flex-col gap-0", (isGenerating) && "opacity-60 pointer-events-none")}>
      {isGenerating && <GeneratingOverlay />}

      {/* ── FORM CARD ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-[14px] border border-[#E5E7EB] p-5 sm:p-6"
        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>

        {/* ── SECTION 1: Content Source ─────────────────────────────── */}
        <SectionHead icon={<BookOpen size={18} />} title="اختيار المحتوى" />

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <Select
            label="المرحلة الدراسية"
            value={stage}
            onChange={(v) => { setStage(v); setChapter(""); }}
            placeholder="اختر المرحلة..."
            error={isError && !stage ? "اختر المرحلة أولاً" : undefined}
            options={[
              { val: "s1", label: "أولى ثانوي"  },
              { val: "s2", label: "تانية ثانوي" },
              { val: "s3", label: "تالتة ثانوي" },
            ]}
          />
          <Select
            label="الفصل"
            value={chapter}
            onChange={setChapter}
            placeholder="اختر الفصل..."
            disabled={!stage}
            options={[
              { val: "c1", label: "الباب الأول — الكيمياء العضوية" },
              { val: "c2", label: "الباب الثاني — الروابط"          },
              { val: "c3", label: "الباب الثالث — التحليل"          },
            ]}
          />
        </div>

        <LessonMultiSelect selected={lessons} onChange={setLessons} />

        <FormDivider />

        {/* ── SECTION 2: Quiz Config ────────────────────────────────── */}
        <SectionHead icon={<Settings size={18} />} title="إعدادات الاختبار" />

        <div className="flex flex-col gap-4">
          <TextInput
            label="عنوان الاختبار"
            value={title}
            onChange={setTitle}
            placeholder="مثال: اختبار الباب الأول — الكيمياء العضوية"
            error={isError && !title ? "عنوان الاختبار مطلوب" : undefined}
          />
          <div className="grid sm:grid-cols-2 gap-4">
            <Counter
              label="عدد الأسئلة"
              value={qCount}
              onChange={setQCount}
              min={5} max={50} step={5}
            />
            <Counter
              label="المدة الزمنية (بالدقائق)"
              value={timeLimit}
              onChange={setTimeLimit}
              min={5} max={120} step={5}
              hint={timeHint}
            />
          </div>
        </div>

        <FormDivider />

        {/* ── SECTION 3: Question Types ─────────────────────────────── */}
        <SectionHead
          icon={<ListChecks size={18} />}
          title="أنواع الأسئلة"
          subtitle="اختر نوع أو أكثر من أنواع الأسئلة"
        />

        {isError && qTypes.length === 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#EF4444]/20">
            <AlertCircle size={14} className="text-[#EF4444] shrink-0" />
            <p className="text-xs text-[#EF4444]">اختر نوع واحد على الأقل من أنواع الأسئلة</p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          {Q_TYPES.map((t) => (
            <QuestionTypeCard
              key={t.id} type={t}
              selected={qTypes.includes(t.id)}
              onClick={() => toggleQType(t.id)}
              hasError={isError && qTypes.length === 0}
            />
          ))}
        </div>

        <FormDivider />

        {/* ── SECTION 4: Difficulty ─────────────────────────────────── */}
        <SectionHead icon={<Gauge size={18} />} title="مستوى الصعوبة" />

        {/* mix toggle */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-[#1A103D]">خليط من المستويات</p>
            <p className="text-xs text-[#9CA3AF]">تحكم في نسبة كل مستوى يدوياً</p>
          </div>
          <Toggle on={mixMode} onChange={setMixMode} />
        </div>

        {mixMode ? (
          <div className="flex flex-col gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#F0F0F0]">
            <MixSlider label="سهل"   color="#10B981" value={mixVals.easy}   onChange={(v) => setMixVals((p) => ({ ...p, easy:   v }))} />
            <MixSlider label="متوسط" color="#F59E0B" value={mixVals.medium} onChange={(v) => setMixVals((p) => ({ ...p, medium: v }))} />
            <MixSlider label="صعب"   color="#EF4444" value={mixVals.hard}   onChange={(v) => setMixVals((p) => ({ ...p, hard:   v }))} />
            <div className={cx("flex items-center justify-between text-xs px-1 pt-1 border-t border-[#E5E7EB]",
              mixOk ? "text-[#10B981]" : "text-[#EF4444]")}>
              <span>المجموع</span>
              <span className="font-bold">{mixTotal}٪ {mixOk ? "✓" : "← يجب أن يساوي ١٠٠٪"}</span>
            </div>
          </div>
        ) : (
          <DifficultyPills value={difficulty} onChange={setDiff} />
        )}

        <FormDivider />

        {/* ── SECTION 5: Advanced (collapsible) ────────────────────── */}
        <button type="button" onClick={() => setAdvanced(!advanced)}
          className="flex items-center justify-between w-full py-1 group">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-[#9CA3AF]" />
            <span className="text-sm font-semibold text-[#1A103D]">خيارات إضافية</span>
          </div>
          <div className={cx("text-[#9CA3AF] transition-transform duration-200", advanced && "rotate-180")}>
            <ChevronDown size={16} />
          </div>
        </button>

        {advanced && (
          <div className="mt-4 flex flex-col gap-4 pt-4 border-t border-[#F0F0F0]">
            {/* toggles */}
            {[
              { label: "ترتيب عشوائي للأسئلة",      val: shuffle,      set: setShuffle      },
              { label: "ترتيب عشوائي للاختيارات",    val: shuffleAns,   set: setShuffleAns   },
              { label: "تضمين شرح الإجابة الصحيحة", val: explanations, set: setExplanations,
                hint: "الذكاء الاصطناعي سيولد شرح لكل إجابة صحيحة" },
            ].map(({ label, val, set, hint }) => (
              <div key={label}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#1A103D]">{label}</span>
                  <Toggle on={val} onChange={set} />
                </div>
                {hint && <p className="text-[11px] text-[#9CA3AF] mt-1">{hint}</p>}
              </div>
            ))}

            {/* language */}
            <div>
              <p className="text-sm font-medium text-[#1A103D] mb-2.5 flex items-center gap-2">
                <Globe size={14} className="text-[#9CA3AF]" />لغة الأسئلة
              </p>
              <div className="flex gap-2">
                {([["ar","عربي"],["en","English"],["mix","خليط"]] as const).map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => setLang(val)}
                    className="flex-1 h-9 rounded-xl text-sm font-medium border transition-all duration-150"
                    style={lang === val
                      ? { background: "rgba(0,201,219,0.08)", borderColor: "#00C9DB", color: "#0CA5AB" }
                      : { background: "white", borderColor: "#E5E7EB", color: "#6B7280" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FORM ACTIONS ────────────────────────────────────────────── */}
      <div className="flex items-center justify-start gap-3 mt-5 flex-wrap">
        <button type="button"
          className="h-11 px-5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F4F4F4] transition-colors">
          إلغاء
        </button>
        <button type="button"
          disabled={isGenerating}
          className="h-12 px-8 rounded-xl text-base font-bold text-white flex items-center gap-2.5 transition-all duration-200 active:scale-[0.98] disabled:opacity-90 sm:min-w-[200px] justify-center"
          style={{
            background: "linear-gradient(135deg,#00C9DB,#0EA5E9)",
            boxShadow: "0 8px 24px -6px rgba(0,201,219,0.5)",
          }}
          onMouseEnter={(e) => !isGenerating && ((e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(0,201,219,0.6), 0 8px 24px -6px rgba(0,201,219,0.5)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px -6px rgba(0,201,219,0.5)")}>
          {isGenerating ? (
            <><Loader2 size={18} className="animate-spin" />جارٍ الإنشاء...</>
          ) : (
            <>إنشاء الاختبار</>
          )}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [frame,   setFrame]  = useState<FrameId>("default");
  const [drawer,  setDrawer] = useState(false);

  return (
    <div dir="rtl" style={{ fontFamily: "Cairo, sans-serif" }} className="flex h-screen overflow-hidden bg-[#F4F4FA]">

      {/* desktop sidebar */}
      <div className="hidden lg:flex flex-col h-full shrink-0">
        <Sidebar active="quiz" />
      </div>

      {/* mobile drawer */}
      {drawer && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="relative z-50 flex flex-col h-full">
            <Sidebar active="quiz" onClose={() => setDrawer(false)} mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenu={() => setDrawer(true)} />

        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-4xl mx-auto">

            {/* frame switcher */}
            <div className="flex gap-1 p-1 rounded-xl bg-white border border-[#E5E7EB] mb-6 overflow-x-auto"
              style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {FRAMES.map(({ id, label }) => (
                <button key={id} onClick={() => setFrame(id)}
                  className={cx("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 whitespace-nowrap",
                    frame === id ? "text-white" : "text-[#9CA3AF] hover:text-[#6B7280]")}
                  style={frame === id ? { background: "linear-gradient(135deg,#00C9DB,#0EA5E9)" } : undefined}>
                  {label}
                </button>
              ))}
            </div>

            {/* step indicator */}
            <StepIndicator active={1} />

            {/* page header */}
            <div className="flex items-start gap-3 mb-6">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)" }}>
                <BrainCircuit size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A103D] flex items-center gap-2">
                  إنشاء اختبار بالذكاء الاصطناعي
                  
                </h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  حدد إعدادات الاختبار وسيقوم الذكاء الاصطناعي بإنشاء الأسئلة تلقائياً
                </p>
              </div>
            </div>

            {/* the form */}
            <QuizForm key={frame} frame={frame} />

          </div>
        </main>
      </div>
    </div>
  );
}
