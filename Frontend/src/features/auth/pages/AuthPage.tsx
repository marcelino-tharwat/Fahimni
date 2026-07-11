// src/features/auth/pages/AuthPage.tsx
import React, { useEffect, useRef, useState } from "react";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import {
  GraduationCap, User, Mail, Phone, Lock, Eye, EyeOff, Check, Loader2, ChevronDown, BookOpen,
  type LucideIcon,
} from "lucide-react";
import { AppHeader } from "@/shared/components/layout/AppHeader";
import { useAppDispatch } from "@/shared/store/hooks";
import { apiClient, type ApiError } from "@/shared/lib/api/client";
import { translateApiError, translateFieldErrors } from "@/shared/lib/api/translateError";
import { normalizeTextInput, normalizeOptionalTextInput, isBlank } from "@/shared/lib/utils/textNormalization";
import { login as loginThunk, register as registerThunk, googleLogin as googleLoginThunk, dashboardPathByRole } from "@/features/auth/store/authSlice";
import type { PublicStage } from "@/features/student/types/student";
import { ProofUpload } from "@/features/teacher-request/components/ProofUpload";
import { useSubjects } from "@/features/subjects/useSubjects";

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<{ email: string; password: string }>({
    defaultValues: { email: "", password: "" },
  });

  // Field validation messages are resolved (translated) at the moment RHF
  // actually runs the rule, not on every render — so a language switch after
  // a failed submit leaves stale-language text in `errors` until the rules
  // are re-run. Re-validate any already-invalid fields so the visible
  // messages update immediately when the UI language changes.
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      void trigger();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const onSubmit = async (v: { email: string; password: string }) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const res = await dispatch(loginThunk({ email: v.email, password: v.password })).unwrap();
      // Redirect based on access state — pending/rejected teachers go to their
      // review-status pages; everyone else follows the normal role-based path.
      if (res.accessState === 'TEACHER_PENDING_REVIEW') {
        navigate('/teacher/pending-review');
      } else if (res.accessState === 'TEACHER_REJECTED') {
        navigate('/teacher/rejected');
      } else {
        navigate(dashboardPathByRole[res.user.role]);
      }
    } catch (err) {
      setError(translateApiError(t, err));
    } finally {
      inFlightRef.current = false;
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
          validate: (v) => !isBlank(v) || t("auth:errPasswordRequired"),
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

type AccountType = "student" | "teacher";
type RegisterFormValues = {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  stageId: string;
  subject: string;
  bio: string;
};

function RegisterForm() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teacherPending, setTeacherPending] = useState(false);
  const [trackingReference, setTrackingReference] = useState<string | null>(null);
  const [refCopied, setRefCopied] = useState(false);
  const [proofFiles, setProofFiles] = useState<{ id: string; file: File }[]>([]);
  const [stages, setStages] = useState<PublicStage[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const { subjects, loading: subjectsLoading } = useSubjects();
  const inFlightRef = useRef(false);

  useEffect(() => {
    apiClient.get<{ success: boolean; message: string; data: PublicStage[] }>('/stages/public')
      .then(({ data }) => setStages(data.data ?? []))
      .catch(() => setStages([]))
      .finally(() => setStagesLoading(false));
  }, []);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
    setValue,
    getValues,
    setError: setFieldError,
  } = useForm<RegisterFormValues>({
    defaultValues: { fullName: "", email: "", mobile: "", password: "", confirmPassword: "", stageId: "", subject: "", bio: "" },
  });

  // Same fix as LoginForm: re-run validation on any already-invalid fields so
  // their messages switch language immediately, instead of staying frozen in
  // whatever language was active during the last failed submit/blur. Server
  // errors (duplicate email, etc.) aren't tied to a client-side rule, so
  // re-triggering them would just clear them — leave those alone.
  useEffect(() => {
    const clientInvalidFields = (Object.keys(errors) as (keyof RegisterFormValues)[])
      .filter((field) => errors[field]?.type !== "server");
    if (clientInvalidFields.length > 0) {
      void trigger(clientInvalidFields);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  const isTeacher = accountType === "teacher";

  const stageIdRegister = register("stageId", {
    validate: (v) => isTeacher || !!v || t("auth:errStageRequired"),
  });

  const onSubmit = async (v: RegisterFormValues) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      if (isTeacher) {
        // Teacher registration is pending-review: call the API directly so no
        // session is established (the backend issues no tokens for a pending
        // teacher). Sent as multipart/form-data so proof documents ride along.
        const fd = new FormData();
        fd.append('fullName', normalizeTextInput(v.fullName));
        fd.append('email', v.email.trim());
        fd.append('mobile', v.mobile.trim());
        fd.append('password', v.password);
        fd.append('confirmPassword', v.confirmPassword);
        fd.append('role', 'OPERATION');
        fd.append('locale', i18n.language === 'en' ? 'en' : 'ar');
        const normalizedSubject = normalizeOptionalTextInput(v.subject);
        if (normalizedSubject) fd.append('subject', normalizedSubject);
        const normalizedBio = normalizeOptionalTextInput(v.bio);
        if (normalizedBio) fd.append('bio', normalizedBio);
        for (const pf of proofFiles) fd.append('proofDocuments', pf.file);
        // Must send as multipart so the proof files survive. The apiClient default
        // Content-Type is application/json, and axios silently JSON-serializes a
        // FormData body under that header (dropping the File parts) — overriding it
        // lets the browser set multipart/form-data with the proper boundary.
        const resp = await apiClient.post<{ data?: { trackingReference?: string } }>(
          '/v1/auth/register',
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
        setTrackingReference(resp.data?.data?.trackingReference ?? null);
        setTeacherPending(true);
        return;
      }
      const res = await dispatch(registerThunk({ fullName: normalizeTextInput(v.fullName), email: v.email.trim(), mobile: v.mobile.trim(), password: v.password, stageId: v.stageId, role: 'STUDENT', locale: i18n.language === 'en' ? 'en' : 'ar' })).unwrap();
      navigate(dashboardPathByRole[res.user.role]);
    } catch (err) {
      // Both paths land here as an `ApiError`-shaped object: the teacher path
      // throws the raw client.ts error; the student path unwraps the
      // register thunk's rejectValue, which is the same raw `ApiError`.
      const apiErr = err as ApiError;
      const knownFields = new Set(["fullName", "email", "mobile", "password", "confirmPassword", "stageId", "subject", "bio"]);
      const fieldMessages = translateFieldErrors(t, apiErr);
      let hasFieldError = false;
      for (const [field, message] of Object.entries(fieldMessages)) {
        if (knownFields.has(field)) {
          setFieldError(field as keyof RegisterFormValues, { message, type: "server" });
          hasFieldError = true;
        }
      }
      if (!hasFieldError) setError(translateApiError(t, apiErr));
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  // Teacher pending-review success state.
  if (teacherPending) {
    return (
      <div className="flex flex-col gap-4 text-center" data-testid="teacher-pending-message">
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-body font-medium text-emerald-700">
          {t("auth:teacherPendingMessage", "تم استلام طلبك وهو قيد المراجعة، وسيتم إشعارك عند مراجعة الطلب.")}
        </p>
        {trackingReference && (
          <div
            className="flex flex-col gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3"
            data-testid="tracking-reference"
          >
            <span className="text-small text-gray-600">
              {t("auth:trackingReferenceLabel", "رقم متابعة الطلب")}
            </span>
            <div className="flex items-center justify-center gap-2">
              <code className="rounded bg-white px-3 py-1 text-body font-bold tracking-wider text-cyan-700">
                {trackingReference}
              </code>
              <button
                type="button"
                data-testid="copy-tracking-reference"
                onClick={() => {
                  navigator.clipboard?.writeText(trackingReference).then(
                    () => {
                      setRefCopied(true);
                      window.setTimeout(() => setRefCopied(false), 2000);
                    },
                    () => setRefCopied(false),
                  );
                }}
                className="rounded border border-cyan-300 px-2 py-1 text-small font-semibold text-cyan-600 hover:bg-cyan-100"
              >
                {refCopied
                  ? t("auth:copied", "تم النسخ")
                  : t("auth:copy", "نسخ")}
              </button>
            </div>
            <span className="text-xs text-gray-500">
              {t("auth:trackingReferenceHint", "احتفظ بهذا الرقم لمتابعة حالة طلبك لاحقاً")}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => navigate("/teacher/track")}
          className="text-small font-semibold text-cyan-600 hover:underline"
        >
          {t("auth:teacherTrackCta", "متابعة حالة الطلب")}
        </button>
        <button
          type="button"
          onClick={() => navigate("/teacher/pending-review")}
          className="text-small font-semibold text-cyan-600 hover:underline"
        >
          {t("auth:teacherPendingCta", "عرض حالة الطلب")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Account type selector */}
      <div className="flex gap-2" role="group" aria-label={t("auth:accountType", "نوع الحساب")}>
        <button
          type="button"
          onClick={() => setAccountType("student")}
          aria-pressed={!isTeacher}
          className={`flex-1 rounded-lg border px-3 py-2 text-small font-semibold transition-colors ${!isTeacher ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-gray-300 text-gray-600"}`}
        >
          {t("auth:accountTypeStudent", "طالب")}
        </button>
        <button
          type="button"
          onClick={() => setAccountType("teacher")}
          aria-pressed={isTeacher}
          className={`flex-1 rounded-lg border px-3 py-2 text-small font-semibold transition-colors ${isTeacher ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-gray-300 text-gray-600"}`}
        >
          {t("auth:accountTypeTeacher", "مدرس")}
        </button>
      </div>

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
          // Tabs/spaces/newlines alone must not count as a valid name — RHF's
          // built-in `required`/`minLength` only check the raw (untrimmed)
          // length, so "\t\t" (length 2) would otherwise pass both.
          validate: (v: string) => normalizeTextInput(v).length >= 2 || t("auth:errNameMin"),
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
      <Field
        icon={Lock}
        isPassword
        autoComplete="new-password"
        placeholder={t("auth:confirmPassword", "تأكيد كلمة المرور")}
        error={errors.confirmPassword?.message}
        registration={register("confirmPassword", {
          required: t("auth:errPasswordRequired"),
          validate: (v: string) => v === getValues("password") || t("auth:errConfirmMismatch", "كلمتا المرور غير متطابقتين"),
        })}
      />

      {isTeacher ? (
        <>
          <input type="hidden" {...register("subject", { required: t("auth:validation.required") })} />
          <SubjectSelect
            subjects={subjects}
            loading={subjectsLoading}
            error={errors.subject?.message}
            onChange={(name) => setValue("subject", name, { shouldValidate: true })}
          />
          <Field
            icon={User}
            placeholder={t("auth:bio", "نبذة (اختياري)")}
            error={errors.bio?.message}
            registration={register("bio")}
          />
          <ProofUpload files={proofFiles} onChange={setProofFiles} />
        </>
      ) : (
        <>
          {/* Hidden input so react-hook-form tracks stageId validation */}
          <input type="hidden" {...stageIdRegister} />
          <StageSelect
            stages={stages}
            loading={stagesLoading}
            error={errors.stageId?.message}
            onChange={(id) => setValue("stageId", id, { shouldValidate: true })}
          />
        </>
      )}

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
/*  Subject Select                                                      */
/* ------------------------------------------------------------------ */

function SubjectSelect({
  subjects,
  loading,
  error,
  onChange,
}: {
  subjects: { code: string; displayName: string; isActive: boolean }[];
  loading: boolean;
  error?: string;
  onChange: (displayName: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        role="combobox"
        aria-label={t("auth:subject", "التخصص")}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !loading && setOpen((o) => !o)}
        disabled={loading}
        dir={isRtl ? "rtl" : "ltr"}
        className={`relative flex w-full items-center rounded-input border bg-gray-50 py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 ${
          isRtl ? "pr-11 pl-4" : "pl-11 pr-4"
        } ${error ? "border-red-400" : "border-gray-300"} ${loading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
          <BookOpen size={18} />
        </span>
        <span className={`flex-1 font-cairo text-body ${isRtl ? "text-right" : "text-left"} ${selected ? "text-navy-900" : "text-gray-400"}`}>
          {loading
            ? t("auth:loading")
            : selected
              ? selected
              : t("auth:subject", "التخصص")}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
      {open && !loading && (
        <div
          role="listbox"
          aria-label={t("auth:subject", "التخصص")}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
        >
          {subjects.length === 0 ? (
            <p className="px-4 py-3 font-cairo text-sm text-gray-500">
              {t("auth:noStages")}
            </p>
          ) : (
            subjects.map((subject) => (
              <button
                key={subject.code}
                type="button"
                role="option"
                aria-selected={selected === subject.displayName}
                onClick={() => {
                  setSelected(subject.displayName);
                  onChange(subject.displayName);
                  setOpen(false);
                }}
                className={`relative flex w-full items-center py-2.5 font-cairo text-body transition hover:bg-gray-50 ${
                  isRtl ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"
                } ${selected === subject.displayName ? "bg-cyan-50 font-semibold text-cyan-700" : "text-navy-900"}`}
              >
                <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
                  <BookOpen size={16} />
                </span>
                <span className="flex-1">{subject.displayName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stage Select                                                       */
/* ------------------------------------------------------------------ */

function StageSelect({
  stages,
  loading,
  error,
  onChange,
}: {
  stages: PublicStage[];
  loading: boolean;
  error?: string;
  onChange: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PublicStage | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => !loading && setOpen((o) => !o)}
        disabled={loading}
        dir={isRtl ? "rtl" : "ltr"}
        className={`relative flex w-full items-center rounded-input border py-3 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 ${
          isRtl ? "pr-11 pl-4" : "pl-11 pr-4"
        } ${error ? "border-red-400" : "border-gray-300"} ${loading ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
          <GraduationCap size={18} />
        </span>
        <span className={`flex-1 font-cairo text-body ${isRtl ? "text-right" : "text-left"} ${selected ? "text-navy-900" : "text-gray-400"}`}>
          {loading
            ? t("auth:loading")
            : selected
              ? selected.displayName ?? selected.name
              : t("auth:selectStage")}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-500">{error}</p>
      )}
      {open && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {stages.length === 0 ? (
            <p className="px-4 py-3 font-cairo text-sm text-gray-500">
              {t("auth:noStages")}
            </p>
          ) : (
            stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setSelected(stage);
                  onChange(stage.id);
                  setOpen(false);
                }}
                className={`relative flex w-full items-center py-2.5 font-cairo text-body transition hover:bg-gray-50 ${
                  isRtl ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"
                } ${selected?.id === stage.id ? "bg-cyan-50 font-semibold text-cyan-700" : "text-navy-900"}`}
              >
                <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
                  <GraduationCap size={16} />
                </span>
                <span className="flex-1">{stage.displayName ?? stage.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Google Button                                                      */
/* ------------------------------------------------------------------ */

function GoogleButton() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleLogin = useGoogleLogin({
    scope: "openid email profile",
    onSuccess: async (tokenResponse) => {
      setError(null);
      setLoading(true);
      if (!tokenResponse.access_token) {
        setError("No access token returned from Google.");
        setLoading(false);
        return;
      }
      try {
        const res = await dispatch(googleLoginThunk({ credential: tokenResponse.access_token })).unwrap();
        navigate(dashboardPathByRole[res.user.role]);
      } catch (err) {
        console.error("[GoogleButton] API error:", err);
        setError(String(err));
        setLoading(false);
      }
    },
    onError: (errorResponse) => {
      console.error("[GoogleButton] OAuth error:", errorResponse);
      setError("Google sign-in failed. Please try again.");
      setLoading(false);
    },
    onNonOAuthError: (nonOAuthError) => {
      console.error("[GoogleButton] Non-OAuth error:", nonOAuthError);
      setError("Sign-in popup was blocked or closed. Please try again.");
      setLoading(false);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => googleLogin()}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-btn border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
        {loading ? t("auth:loading") : t("auth:google")}
      </button>
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth Page                                                          */
/* ------------------------------------------------------------------ */

export function AuthPage() {
  const { t } = useTranslation();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const [mode, setMode] = useState<"login" | "register">("login");
  const isLogin = mode === "login";

  return (
    <GoogleOAuthProvider clientId={googleClientId || "000000000000-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"}>
      <div className="flex h-screen flex-col">
        <AppHeader variant="auth" />
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* Form Panel */}
          <main className="flex min-h-0 w-full items-start justify-center overflow-y-auto bg-gray-100 px-4 py-8 lg:w-3/5 lg:p-8 scrollbar-hide">
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
          <div className="mt-4">
            <GoogleButton />
          </div>
        </div>
      </main>

      {/* Hero Panel */}
      <aside className="hidden min-h-0 w-full flex-col items-center justify-center bg-hero-gradient px-6 py-12 text-center lg:flex lg:w-2/5 lg:p-12">
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
      </div>
    </GoogleOAuthProvider>
  );
}
