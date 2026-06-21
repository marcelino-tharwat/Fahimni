// src/features/auth/pages/AuthPage.tsx
import { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  GraduationCap, User, Mail, Phone, Lock, Eye, EyeOff,
  type LucideIcon,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/shared/store/hooks";
import {
  login as loginThunk,
  register as registerThunk,
  dashboardPathByRole,
  normalizeRole,
} from "@/features/auth/store/authSlice";

type Mode = "login" | "register";
type TFn = (key: string) => string;

/* ------------------------------ schemas ------------------------------ */

const makeLoginSchema = (t: TFn) =>
  z.object({
    email: z.string().min(1, t("auth:errEmailRequired")).email(t("auth:errEmailInvalid")),
    password: z.string().min(1, t("auth:errPasswordRequired")),
    remember: z.boolean().optional(),
  });

// نفس موديل الـ User: fullName + email + mobile + password
// (role=STUDENT و status=ACTIVE بيحطّهم الـ backend افتراضيًا)
const makeRegisterSchema = (t: TFn) =>
  z.object({
    fullName: z.string().min(3, t("auth:errNameMin")),
    email: z.string().min(1, t("auth:errEmailRequired")).email(t("auth:errEmailInvalid")),
    mobile: z.string().regex(/^01[0125][0-9]{8}$/, t("auth:errMobileInvalid")),
    password: z.string().min(8, t("auth:errPasswordMin")),
  });

type LoginValues = { email: string; password: string; remember?: boolean };
type RegisterValues = { fullName: string; email: string; mobile: string; password: string };

/* ------------------------------- field ------------------------------- */

function Field({
  icon: Icon,
  label,
  error,
  registration,
  trailing,
  ...props
}: {
  icon: LucideIcon;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  trailing?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  return (
    <div className="mb-[18px]">
      <label className="mb-2 block text-sm font-semibold text-text-primary">{label}</label>
      {/* Flex row: leading icon → gap → input → optional trailing (eye) toggle.
          The row inherits the page direction, so the icon lands on the start
          side (right in RTL, left in LTR) and the eye toggle on the opposite
          edge — no absolute positioning, no big gap. */}
      <div className="flex h-[50px] items-center gap-2 rounded-xl border border-border bg-[#F6F6FB] px-4 transition focus-within:border-accent focus-within:bg-white focus-within:ring-4 focus-within:ring-accent/10">
        <span className="shrink-0 text-[#9AA0AE]">
          <Icon size={19} strokeWidth={2} />
        </span>
        <input
          {...registration}
          {...props}
          dir={isRtl ? "rtl" : "ltr"}
          className="min-w-0 flex-1 bg-transparent text-start text-sm text-text-primary outline-none placeholder:text-[#9CA3AF]"
        />
        {trailing && <span className="flex shrink-0">{trailing}</span>}
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}

/* ----------------------------- google icon --------------------------- */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19">
      <path fill="#4285F4" d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.8z" />
      <path fill="#34A853" d="M12 23c2.9 0 5.3-1 7.1-2.6l-3.6-2.7c-1 .7-2.3 1.1-3.5 1.1-2.7 0-5-1.8-5.8-4.3H2.5v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M6.2 14.5a6.6 6.6 0 0 1 0-4.2V7.5H2.5a11 11 0 0 0 0 9.8z" />
      <path fill="#EA4335" d="M12 5.5c1.5 0 2.9.5 4 1.5l3-3A11 11 0 0 0 2.5 7.5l3.7 2.8C7 7.8 9.3 5.5 12 5.5z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

/* ------------------------------- page -------------------------------- */

export function AuthPage() {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState<Mode>("login");
  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen bg-background">
      {/* ===== جهة الفورم (يمين في RTL) ===== */}
      <div className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[440px] rounded-3xl bg-surface p-7 shadow-[0_30px_60px_-20px_rgba(26,16,61,.2)] sm:p-8">
          <div className="mb-6 flex border-b border-border">
            <TabButton active={isLogin} onClick={() => setMode("login")}>
              {t("auth:loginTab")}
            </TabButton>
            <TabButton active={!isLogin} onClick={() => setMode("register")}>
              {t("auth:registerTab")}
            </TabButton>
          </div>

          {isLogin ? (
            <LoginForm key={`login-${i18n.language}`} />
          ) : (
            <RegisterForm key={`register-${i18n.language}`} />
          )}

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-text-secondary">{t("auth:orLoginWith")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex gap-3">
            <SocialButton onClick={() => {}}>
              <FacebookIcon />
              {t("auth:facebook")}
            </SocialButton>
            <SocialButton onClick={() => {}}>
              <GoogleIcon />
              {t("auth:google")}
            </SocialButton>
          </div>
        </div>
      </div>

      {/* ===== جهة الهوية (يسار، مخفية على الموبايل) ===== */}
      <aside className="relative hidden w-[42%] flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1d1145] via-[#2a1758] to-[#3d2170] text-white lg:flex">
        <span className="pointer-events-none absolute -right-16 top-[8%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <span className="pointer-events-none absolute -left-20 bottom-[-10%] h-80 w-80 rounded-full bg-info/30 blur-3xl" />

        <div className="relative z-10 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-white/10">
            <GraduationCap size={48} strokeWidth={1.6} />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold">{t("auth:brandName")}</h2>
          <p className="mt-2.5 text-[15px] font-medium text-accent/90">{t("auth:tagline")}</p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white/85">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {t("auth:activeStudents")}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ----------------------------- subparts ------------------------------ */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex-1 border-b-2 py-3 text-[15px] font-bold transition ${
        active ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function SocialButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-sm font-semibold text-text-primary transition hover:bg-background"
    >
      {children}
    </button>
  );
}
function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-[50px] w-full rounded-xl bg-gradient-to-l from-accent to-[#26D6E6] text-base font-extrabold text-white shadow-[0_14px_26px_-10px_rgba(0,201,219,.6)] transition hover:brightness-[.97] disabled:opacity-60"
    >
      {loading ? "..." : children}
    </button>
  );
}

/* ---------------------------- login form ----------------------------- */

function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [show, setShow] = useState(false);

  const status = useAppSelector((s) => s.auth.status);
  const serverError = useAppSelector((s) => s.auth.error);
  const loading = status === "loading";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(makeLoginSchema(t)),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = (v: LoginValues) => {
    dispatch(loginThunk({ email: v.email, password: v.password, remember: v.remember }))
      .unwrap()
      .then((data) => navigate(dashboardPathByRole[normalizeRole(data.user.role)]))
      .catch(() => {}); // الخطأ متخزّن في الـ slice وبيتعرض تحت
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field
        icon={Mail}
        label={t("auth:email")}
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        registration={register("email")}
      />
      <Field
        icon={Lock}
        label={t("auth:password")}
        type={show ? "text" : "password"}
        autoComplete="current-password"
        placeholder="••••••••"
        error={errors.password?.message}
        registration={register("password")}
        trailing={
          <button type="button" onClick={() => setShow((s) => !s)} className="flex text-[#9AA0AE]">
            {show ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        }
      />

      <div className="mb-5 mt-1 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" {...register("remember")} className="h-4 w-4 rounded border-border accent-accent" />
          {t("auth:rememberMe")}
        </label>
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="text-sm font-semibold text-accent hover:underline"
        >
          {t("auth:forgotPassword")}
        </button>
      </div>

      {serverError && <p className="mb-3 text-center text-sm text-danger">{serverError}</p>}

      <SubmitButton loading={loading}>{t("auth:loginButton")}</SubmitButton>
    </form>
  );
}

/* --------------------------- register form --------------------------- */

function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [show, setShow] = useState(false);

  const status = useAppSelector((s) => s.auth.status);
  const serverError = useAppSelector((s) => s.auth.error);
  const loading = status === "loading";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(makeRegisterSchema(t)),
    defaultValues: { fullName: "", email: "", mobile: "", password: "" },
  });

  const onSubmit = (v: RegisterValues) => {
    dispatch(registerThunk(v)) // { fullName, email, mobile, password }
      .unwrap()
      .then((data) => navigate(dashboardPathByRole[normalizeRole(data.user.role)]))
      .catch(() => {});
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Field
        icon={User}
        label={t("auth:fullName")}
        autoComplete="name"
        placeholder={t("auth:fullNamePlaceholder")}
        error={errors.fullName?.message}
        registration={register("fullName")}
      />
      <Field
        icon={Mail}
        label={t("auth:email")}
        type="email"
        autoComplete="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        registration={register("email")}
      />
      <Field
        icon={Phone}
        label={t("auth:mobile")}
        type="tel"
        autoComplete="tel"
        placeholder="01xxxxxxxxx"
        error={errors.mobile?.message}
        registration={register("mobile")}
      />
      <Field
        icon={Lock}
        label={t("auth:password")}
        type={show ? "text" : "password"}
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.password?.message}
        registration={register("password")}
        trailing={
          <button type="button" onClick={() => setShow((s) => !s)} className="flex text-[#9AA0AE]">
            {show ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        }
      />

      {serverError && <p className="mb-3 text-center text-sm text-danger">{serverError}</p>}

      <SubmitButton loading={loading}>{t("auth:registerButton")}</SubmitButton>
    </form>
  );
}