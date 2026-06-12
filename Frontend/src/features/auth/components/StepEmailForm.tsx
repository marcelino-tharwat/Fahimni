import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Mail } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";

function makeForgotSchema(t: (key: string) => string) {
  return z.object({
    email: z
      .string()
      .min(1, t("auth:validation.required"))
      .email(t("auth:validation.email")),
  });
}

interface StepEmailFormProps {
  onSubmit: (email: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StepEmailForm({ onSubmit, loading, error }: StepEmailFormProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ email: string }>({
    resolver: zodResolver(makeForgotSchema(t)),
    defaultValues: { email: "" },
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-1">
        <h2 className="font-cairo text-lg font-semibold text-text-primary">
          {t("auth:forgotPasswordFlow.step1Title")}
        </h2>
        <p className="font-cairo text-sm text-text-secondary">
          {t("auth:forgotPasswordFlow.step1Desc")}
        </p>
      </div>

      <form
        onSubmit={handleSubmit((values) => onSubmit(values.email))}
        noValidate
        className="flex flex-col gap-5"
      >
        <Input
          icon={<Mail size={18} />}
          type="email"
          label={t("auth:email")}
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-danger/5 px-4 py-3 text-sm text-danger">
            <AlertCircle size={16} className="shrink-0" />
            <span className="font-cairo">{error}</span>
          </div>
        )}

        <Button type="submit" loading={loading} size="lg" className="w-full">
          {t("auth:forgotPasswordFlow.sendOtp")}
        </Button>
      </form>
    </>
  );
}
