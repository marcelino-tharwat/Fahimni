import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui";
import { OtpInput } from "./OtpInput";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}@${domain}`;
}

interface StepOtpVerifyProps {
  email: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  verifyLoading: boolean;
  otpError: string | null;
  resendCooldown: number;
  onResend: () => void;
  sendLoading: boolean;
}

export function StepOtpVerify({
  email,
  otp,
  onOtpChange,
  onVerify,
  verifyLoading,
  otpError,
  resendCooldown,
  onResend,
  sendLoading,
}: StepOtpVerifyProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-cairo text-lg font-semibold text-text-primary">
          {t("auth:forgotPasswordFlow.step2Title")}
        </h2>
        <p className="font-cairo text-sm text-text-secondary">
          {t("auth:forgotPasswordFlow.step2Desc", {
            email: maskEmail(email),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <OtpInput
          value={otp}
          onChange={(v) => onOtpChange(v)}
          error={otpError ?? undefined}
          disabled={verifyLoading}
        />

        {otpError && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-cairo">{otpError}</span>
          </div>
        )}

        <Button
          onClick={onVerify}
          loading={verifyLoading}
          size="lg"
          disabled={otp.length !== 6}
          className="w-full"
        >
          {t("auth:forgotPasswordFlow.verifyOtp")}
        </Button>

        <div className="flex items-center justify-center gap-1">
          {resendCooldown > 0 ? (
            <span className="font-cairo text-sm text-text-secondary">
              {t("auth:forgotPasswordFlow.resendOtpIn", {
                s: resendCooldown,
              })}
            </span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              disabled={sendLoading}
              className="font-cairo text-sm text-accent transition-colors hover:text-accent/80 hover:underline disabled:opacity-50"
            >
              {t("auth:forgotPasswordFlow.resendOtp")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
