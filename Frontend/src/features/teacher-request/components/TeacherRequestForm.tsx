import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Mail, Phone, BookOpen, CheckCircle, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/Button";
import { Input } from "@/shared/components/ui/Input";
import { Card } from "@/shared/components/ui/Card";
import { apiClient } from "@/shared/lib/api/client";
import { translateApiError } from "@/shared/lib/api/translateError";
import { useSubjects } from "@/features/subjects/useSubjects";
import { ProofUpload } from "./ProofUpload";

const teacherRequestSchema = z.object({
  fullName: z.string().trim().min(2, "teacherRequest:validation.fullNameMin"),
  email: z.string().trim().email("teacherRequest:validation.emailInvalid").toLowerCase(),
  mobile: z
    .string()
    .trim()
    .regex(/^(\+20|0)(10|11|12|15)[0-9]{8}$/, "teacherRequest:validation.mobileInvalid"),
  subject: z.string().trim().optional(),
  bio: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { message: "teacherRequest:consentRequired" }),
});

type FormValues = z.infer<typeof teacherRequestSchema>;

interface ProofFileItem {
  id: string;
  file: File;
}

export function TeacherRequestForm() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [proofFiles, setProofFiles] = useState<ProofFileItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    publicReference: string;
    createdAt: string;
  } | null>(null);
  const { subjects, loading: subjectsLoading } = useSubjects();
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    resolver: zodResolver(teacherRequestSchema),
    defaultValues: {
      fullName: "",
      email: "",
      mobile: "",
      subject: "",
      bio: "",
    },
  });

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (submitting) return;
      if (proofFiles.length < 1) {
        setSubmitError(t("teacherRequest:minProofRequired"));
        return;
      }
      setSubmitError(null);
      setSubmitting(true);

      try {
        const formData = new FormData();
        formData.append("fullName", values.fullName);
        formData.append("email", values.email);
        formData.append("mobile", values.mobile);
        if (values.subject) formData.append("subject", values.subject);
        if (values.bio) formData.append("bio", values.bio);
        for (const pf of proofFiles) {
          formData.append("proofDocuments", pf.file);
        }

        const { data } = await apiClient.post<{
          success: boolean;
          data: { publicReference: string; status: string; createdAt: string };
        }>("/teacher-registration-requests", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setSuccessData(data.data);
      } catch (err: unknown) {
        setSubmitError(translateApiError(t, err));
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, proofFiles, t],
  );

  if (successData) {
    return (
      <Card padding="lg" className="mx-auto max-w-lg text-center">
        <div className="flex flex-col items-center gap-4 py-6">
          <CheckCircle size={48} className="text-success" />
          <h2 className="font-cairo text-h2 font-bold text-text-primary">
            {t("teacherRequest:successTitle")}
          </h2>
          <p className="font-cairo text-body text-text-secondary">
            {t("teacherRequest:successMessage")}
          </p>
          <div className="rounded-md bg-surface px-4 py-3">
            <p className="font-cairo text-sm text-text-secondary">
              {t("teacherRequest:referenceNumber")}
            </p>
            <p className="font-cairo text-lg font-bold text-accent">
              {successData.publicReference}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" className="mx-auto max-w-lg">
      <h1 className="mb-2 font-cairo text-h2 font-bold text-text-primary">
        {t("teacherRequest:pageTitle")}
      </h1>
      <p className="mb-6 font-cairo text-body text-text-secondary">
        {t("teacherRequest:pageSubtitle")}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {submitError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
            {submitError}
          </p>
        )}

        <Input
          label={t("teacherRequest:fullName")}
          placeholder={t("teacherRequest:fullNamePlaceholder")}
          icon={<User size={18} />}
          error={errors.fullName?.message && t(errors.fullName.message)}
          {...register("fullName")}
        />

        <Input
          label={t("teacherRequest:email")}
          type="email"
          placeholder={t("teacherRequest:emailPlaceholder")}
          icon={<Mail size={18} />}
          error={errors.email?.message && t(errors.email.message)}
          {...register("email")}
        />

        <Input
          label={t("teacherRequest:mobile")}
          type="tel"
          placeholder={t("teacherRequest:mobilePlaceholder")}
          icon={<Phone size={18} />}
          error={errors.mobile?.message && t(errors.mobile.message)}
          {...register("mobile")}
        />

        <input type="hidden" {...register("subject")} />
        <div className="relative w-full">
          <label className="mb-1 block font-cairo text-sm font-medium text-text-primary">
            {t("teacherRequest:subject")}
          </label>
          <button
            type="button"
            onClick={() => !subjectsLoading && setSubjectOpen((o) => !o)}
            disabled={subjectsLoading}
            dir={isRtl ? "rtl" : "ltr"}
            className={`relative flex w-full items-center rounded-input border py-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-cyan-100 ${
              isRtl ? "pr-11 pl-3" : "pl-11 pr-3"
            } ${errors.subject?.message ? "border-red-400" : "border-border"} ${subjectsLoading ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <span className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? "right-3" : "left-3"}`}>
              <BookOpen size={18} />
            </span>
            <span className={`flex-1 font-cairo text-body ${isRtl ? "text-right" : "text-left"} ${selectedSubject ? "text-text-primary" : "text-text-secondary"}`}>
              {subjectsLoading
                ? t("auth:loading", "...")
                : selectedSubject
                  ? selectedSubject
                  : t("teacherRequest:subjectPlaceholder", "مثال: اللغة العربية، الرياضيات")}
            </span>
            <ChevronDown
              size={18}
              className={`shrink-0 text-gray-400 transition-transform ${subjectOpen ? "rotate-180" : ""}`}
            />
          </button>
          {errors.subject?.message && (
            <p className="mt-1.5 text-xs text-red-500">{t(errors.subject.message)}</p>
          )}
          {subjectOpen && !subjectsLoading && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              {subjects.length === 0 ? (
                <p className="px-4 py-3 font-cairo text-sm text-gray-500">
                  {t("auth:noStages", "لا توجد خيارات")}
                </p>
              ) : (
                subjects.map((subject) => (
                  <button
                    key={subject.code}
                    type="button"
                    onClick={() => {
                      setSelectedSubject(subject.displayName);
                      setValue("subject", subject.displayName, { shouldValidate: true });
                      setSubjectOpen(false);
                    }}
                    className={`relative flex w-full items-center py-2.5 font-cairo text-body transition hover:bg-gray-50 ${
                      isRtl ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"
                    } ${selectedSubject === subject.displayName ? "bg-cyan-50 font-semibold text-cyan-700" : "text-text-primary"}`}
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

        <div className="flex w-full flex-col gap-1">
          <label className="text-start font-cairo text-sm font-medium text-text-primary">
            {t("teacherRequest:bio")}
          </label>
          <textarea
            {...register("bio")}
            rows={2}
            placeholder={t("teacherRequest:bioPlaceholder")}
            className="w-full rounded-input border border-border bg-surface px-3 py-3 font-cairo text-text-primary outline-none transition-colors placeholder:text-text-secondary focus:border-accent"
          />
          {errors.bio?.message && (
            <span className="text-start text-sm text-danger">
              {t(errors.bio.message)}
            </span>
          )}
        </div>

        <ProofUpload
          files={proofFiles}
          onChange={setProofFiles}
        />

        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            {...register("consent")}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-accent"
          />
          <span className="font-cairo text-sm text-text-primary">
            {t("teacherRequest:consent")}
          </span>
        </label>
        {errors.consent?.message && (
          <span className="-mt-3 text-start text-sm text-danger">
            {t(errors.consent.message as string)}
          </span>
        )}

        <Button type="submit" loading={submitting} className="w-full">
          {t("teacherRequest:submitButton")}
        </Button>
      </form>
    </Card>
  );
}
