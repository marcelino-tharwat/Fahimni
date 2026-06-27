// src/features/auth/pages/AuthPage.tsx
import React, { useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap, User, Mail, Phone, Lock, Eye, EyeOff, Check, Loader2,
  type LucideIcon,
} from "lucide-react";
import { AuthNavbar } from "../components/AuthNavbar";
import { useAppDispatch } from "@/shared/store/hooks";
import { login as loginThunk, register as registerThunk, dashboardPathByRole } from "@/features/auth/store/authSlice";

/* ------------------------------------------------------------------ */
/*  Field                                                              */
/* ------------------------------------------------------------------ */

function Field({
  icon: Icon,
  error,
  registration,
  isPassword,
  ...props
}: {
  icon: LucideIcon;
  error?: string;
  registration: UseFormRegisterReturn;
  isPassword?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [show, setShow] = useState(false);

  const padding = isPassword
    ? (isRtl ? "pr-11 pl-10" : "pl-11 pr-10")
    : (isRtl ? "pr-11 pl-4" : "pl-11 pr-4");

  return (
    <div className="relative w-full">
      <input
        {...registration}
        {...props}
        type={isPassword ? (show ? "text" : "password") : props.type}
        dir={isRtl ? "rtl" : "ltr"}
        className={`w-full rounded-input border border-gray-300 bg-gray-50 py-3 outline-none placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 ${
          isRtl ? "text-right" : "text-left"
        } ${padding}`}
      />
      <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
        <Icon size={18} />
      </span>
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "left-3" : "right-3"}`}
        >
          {show ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Social Icons                                                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Tab Button                                                        */
/* ------------------------------------------------------------------ */

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 text-center text-sm font-bold transition ${active
          ? "border-b-2 border-cyan-500 text-cyan-600"
          : "text-gray-500"
        }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Submit Button                                                      */
/* ------------------------------------------------------------------ */

function SubmitButton({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-btn bg-cyan-gradient py-3 text-h3 font-bold text-white transition hover:shadow-glow disabled:opacity-60"
    >
      {disabled && <Loader2 className="animate-spin" size={20} />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Login Form                                                         */
/* ------------------------------------------------------------------ */

function LoginForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (v: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await dispatch(loginThunk({ email: v.email, password: v.password })).unwrap();
      navigate(dashboardPathByRole[res.user.role]);
    } catch (err) {
      setError(err ? String(err) : t("auth:errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-small text-red-600">
          {error}
        </p>
      )}
      <Field
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder={t("auth:email")}
        error={errors.email?.message}
        registration={register("email", {
          required: t("auth:errEmailRequired"),
          pattern: { value: /^\S+@\S+$/i, message: t("auth:errEmailInvalid") },
        })}
      />
      <Field
        icon={Lock}
        isPassword
        autoComplete="current-password"
        placeholder={t("auth:password")}
        error={errors.password?.message}
        registration={register("password", {
          required: t("auth:errPasswordRequired"),
        })}
      />
      <div className="text-right">
        <button
          type="button"
          onClick={() => navigate("/forgot-password")}
          className="text-small text-cyan-600"
        >
          {t("auth:forgotPassword")}
        </button>
      </div>
      <SubmitButton disabled={loading}>{t("auth:loginButton")}</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Register Form                                                      */
/* ------------------------------------------------------------------ */

function RegisterForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ fullName: string; email: string; mobile: string; password: string }>({
    defaultValues: { fullName: "", email: "", mobile: "", password: "" },
  });

  const onSubmit = async (v: { fullName: string; email: string; mobile: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      const res = await dispatch(registerThunk({ ...v, role: 'STUDENT' })).unwrap();
      navigate(dashboardPathByRole[res.user.role]);
    } catch (err) {
      setError(err ? String(err) : t("auth:errGeneric"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-small text-red-600">
          {error}
        </p>
      )}
      <Field
        icon={User}
        autoComplete="name"
        placeholder={t("auth:fullName")}
        error={errors.fullName?.message}
        registration={register("fullName", {
          required: t("auth:validation.required"),
          minLength: { value: 2, message: t("auth:errNameMin") },
        })}
      />
      <Field
        icon={Mail}
        type="email"
        autoComplete="email"
        placeholder={t("auth:email")}
        error={errors.email?.message}
        registration={register("email", {
          required: t("auth:errEmailRequired"),
          pattern: { value: /^\S+@\S+$/i, message: t("auth:errEmailInvalid") },
        })}
      />
      <Field
        icon={Phone}
        type="tel"
        autoComplete="tel"
        placeholder={t("auth:mobile")}
        error={errors.mobile?.message}
        registration={register("mobile", {
          required: t("auth:validation.required"),
          pattern: { value: /^(\+20|0)(10|11|12|15)[0-9]{8}$/, message: t("auth:errMobileInvalid") },
        })}
      />
      <Field
        icon={Lock}
        isPassword
        autoComplete="new-password"
        placeholder={t("auth:password")}
        error={errors.password?.message}
        registration={register("password", {
          required: t("auth:errPasswordRequired"),
          minLength: { value: 8, message: t("auth:errPasswordMin") },
          validate: {
            uppercase: (v: string) => /[A-Z]/.test(v) || t('auth:errPasswordUppercase'),
            lowercase: (v: string) => /[a-z]/.test(v) || t('auth:errPasswordLowercase'),
            number: (v: string) => /[0-9]/.test(v) || t('auth:errPasswordNumber'),
            special: (v: string) => /[^A-Za-z0-9]/.test(v) || t('auth:errPasswordSpecial'),
          },
        })}
      />
      <p className="text-right text-small text-gray-500">
        {t("auth:termsPrefix")}{" "}
        <a href="/terms" className="text-cyan-600">{t("auth:termsOfService")}</a>
        {" "}{t("common:andLabel")}{" "}
        <a href="/privacy" className="text-cyan-600">{t("auth:privacyPolicy")}</a>
      </p>
      <SubmitButton disabled={loading}>{t("auth:registerButton")}</SubmitButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth Page                                                          */
/* ------------------------------------------------------------------ */

export function AuthPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const isLogin = mode === "login";

  return (
    <>
      <AuthNavbar />
      <div className="flex min-h-[calc(100vh-73px)] flex-col lg:flex-row">
        {/* Form Panel */}
        <main className="flex w-full items-center justify-center bg-gray-100 px-4 py-8 lg:w-3/5 lg:p-8">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-modal md:p-8">
          {/* Logo row */}
          <div className="mb-6 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 text-lg font-bold text-white">
              ف
            </span>
            <h2 className="mt-2 text-h2 font-bold text-navy-900">{t("auth:brandName")}</h2>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 grid grid-cols-2 border-b border-gray-200">
            <TabButton active={isLogin} onClick={() => setMode("login")}>
              {t("auth:loginTab")}
            </TabButton>
            <TabButton active={!isLogin} onClick={() => setMode("register")}>
              {t("auth:registerTab")}
            </TabButton>
          </div>

          {/* Form */}
          {isLogin ? <LoginForm /> : <RegisterForm />}

          {/* Divider + Social */}
          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-300" />
            <span className="text-small text-gray-500">{t("auth:orLoginWith")}</span>
            <span className="h-px flex-1 bg-gray-300" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center justify-center gap-2 rounded-btn border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <FacebookIcon /> {t("auth:facebook")}
            </button>
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center justify-center gap-2 rounded-btn border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <GoogleIcon /> {t("auth:google")}
            </button>
          </div>
        </div>
      </main>

      {/* Hero Panel */}
      <aside className="hidden w-full flex-col items-center justify-center bg-hero-gradient px-6 py-12 text-center lg:flex lg:w-2/5 lg:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-xl border border-cyan-500/30 bg-navy-800">
          <GraduationCap className="text-cyan-500" size={36} />
        </div>

        <h1 className="mt-6 text-4xl font-extrabold text-white">
          {t("auth:brandName")}
          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-sm font-bold text-white">
            ف
          </span>
        </h1>

        <p className="mt-3 max-w-sm text-body text-gray-300">
          {t("auth:tagline")}
        </p>

        {/* Feature bullets */}
        <div className="mt-8 space-y-4 text-right">
          {["heroFeature1", "heroFeature2", "heroFeature3"].map((key) => (
            <div key={key} className="flex items-center gap-3">
              <Check className="shrink-0 text-cyan-400" size={20} />
              <span className="text-body text-white">{t(`auth:${key}`)}</span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 flex items-center justify-center gap-6">
          {[
            { valueKey: "heroStatStudentsValue", labelKey: "heroStatStudentsLabel" },
            { valueKey: "heroStatLessonsValue", labelKey: "heroStatLessonsLabel" },
            { valueKey: "heroStatSatisfactionValue", labelKey: "heroStatSatisfactionLabel" },
          ].map((stat, i) => (
            <React.Fragment key={stat.labelKey}>
              {i > 0 && <span className="h-8 w-px bg-gray-600" />}
              <div className="text-center">
                <p className="text-xl font-bold text-cyan-400">{t(`auth:${stat.valueKey}`)}</p>
                <p className="text-small text-gray-400">{t(`auth:${stat.labelKey}`)}</p>
              </div>
            </React.Fragment>
          ))}
        </div>
      </aside>
    </div>
    </>
  );
}
