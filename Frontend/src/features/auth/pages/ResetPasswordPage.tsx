import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { Card } from "@/shared/components/ui";
import type { ApiError } from "@/shared/lib/api/client";
import { useAppDispatch } from "@/shared/store/hooks";
import { addToast } from "@/shared/store/slices/toastSlice";
import { authApi } from "@/features/auth/api/auth";
import { Stepper } from "@/features/auth/components/Stepper";
import { StepEmailForm } from "@/features/auth/components/StepEmailForm";
import { StepOtpVerify } from "@/features/auth/components/StepOtpVerify";
import { StepNewPassword } from "@/features/auth/components/StepNewPassword";
import { cn } from "@/shared/lib/utils/cn";

const RESEND_COOLDOWN = 60;

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [stepVisible, setStepVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    setStepVisible(false);
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setStepVisible(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const onSendOtp = async (emailValue: string) => {
    setSendLoading(true);
    setSendError(null);
    try {
      await authApi.sendOtp(emailValue);
      setEmail(emailValue);
      setStep(2);
      startCooldown();
    } catch (e) {
      const err = e as ApiError;
      if (err.statusCode === 429) {
        setSendError(t("auth:forgotPasswordFlow.rateLimited"));
      } else {
        setSendError(t("auth:forgotPasswordFlow.emailNotFound"));
      }
    } finally {
      setSendLoading(false);
    }
  };

  const onVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setVerifyLoading(true);
    setOtpError(null);
    try {
      await authApi.verifyOtp(email, otp);
      setStep(3);
    } catch (e) {
      const err = e as ApiError;
      if (err.statusCode === 410) {
        setOtpError(t("auth:forgotPasswordFlow.otpExpired"));
      } else {
        setOtpError(t("auth:forgotPasswordFlow.otpInvalid"));
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  const onResend = async () => {
    setSendLoading(true);
    try {
      await authApi.sendOtp(email);
      startCooldown();
      setOtp("");
      setOtpError(null);
    } catch (e) {
      const err = e as ApiError;
      if (err.statusCode === 429) {
        setOtpError(t("auth:forgotPasswordFlow.rateLimited"));
      }
    } finally {
      setSendLoading(false);
    }
  };

  const onResetPassword = async (password: string) => {
    setResetLoading(true);
    setResetError(null);
    try {
      await authApi.resetPasswordWithOtp(email, otp, password);
      dispatch(
        addToast({ type: "success", message: t("auth:success.passwordReset") }),
      );
      navigate("/auth");
    } catch (e) {
      const err = e as ApiError;
      setResetError(err.message ?? t("auth:validation.required"));
    } finally {
      setResetLoading(false);
    }
  };

  const goBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const steps = [
    { label: t("auth:forgotPasswordFlow.step1Title") },
    { label: t("auth:forgotPasswordFlow.step2Title") },
    { label: t("auth:forgotPasswordFlow.step3Title") },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card padding="none" className="relative w-full max-w-md overflow-hidden">
        <div className="relative rounded-t-[14px] bg-gradient-to-r from-[#1d1145] via-[#2a1758] to-[#3d2170] px-8 pb-6 pt-10">
          <div className="relative flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
              <GraduationCap size={24} className="text-white" />
            </div>
            <div className="text-center">
              <h1 className="font-cairo text-xl font-bold text-white">
                {t("auth:forgotPasswordFlow.title")}
              </h1>
              <p className="font-cairo text-sm text-white/60">
                {t("auth:tagline")}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          <Stepper steps={steps} currentStep={step - 1} />

          <div
            className={cn(
              "mt-8 transition-all duration-300 ease-out",
              stepVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0",
            )}
          >
            {step === 1 && (
              <StepEmailForm
                onSubmit={onSendOtp}
                loading={sendLoading}
                error={sendError}
              />
            )}

            {step === 2 && (
              <StepOtpVerify
                email={email}
                otp={otp}
                onOtpChange={(v) => { setOtp(v); setOtpError(null); }}
                onVerify={onVerifyOtp}
                verifyLoading={verifyLoading}
                otpError={otpError}
                resendCooldown={resendCooldown}
                onResend={onResend}
                sendLoading={sendLoading}
              />
            )}

            {step === 3 && (
              <StepNewPassword
                onSubmit={onResetPassword}
                loading={resetLoading}
                error={resetError}
              />
            )}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 font-cairo text-sm text-text-secondary transition-colors hover:text-text-primary"
              >
                <ArrowLeft size={16} />
                {t("actions.back")}
              </button>
            ) : (
              <div />
            )}
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 font-cairo text-sm text-accent transition-colors hover:text-accent/80"
            >
              {t("auth:loginTab")}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
