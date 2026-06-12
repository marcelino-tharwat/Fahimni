import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Lock } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";
import { PasswordStrengthBar } from "./PasswordStrengthBar";

interface StepNewPasswordProps {
  onSubmit: (password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StepNewPassword({ onSubmit, loading, error }: StepNewPasswordProps) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<{ password: string; confirmPassword: string }>({
    resolver: zodResolver(
      z
        .object({
          password: z
            .string()
            .min(1, t("auth:validation.required"))
            .min(8, t("auth:validation.passwordMin"))
            .max(100, t("auth:validation.passwordMax")),
          confirmPassword: z.string().min(1, t("auth:validation.required")),
        })
        .refine((data) => data.password === data.confirmPassword, {
          message: t("auth:forgotPasswordFlow.passwordsMustMatch"),
          path: ["confirmPassword"],
        }),
    ),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const passwordValue = watch("password");

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-cairo text-lg font-semibold text-text-primary">
          {t("auth:forgotPasswordFlow.step3Title")}
        </h2>
        <p className="font-cairo text-sm text-text-secondary">
          {t("auth:forgotPasswordFlow.step3Desc")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit((values) => onSubmit(values.password))}
        noValidate
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1">
          <Input
            icon={<Lock size={18} />}
            type={showPassword ? "text" : "password"}
            label={t("auth:forgotPasswordFlow.newPassword")}
            autoComplete="new-password"
            error={errors.password?.message}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            {...register("password")}
          />
          <PasswordStrengthBar password={passwordValue} />
        </div>

        <Input
          icon={<Lock size={18} />}
          type={showConfirm ? "text" : "password"}
          label={t("auth:forgotPasswordFlow.confirmPassword")}
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          trailing={
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              tabIndex={-1}
              className="text-text-secondary transition-colors hover:text-text-primary"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          {...register("confirmPassword")}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-cairo">{error}</span>
          </div>
        )}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          {t("auth:forgotPasswordFlow.resetButton")}
        </Button>
      </form>
    </>
  );
}
