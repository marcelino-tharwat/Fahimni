import { useState, useRef } from "react";
import {
  GraduationCap, Bell, ChevronDown, LogOut, Menu,
  LayoutDashboard, BookOpen, Users, Settings, BrainCircuit, Sparkles,
  Plus, Eye, EyeOff, ChevronRight, ChevronLeft, Check,
  Pencil, Trash2, MoreVertical, GripVertical,
  CircleDot, ToggleLeft, AlignLeft, MessageSquare,
  CheckCircle, X, Loader2, ArrowUp, ArrowDown, FileText,
} from "lucide-react";

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   ATOMS
═══════════════════════════════════════════════════════════════════════════ */
function Av({ i, sz = 36 }: { i: string; sz?: number }) {
  return (
    <div className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: sz, height: sz, fontSize: sz <= 40 ? 12 : 15,
        background: "linear-gradient(135deg,#251758,#0F0A2B)", flexShrink: 0 }}>
      {i}
    </div>
  );
}

type BV = "default" | "success" | "danger" | "warning" | "info" | "cyan" | "purple";
const BC: Record<BV, { bg: string; color: string; border: string }> = {
  default:  { bg:"#F4F4F4",            color:"#6B7280", border:"#E5E7EB" },
  success:  { bg:"#ECFDF5",            color:"#10B981", border:"#A7F3D0" },
  danger:   { bg:"#FEF2F2",            color:"#EF4444", border:"#FECACA" },
  warning:  { bg:"#FFFBEB",            color:"#F59E0B", border:"#FDE68A" },
  info:     { bg:"#F0F9FF",            color:"#0EA5E9", border:"#BAE6FD" },
  cyan:     { bg:"rgba(0,201,219,.1)", color:"#00C9DB", border:"rgba(0,201,219,.3)" },
  purple:   { bg:"#F5F3FF",            color:"#7C3AED", border:"#DDD6FE" },
};
function Badge({ label, v = "default" }: { label: string; v?: BV }) {
  const c = BC[v];
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  );
}

function IconBtn({ icon, onClick, hoverBg = "hover:bg-[#F4F4F4]", hoverColor = "hover:text-[#1A103D]", color = "#9CA3AF" }:
  { icon: React.ReactNode; onClick?: () => void; hoverBg?: string; hoverColor?: string; color?: string }) {
  return (
    <button onClick={onClick}
      className={cx("w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-150", hoverBg, hoverColor)}
      style={{ color }}>
      {icon}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════════════════════ */
type QType = "mcq" | "tf" | "essay";
type Difficulty = "easy" | "medium" | "hard";
interface Option { id: string; label: string; text: string }
interface Question {
  id: number; num: string; type: QType; points: number;
  difficulty: Difficulty; text: string;
  options?: Option[]; correctId?: string;
  tfAnswer?: "true" | "false";
  explanation?: string; gradingHint?: string;
}

const DIFF_LABEL: Record<Difficulty, { label: string; v: BV }> = {
  easy:   { label: "سهل",   v: "success"  },
  medium: { label: "متوسط", v: "warning"  },
  hard:   { label: "صعب",   v: "danger"   },
};
const TYPE_LABEL: Record<QType, string> = {
  mcq:   "اختيار من متعدد",
  tf:    "صح أم خطأ",
  essay: "إجابة قصيرة",
};
const LETTER = ["أ","ب","ج","د","هـ","و"];

const INITIAL_QUESTIONS: Question[] = [
  {
    id:1, num:"١", type:"mcq", points:3, difficulty:"medium",
    text:"ما هو الرمز الكيميائي لعنصر الصوديوم؟",
    options:[
      { id:"a", label:"أ", text:"Na"  },
      { id:"b", label:"ب", text:"K"   },
      { id:"c", label:"ج", text:"Ca"  },
      { id:"d", label:"د", text:"Mg"  },
    ],
    correctId:"a",
    explanation:"الصوديوم عنصر فلزي رمزه Na من الاسم اللاتيني Natrium.",
  },
  {
    id:2, num:"٢", type:"mcq", points:3, difficulty:"hard",
    text:"أي من التالي يمثل حمضاً قوياً؟",
    options:[
      { id:"a", label:"أ", text:"CH₃COOH" },
      { id:"b", label:"ب", text:"HCl"      },
      { id:"c", label:"ج", text:"NaOH"     },
      { id:"d", label:"د", text:"H₂O"      },
    ],
    correctId:"b",
  },
  {
    id:3, num:"٣", type:"mcq", points:3, difficulty:"medium",
    text:"ما هي الصيغة الكيميائية لثاني أكسيد الكربون؟",
    options:[
      { id:"a", label:"أ", text:"CO"   },
      { id:"b", label:"ب", text:"CO₂"  },
      { id:"c", label:"ج", text:"C₂O"  },
      { id:"d", label:"د", text:"CO₃"  },
    ],
    correctId:"b",
    explanation:"ثاني أكسيد الكربون يتكون من ذرة كربون واحدة وذرتَي أكسجين.",
  },
  {
    id:4, num:"٤", type:"tf", points:2, difficulty:"easy",
    text:"الماء مركب يتكون من ذرتي هيدروجين وذرة أكسجين",
    tfAnswer:"true",
  },
  {
    id:5, num:"٥", type:"essay", points:5, difficulty:"hard",
    text:"اشرح عملية التحليل الكهربائي للماء وما هي نواتجها",
    gradingHint:"يجب أن يذكر الطالب فصل الماء إلى هيدروجين وأكسجين باستخدام تيار كهربائي، مع ذكر القطبين.",
  },
];

/* ═══════════════════════════════════════════════════════════════════════════
   STEP INDICATOR
═══════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  { num:"١", label:"إعداد الاختبار" },
  { num:"٢", label:"مراجعة الأسئلة" },
  { num:"٣", label:"نشر الاختبار"   },
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
              <div className={cx("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                (done || current) ? "text-white" : "bg-[#F0F0F0] text-[#C4C9D0]")}
                style={done ? { background:"#10B981" } : current ? { background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" } : undefined}>
                {done ? <Check size={14}/> : num}
              </div>
              <span className={cx("text-xs font-medium whitespace-nowrap hidden sm:block",
                current ? "text-[#00C9DB] font-bold" : done ? "text-[#10B981]" : "text-[#C4C9D0]")}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div className="w-20 sm:w-32 h-0.5 mt-4 mx-2 transition-all"
                style={{ background: done ? "#00C9DB" : "#E5E7EB" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR
═══════════════════════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard", icon:<LayoutDashboard size={18}/>, label:"لوحة التحكم"   },
  { id:"content",   icon:<BookOpen size={18}/>,        label:"إدارة المحتوى" },
  { id:"quiz",      icon:<BrainCircuit size={18}/>,    label:"إنشاء اختبار"  },
  { id:"students",  icon:<Users size={18}/>,           label:"الطلاب"         },
  { id:"settings",  icon:<Settings size={18}/>,        label:"الإعدادات"      },
];
function Sidebar({ mobile=false, onClose }: { mobile?: boolean; onClose?: () => void }) {
  return (
    <aside className="flex flex-col h-full" style={{ width:260, background:"#0F0A2B" }}>
      <div className="flex items-center justify-between px-5 py-5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
            <GraduationCap size={19} className="text-white"/>
          </div>
          <span className="text-xl font-extrabold text-white">فهّمني</span>
        </div>
        {mobile && <button onClick={onClose} className="text-white/50 hover:text-white"><X size={18}/></button>}
      </div>
      <div className="mx-4 h-px bg-white/10 mb-3"/>
      <div className="mx-3 mb-4 flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
        <Av i="أم" sz={32}/>
        <div><p className="text-xs font-semibold text-white truncate">أ. محمد أحمد</p>
          <p className="text-[10px] text-white/40">مدرس كيمياء</p></div>
      </div>
      <nav className="flex flex-col gap-1 px-3 flex-1 overflow-y-auto">
        {NAV.map(n => {
          const active = n.id === "quiz";
          return (
            <div key={n.id} onClick={() => mobile && onClose?.()}
              className={cx("flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all",
                active ? "text-white" : "text-[#E0DEEF]/60 hover:bg-white/08 hover:text-[#E0DEEF]")}
              style={active ? { background:"#00C9DB" } : undefined}>
              <span className={active ? "text-white" : "text-[#E0DEEF]/40"}>{n.icon}</span>
              {n.label}
            </div>
          );
        })}
      </nav>
      <div className="px-3 pb-5 shrink-0">
        <div className="h-px bg-white/10 mb-3"/>
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-[#EF4444]/70 hover:bg-[#EF4444]/10 hover:text-[#EF4444] transition-all cursor-pointer">
          <LogOut size={18}/>تسجيل الخروج
        </div>
      </div>
    </aside>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TOPBAR
═══════════════════════════════════════════════════════════════════════════ */
function Topbar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center gap-4 px-5 shrink-0"
      style={{ boxShadow:"0 1px 0 #E5E7EB" }}>
      <button onClick={onMenu} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4]">
        <Menu size={20}/>
      </button>
      <div className="flex items-center gap-2.5">
        <h1 className="text-[22px] font-bold text-[#1A103D]">إنشاء اختبار</h1>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background:"rgba(0,201,219,0.1)", border:"1px solid rgba(0,201,219,0.2)" }}>
          <Sparkles size={12} style={{ color:"#00C9DB" }}/>
          <span className="text-[11px] font-semibold" style={{ color:"#00C9DB" }}>AI</span>
        </div>
      </div>
      <div className="flex-1"/>
      <button className="relative w-9 h-9 flex items-center justify-center rounded-xl text-[#6B7280] hover:bg-[#F4F4F4] shrink-0">
        <Bell size={18}/>
        <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-[#00C9DB] border-2 border-white"/>
      </button>
      <div className="flex items-center gap-2.5 ps-3 border-s border-[#E5E7EB] shrink-0">
        <Av i="أم" sz={34}/>
        <div className="hidden sm:block text-end">
          <p className="text-sm font-semibold text-[#1A103D] leading-none">أ. محمد أحمد</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">مدرس كيمياء</p>
        </div>
        <ChevronDown size={14} className="text-[#9CA3AF]"/>
      </div>
    </header>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION CARD — VIEW MODE
═══════════════════════════════════════════════════════════════════════════ */
function QuestionCard({ q, idx, total, onEdit, onDelete, onMoveUp, onMoveDown, dragging = false, dropZone = false, mobile = false }:
  { q: Question; idx: number; total: number; onEdit: () => void; onDelete: () => void;
    onMoveUp: () => void; onMoveDown: () => void; dragging?: boolean; dropZone?: boolean; mobile?: boolean }) {

  const diff = DIFF_LABEL[q.difficulty];

  return (
    <>
      {/* drop zone above if dragging */}
      {dropZone && (
        <div className="h-20 rounded-[14px] border-2 border-dashed flex items-center justify-center text-sm"
          style={{ borderColor:"#00C9DB", background:"rgba(0,201,219,0.04)", color:"#00C9DB" }}>
          اسحب السؤال هنا
        </div>
      )}

      <div className={cx("bg-white rounded-[14px] border border-[#E5E7EB] overflow-hidden transition-all duration-200")}
        style={{
          boxShadow: dragging ? "0 12px 32px rgba(0,0,0,0.18)" : "0 2px 12px rgba(0,0,0,0.06)",
          transform: dragging ? "scale(1.015)" : "none",
          border: dragging ? "2px solid rgba(0,201,219,0.5)" : "1px solid #E5E7EB",
          opacity: dragging ? 0.96 : 1,
          zIndex: dragging ? 10 : 1,
          position: "relative",
        }}>

        {/* card header */}
        <div className="flex items-center gap-2.5 px-5 py-3 border-b border-[#E5E7EB]"
          style={{ background:"#F9FAFB" }}>
          {/* drag handle */}
          {mobile ? (
            <div className="flex gap-1 me-1">
              <button onClick={onMoveUp} disabled={idx === 0}
                className="w-6 h-6 flex items-center justify-center rounded text-[#9CA3AF] hover:text-[#6B7280] disabled:opacity-30">
                <ArrowUp size={12}/>
              </button>
              <button onClick={onMoveDown} disabled={idx === total - 1}
                className="w-6 h-6 flex items-center justify-center rounded text-[#9CA3AF] hover:text-[#6B7280] disabled:opacity-30">
                <ArrowDown size={12}/>
              </button>
            </div>
          ) : (
            <GripVertical size={15} className="text-[#C4C9D0] cursor-grab shrink-0"/>
          )}

          <span className="text-sm font-semibold text-[#1A103D] shrink-0">سؤال {q.num}</span>
          <Badge label={TYPE_LABEL[q.type]}/>
          <Badge label={diff.label} v={diff.v}/>
          <span className="text-xs text-[#9CA3AF]">{q.points} نقاط</span>

          <div className="ms-auto flex items-center gap-1">
            <IconBtn icon={<Pencil size={14}/>} onClick={onEdit}
              hoverBg="hover:bg-[#F0FDFE]" hoverColor="hover:text-[#00C9DB]"/>
            <IconBtn icon={<Trash2 size={14}/>} onClick={onDelete}
              hoverBg="hover:bg-[#FEF2F2]" hoverColor="hover:text-[#EF4444]"/>
            <IconBtn icon={<MoreVertical size={14}/>}/>
          </div>
        </div>

        {/* card body */}
        <div className="px-5 py-4">
          <p className="text-sm text-[#1A103D] leading-relaxed mb-3">{q.text}</p>

          {/* MCQ options */}
          {q.type === "mcq" && q.options && (
            <div className="flex flex-col gap-1.5">
              {q.options.map(opt => {
                const correct = opt.id === q.correctId;
                return (
                  <div key={opt.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm"
                    style={{
                      background: correct ? "#ECFDF5" : "#FAFAFA",
                      borderColor: correct ? "#A7F3D0" : "#F0F0F0",
                      color: correct ? "#059669" : "#6B7280",
                    }}>
                    {correct && <CheckCircle size={13} style={{ color:"#10B981" }} className="shrink-0"/>}
                    {!correct && <div className="w-3.5 h-3.5 rounded-full border border-[#E5E7EB] shrink-0"/>}
                    <span className="font-semibold shrink-0">{opt.label})</span>
                    <span className={correct ? "font-semibold" : ""}>{opt.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* TF */}
          {q.type === "tf" && (
            <div className="flex gap-2 mt-1">
              {[{ val:"true", label:"صح ✓" }, { val:"false", label:"خطأ ✗" }].map(btn => {
                const correct = q.tfAnswer === btn.val;
                return (
                  <div key={btn.val}
                    className="px-5 py-2 rounded-full border text-sm font-semibold"
                    style={{
                      background: correct ? "#ECFDF5" : "#FAFAFA",
                      borderColor: correct ? "#A7F3D0" : "#E5E7EB",
                      color: correct ? "#059669" : "#9CA3AF",
                    }}>
                    {btn.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Essay grading hint */}
          {q.type === "essay" && q.gradingHint && (
            <div className="mt-3 px-3 py-2.5 rounded-xl"
              style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
              <p className="text-xs" style={{ color:"#1E40AF" }}>
                📝 إرشادات التصحيح: {q.gradingHint}
              </p>
            </div>
          )}
          {q.type === "essay" && (
            <p className="text-[11px] mt-2" style={{ color:"#9CA3AF" }}>
              الحد الأقصى: ٢٠٠٠ حرف
            </p>
          )}

          {/* Explanation */}
          {q.explanation && (
            <div className="mt-3 px-3 py-2.5 rounded-xl"
              style={{ background:"#F5F3FF", border:"1px solid #DDD6FE" }}>
              <p className="text-xs" style={{ color:"#7C3AED" }}>
                💡 الشرح: {q.explanation}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EDIT / ADD MODAL
═══════════════════════════════════════════════════════════════════════════ */
const TYPE_OPTIONS = [
  { type:"mcq"   as QType, icon:<CircleDot size={16}/>,    label:"اختيار من متعدد" },
  { type:"tf"    as QType, icon:<ToggleLeft size={16}/>,   label:"صح أم خطأ"      },
  { type:"essay" as QType, icon:<MessageSquare size={16}/>,label:"إجابة قصيرة"    },
];

function EditModal({ question, isNew = false, onClose, onSave }:
  { question: Question | null; isNew?: boolean; onClose: () => void; onSave: () => void }) {
  const q = question;
  const [selectedType, setSelectedType] = useState<QType>(q?.type ?? "mcq");
  const [options, setOptions] = useState<{ id:string; label:string; text:string }[]>(
    q?.options ?? [
      { id:"a", label:"أ", text:"" },
      { id:"b", label:"ب", text:"" },
      { id:"c", label:"ج", text:"" },
      { id:"d", label:"د", text:"" },
    ]
  );
  const [correctId, setCorrectId] = useState(q?.correctId ?? "a");

  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-[20px] w-full max-w-[640px] z-10 flex flex-col overflow-hidden"
        style={{ boxShadow:"0 8px 24px rgba(0,0,0,0.12)", maxHeight:"85vh" }}>

        {/* modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] shrink-0"
          style={{ background:"#F9FAFB" }}>
          <h3 className="text-lg font-semibold text-[#1A103D]">
            {isNew ? "إضافة سؤال جديد" : "تعديل السؤال"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-[#F0F0F0]">
            <X size={16}/>
          </button>
        </div>

        {/* modal body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* type selector (add only) */}
          {isNew && (
            <div>
              <label className="text-sm font-medium text-[#1A103D] block mb-2">نوع السؤال</label>
              <div className="flex gap-2 flex-wrap">
                {TYPE_OPTIONS.map(({ type, icon, label }) => {
                  const sel = selectedType === type;
                  return (
                    <button key={type} onClick={() => setSelectedType(type)}
                      className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border-2 text-xs font-medium transition-all duration-150 min-w-[90px]"
                      style={{
                        background: sel ? "rgba(0,201,219,0.07)" : "white",
                        borderColor: sel ? "#00C9DB" : "#E5E7EB",
                        color: sel ? "#00C9DB" : "#6B7280",
                      }}>
                      {icon}{label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* if edit: show type badge */}
          {!isNew && q && (
            <div className="flex items-center gap-2">
              <Badge label={TYPE_LABEL[q.type]}/>
              <span className="text-xs text-[#9CA3AF]">(لا يمكن تغيير النوع)</span>
            </div>
          )}

          {/* question text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A103D]">نص السؤال</label>
            <textarea
              defaultValue={q?.text ?? ""}
              dir="auto"
              placeholder="اكتب نص السؤال هنا..."
              className="px-3.5 py-3 border border-[#E5E7EB] rounded-[10px] text-sm text-[#1A103D] placeholder:text-[#9CA3AF] outline-none resize-none focus:border-[#00C9DB] focus:ring-2 focus:ring-[#00C9DB]/15 transition-all"
              style={{ minHeight:80 }}
            />
            <p className="text-[11px] text-[#9CA3AF]">يمكنك تعديل صياغة السؤال</p>
          </div>

          {/* points */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1A103D]">النقاط</label>
              <input type="number" defaultValue={q?.points ?? 3} min={1} max={20}
                className="w-24 h-12 px-3 border border-[#E5E7EB] rounded-[10px] text-sm font-bold text-center text-[#1A103D] outline-none focus:border-[#00C9DB] transition-all"/>
            </div>
          </div>

          {/* MCQ options */}
          {(selectedType === "mcq" || (!isNew && q?.type === "mcq")) && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#1A103D]">الاختيارات</label>
              {options.map((opt, i) => {
                const isCorrect = opt.id === correctId;
                return (
                  <div key={opt.id} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all"
                    style={{ background: isCorrect ? "#F0FDFB" : "#FAFAFA", borderColor: isCorrect ? "#A7F3D0" : "#E5E7EB" }}>
                    {/* radio */}
                    <button onClick={() => setCorrectId(opt.id)}
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                      style={{ borderColor: isCorrect ? "#00C9DB" : "#D1D5DB" }}>
                      {isCorrect && <div className="w-2.5 h-2.5 rounded-full" style={{ background:"#00C9DB" }}/>}
                    </button>
                    <span className="text-xs font-bold shrink-0" style={{ color: isCorrect ? "#059669" : "#9CA3AF" }}>
                      {LETTER[i]})
                    </span>
                    <input defaultValue={opt.text || (isNew ? "" : opt.text)} placeholder={`اكتب الاختيار ${LETTER[i]}`}
                      className="flex-1 h-10 px-2 bg-transparent outline-none text-sm text-[#1A103D] placeholder:text-[#9CA3AF]"
                      onChange={e => setOptions(prev => prev.map((o,j) => j===i ? {...o, text:e.target.value} : o))}
                    />
                    {options.length > 2 && (
                      <button onClick={() => setOptions(prev => prev.filter((_,j) => j !== i))}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-all shrink-0">
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                );
              })}
              {options.length < 6 && (
                <button
                  onClick={() => setOptions(prev => [...prev, { id:String.fromCharCode(97+prev.length), label:LETTER[prev.length], text:"" }])}
                  className="flex items-center gap-1.5 text-xs font-medium mt-1 transition-opacity hover:opacity-70"
                  style={{ color:"#00C9DB" }}>
                  <Plus size={13}/>إضافة اختيار
                </button>
              )}
            </div>
          )}

          {/* TF */}
          {(selectedType === "tf" || (!isNew && q?.type === "tf")) && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-[#1A103D]">الإجابة الصحيحة</label>
              <div className="flex gap-3">
                {[{ v:"true", l:"صح" }, { v:"false", l:"خطأ" }].map(btn => {
                  const sel = (q?.tfAnswer ?? "true") === btn.v;
                  return (
                    <button key={btn.v} className="px-6 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all"
                      style={{
                        background: sel ? "rgba(0,201,219,0.07)" : "white",
                        borderColor: sel ? "#00C9DB" : "#E5E7EB",
                        color: sel ? "#00C9DB" : "#6B7280",
                      }}>
                      {btn.l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Essay grading hint */}
          {(selectedType === "essay" || (!isNew && q?.type === "essay")) && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A103D]">إرشادات التصحيح <span className="text-[#9CA3AF] font-normal">(اختياري)</span></label>
                <textarea defaultValue={q?.gradingHint ?? ""} dir="auto"
                  placeholder="أضف ملاحظات تساعد في تصحيح هذا السؤال..."
                  className="px-3.5 py-3 border border-[#E5E7EB] rounded-[10px] text-sm text-[#1A103D] placeholder:text-[#9CA3AF] outline-none resize-none focus:border-[#00C9DB] focus:ring-2 focus:ring-[#00C9DB]/15 transition-all"
                  style={{ minHeight:72 }}/>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#1A103D]">الحد الأقصى للإجابة</label>
                <input type="number" defaultValue={2000}
                  className="w-28 h-12 px-3 border border-[#E5E7EB] rounded-[10px] text-sm font-bold text-center text-[#1A103D] outline-none focus:border-[#00C9DB] transition-all"/>
              </div>
            </>
          )}

          {/* explanation */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#1A103D]">شرح الإجابة <span className="text-[#9CA3AF] font-normal">(اختياري)</span></label>
            <textarea defaultValue={q?.explanation ?? ""} dir="auto"
              placeholder="أضف شرحاً يظهر للطالب بعد حل الاختبار..."
              className="px-3.5 py-3 border border-[#E5E7EB] rounded-[10px] text-sm text-[#1A103D] placeholder:text-[#9CA3AF] outline-none resize-none focus:border-[#00C9DB] focus:ring-2 focus:ring-[#00C9DB]/15 transition-all"
              style={{ minHeight:64 }}/>
          </div>
        </div>

        {/* modal footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#E5E7EB] shrink-0">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#1A103D] transition-colors">
            إلغاء
          </button>
          <button onClick={onSave}
            className="h-10 px-6 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]"
            style={{ background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
            {isNew ? "إضافة السؤال" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE DIALOG
═══════════════════════════════════════════════════════════════════════════ */
function DeleteDialog({ question, total, onDelete, onClose }:
  { question: Question; total: number; onDelete: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-[20px] w-full max-w-sm p-6 z-10 flex flex-col items-center text-center gap-4"
        style={{ boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background:"#FEF2F2" }}>
          <Trash2 size={28} style={{ color:"#EF4444" }}/>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#1A103D]">حذف السؤال؟</h3>
          <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
            هل أنت متأكد من حذف "{question.text.slice(0,40)}..."؟ لا يمكن التراجع.
          </p>
          <p className="text-xs mt-2" style={{ color:"#9CA3AF" }}>
            سيصبح عدد الأسئلة {total - 1} بدلاً من {total}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <button onClick={onDelete}
            className="w-full h-11 rounded-xl text-sm font-bold text-white"
            style={{ background:"linear-gradient(135deg,#EF4444,#DC2626)" }}>
            حذف
          </button>
          <button onClick={onClose}
            className="w-full h-10 rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#1A103D] transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EMPTY STATE
═══════════════════════════════════════════════════════════════════════════ */
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[#F4F4F4]">
        <FileText size={28} style={{ color:"#C4C9D0" }}/>
      </div>
      <div>
        <p className="text-base font-semibold text-[#1A103D]">لا توجد أسئلة</p>
        <p className="text-sm text-[#9CA3AF] mt-1 leading-relaxed max-w-xs mx-auto">
          أضف أسئلة يدوياً أو ارجع للخطوة الأولى لإعادة التوليد
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onAdd}
          className="h-10 px-5 rounded-xl text-sm font-bold text-white flex items-center gap-2"
          style={{ background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
          <Plus size={15}/>إضافة سؤال
        </button>
        <button className="h-10 px-5 rounded-xl text-sm font-semibold border border-[#E5E7EB] text-[#6B7280] hover:border-[#00C9DB] hover:text-[#00C9DB] transition-all">
          إعادة التوليد
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   REVIEW PAGE
═══════════════════════════════════════════════════════════════════════════ */
type FrameId = "review" | "edit-modal" | "add-modal" | "delete-dialog" | "drag-state" | "empty" | "mobile";

function ReviewPage({ frame }: { frame: FrameId }) {
  const [questions, setQuestions] = useState<Question[]>(
    frame === "empty" ? [] : INITIAL_QUESTIONS
  );
  const [typeFilter, setTypeFilter] = useState<QType | "all">("all");
  const [editQ, setEditQ]   = useState<Question | null>(null);
  const [deleteQ, setDeleteQ] = useState<Question | null>(null);
  const [showAdd, setShowAdd] = useState(frame === "add-modal");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mobile = frame === "mobile";

  // pre-open modals based on frame
  const showEditModal   = frame === "edit-modal"   || !!editQ;
  const showDeleteDlg   = frame === "delete-dialog" || !!deleteQ;
  const showAddModal    = showAdd;
  const dragIdx         = frame === "drag-state" ? 2 : -1;

  const filtered = typeFilter === "all" ? questions : questions.filter(q => q.type === typeFilter);
  const totalPts = questions.reduce((a,q) => a + q.points, 0);

  function moveUp(idx: number) {
    if (idx === 0) return;
    setQuestions(prev => { const next = [...prev]; [next[idx-1], next[idx]] = [next[idx], next[idx-1]]; return next; });
  }
  function moveDown(idx: number) {
    setQuestions(prev => { if (idx >= prev.length-1) return prev; const next = [...prev]; [next[idx], next[idx+1]] = [next[idx+1], next[idx]]; return next; });
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background:"#F4F4FA" }}>
      {!mobile && <div className="hidden lg:flex flex-col h-full shrink-0"><Sidebar/></div>}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)}/>
          <div className="relative z-50 flex flex-col h-full"><Sidebar mobile onClose={() => setDrawerOpen(false)}/></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar onMenu={() => setDrawerOpen(true)}/>
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-28">
          <div className="max-w-4xl mx-auto flex flex-col gap-5">

            {/* step indicator */}
            <StepIndicator active={2}/>

            {/* page header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1A103D]">مراجعة الأسئلة</h2>
                <p className="text-sm text-[#6B7280] mt-0.5">
                  راجع الأسئلة المولدة وعدّل أو احذف أو أعد ترتيبها حسب حاجتك
                </p>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  اختبار الباب الأول: الكيمياء العضوية • تالتة ثانوي • متوسط
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge label={`${questions.length} سؤال`} v="cyan"/>
                <Badge label={`${totalPts} نقطة`} v="purple"/>
              </div>
            </div>

            {/* toolbar */}
            <div className="bg-white rounded-[14px] border border-[#E5E7EB] px-4 py-3 flex items-center gap-3 flex-wrap"
              style={{ boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <button onClick={() => setShowAdd(true)}
                className="h-9 px-3.5 rounded-xl border-2 text-sm font-semibold flex items-center gap-1.5 transition-all"
                style={{ borderColor:"#00C9DB", color:"#00C9DB" }}>
                <Plus size={15}/>إضافة سؤال
              </button>

              {/* type filter pills */}
              <div className="flex gap-1.5 flex-wrap">
                {([["all","الكل"], ["mcq","اختيار من متعدد"], ["tf","صح/خطأ"], ["essay","إجابة قصيرة"]] as const).map(([val, lbl]) => {
                  const active = typeFilter === val;
                  return (
                    <button key={val} onClick={() => setTypeFilter(val as typeof typeFilter)}
                      className="px-3 py-1 rounded-full border text-xs font-medium transition-all"
                      style={{
                        background: active ? "rgba(0,201,219,0.07)" : "white",
                        borderColor: active ? "rgba(0,201,219,0.4)" : "#E5E7EB",
                        color: active ? "#00C9DB" : "#9CA3AF",
                      }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>

              <div className="ms-auto flex gap-2">
                <button className="h-9 px-3 rounded-xl text-xs font-medium text-[#6B7280] hover:bg-[#F4F4F4] transition-colors">
                  حفظ كمسودة
                </button>
                <button className="h-9 px-3 rounded-xl text-xs font-medium text-[#6B7280] flex items-center gap-1.5 hover:bg-[#F4F4F4] transition-colors">
                  <EyeOff size={13}/>طي الكل
                </button>
              </div>
            </div>

            {/* question list */}
            {filtered.length === 0 && questions.length === 0 ? (
              <div className="bg-white rounded-[14px] border border-[#E5E7EB]"
                style={{ boxShadow:"0 2px 12px rgba(0,0,0,0.06)" }}>
                <EmptyState onAdd={() => setShowAdd(true)}/>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {filtered.map((q, i) => (
                  <QuestionCard
                    key={q.id} q={q} idx={i} total={filtered.length}
                    onEdit={() => setEditQ(q)}
                    onDelete={() => setDeleteQ(q)}
                    onMoveUp={() => moveUp(i)}
                    onMoveDown={() => moveDown(i)}
                    dragging={dragIdx === i}
                    dropZone={dragIdx !== -1 && i === dragIdx + 1}
                    mobile={mobile}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* sticky bottom nav */}
        <div className="bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 shrink-0 flex-wrap"
          style={{ boxShadow:"0 -2px 12px rgba(0,0,0,0.06)" }}>
          <button className="flex items-center gap-1.5 text-sm font-medium text-[#6B7280] hover:text-[#1A103D] transition-colors">
            <ChevronRight size={15}/>الرجوع للخطوة الأولى
          </button>
          <button
            disabled={questions.length === 0}
            className={cx("flex items-center gap-1.5 h-11 px-6 rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97]",
              questions.length === 0 && "opacity-50 cursor-not-allowed")}
            style={{ background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
            المتابعة ({questions.length} سؤال)
            <ChevronLeft size={15}/>
          </button>
        </div>
      </div>

      {/* modals */}
      {showEditModal && (
        <EditModal
          question={editQ ?? INITIAL_QUESTIONS[0]}
          isNew={false}
          onClose={() => setEditQ(null)}
          onSave={() => setEditQ(null)}
        />
      )}
      {showAddModal && (
        <EditModal
          question={null}
          isNew
          onClose={() => setShowAdd(false)}
          onSave={() => setShowAdd(false)}
        />
      )}
      {showDeleteDlg && (
        <DeleteDialog
          question={deleteQ ?? INITIAL_QUESTIONS[0]}
          total={questions.length}
          onDelete={() => { setQuestions(prev => prev.filter(q => q.id !== (deleteQ?.id ?? INITIAL_QUESTIONS[0].id))); setDeleteQ(null); }}
          onClose={() => setDeleteQ(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   APP
═══════════════════════════════════════════════════════════════════════════ */
const FRAMES: { id: FrameId; label: string }[] = [
  { id:"review",        label:"١ — مراجعة الأسئلة" },
  { id:"edit-modal",    label:"٢ — تعديل سؤال"     },
  { id:"add-modal",     label:"٣ — إضافة سؤال"     },
  { id:"delete-dialog", label:"٤ — حذف سؤال"       },
  { id:"drag-state",    label:"٥ — إعادة الترتيب"  },
  { id:"empty",         label:"٦ — فارغ"            },
  { id:"mobile",        label:"٧ — موبايل"          },
];

export default function App() {
  const [frame, setFrame] = useState<FrameId>("review");
  return (
    <div dir="rtl" style={{ fontFamily:"Cairo, sans-serif", height:"100vh", display:"flex", flexDirection:"column" }}>
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 flex-wrap"
        style={{ background:"#0F0A2B", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white"
            style={{ background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" }}>
            <BrainCircuit size={13}/>
          </div>
          <span className="text-xs font-extrabold text-white">فهّمني</span>
          <span className="text-white/30 mx-1">·</span>
          <span className="text-xs text-white/50">مراجعة الأسئلة — الخطوة ٢</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {FRAMES.map(({ id, label }) => {
            const active = frame === id;
            return (
              <button key={id} onClick={() => setFrame(id)}
                className={cx("px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap",
                  active ? "text-white" : "text-white/50 hover:text-white/80")}
                style={active ? { background:"linear-gradient(135deg,#00C9DB,#0EA5E9)" } : undefined}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ReviewPage key={frame} frame={frame}/>
      </div>
    </div>
  );
}
