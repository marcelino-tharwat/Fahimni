import { getEmailConfig } from "./email.provider.js";
import { localeDirection, resolveEmailLocale } from "./email.locale.js";
import type { EmailLocale, EmailTemplateName, RenderedEmail } from "./email.types.js";

const brand = {
  navy900: "#0F0A2B",
  navy800: "#1A103D",
  cyan500: "#00C9DB",
  gray900: "#1F2937",
  gray600: "#6B7280",
  gray200: "#F3F4F6",
  white: "#FFFFFF",
};

const FOOTER: Record<EmailLocale, string> = {
  ar: "هذه رسالة تلقائية من منصة فاهمني، برجاء عدم الرد عليها.",
  en: "This is an automated message from Fahimni. Please do not reply.",
};

export const WITHDRAWAL_STATUS_LABELS = {
  ar: {
    PENDING: "قيد الانتظار",
    PROCESSING: "جاري التحويل / مقبول",
    TRANSFERRED: "تم التحويل",
    REJECTED: "مرفوض",
    CANCELLED: "ملغي",
  },
  en: {
    PENDING: "Pending",
    PROCESSING: "Processing",
    TRANSFERRED: "Transferred",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
  },
} as const;

export const TEACHER_REQUEST_STATUS_LABELS = {
  ar: { PENDING_REVIEW: "قيد المراجعة", APPROVED: "مقبول", REJECTED: "مرفوض" },
  en: { PENDING_REVIEW: "Pending review", APPROVED: "Approved", REJECTED: "Rejected" },
} as const;

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function value(data: Record<string, unknown>, key: string, fallback = ""): string {
  return String(data[key] ?? fallback);
}

function absUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = getEmailConfig().clientUrl.replace(/\/$/, "");
  return `${base}/${pathOrUrl.replace(/^\//, "")}`;
}

function statusLabel(
  labels: Record<EmailLocale, Record<string, string>>,
  locale: EmailLocale,
  status: unknown,
): string {
  const key = String(status ?? "");
  return labels[locale][key] ?? key;
}

function layout(locale: EmailLocale, title: string, body: string, ctaLabel?: string, ctaUrl?: string): string {
  const dir = localeDirection(locale);
  const brandName = locale === "ar" ? "فاهمني" : "Fahimni";
  const safeTitle = escapeHtml(title);
  const button =
    ctaLabel && ctaUrl
      ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(absUrl(ctaUrl))}" style="display:inline-block;background:${brand.cyan500};color:${brand.navy900};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${brand.gray200};font-family:Cairo,Arial,sans-serif;color:${brand.gray900};direction:${dir};text-align:${dir === "rtl" ? "right" : "left"}">
  <div style="max-width:640px;margin:0 auto;padding:24px 12px">
    <div style="background:${brand.navy900};background:linear-gradient(135deg,${brand.navy900},${brand.navy800});color:${brand.white};padding:22px 24px;border-radius:8px 8px 0 0">
      <div style="font-size:22px;font-weight:800">${brandName}</div>
    </div>
    <div style="background:${brand.white};padding:28px 24px;border:1px solid #E5E7EB;border-top:0;border-radius:0 0 8px 8px">
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.4;color:${brand.navy900}">${safeTitle}</h1>
      <div style="font-size:15px;line-height:1.8">${body}</div>
      ${button}
    </div>
    <p style="margin:18px 4px 0;color:${brand.gray600};font-size:12px;line-height:1.7">${FOOTER[locale]}</p>
  </div>
</body>
</html>`;
}

function renderEmail(
  locale: EmailLocale,
  subject: string,
  title: string,
  lines: string[],
  ctaLabel?: string,
  ctaUrl?: string,
): RenderedEmail {
  const body = lines.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join("");
  const text = [...lines, ctaUrl ? `${ctaLabel}: ${absUrl(ctaUrl)}` : "", FOOTER[locale]].filter(Boolean).join("\n\n");
  return { subject, html: layout(locale, title, body, ctaLabel, ctaUrl), text };
}

export function renderEmailTemplate(
  template: EmailTemplateName,
  localeInput: string | null | undefined,
  data: Record<string, unknown> = {},
): RenderedEmail {
  const locale = resolveEmailLocale(localeInput);
  const ref = value(data, "referenceNumber", value(data, "reference", "-"));
  const amount = value(data, "amount", "-");
  const reason = value(data, "reason", locale === "ar" ? "لم يتم تحديد سبب." : "No reason was provided.");

  if (template === "teacherRegistrationSubmitted") {
    return locale === "ar"
      ? renderEmail(locale, "تم استلام طلب تسجيلك في فاهمني", "طلبك قيد المراجعة", [`تم استلام طلب تسجيل المدرس الخاص بك.`, `رقم المتابعة: ${ref}`, `سنراجع البيانات ونبلغك بأي تحديث.`], "متابعة الطلب", value(data, "statusUrl", "/teacher/register/status"))
      : renderEmail(locale, "Your Fahimni teacher registration was submitted", "Your request is under review", [`We received your teacher registration request.`, `Reference number: ${ref}`, `We will review your details and notify you of any update.`], "Track request", value(data, "statusUrl", "/teacher/register/status"));
  }

  if (template === "teacherRegistrationApproved") {
    return locale === "ar"
      ? renderEmail(locale, "تم قبول طلبك كمدرس في فاهمني", "مرحباً بك في فاهمني", ["تم قبول طلب تسجيلك كمدرس.", "يمكنك تسجيل الدخول والبدء في إعداد صفحتك."], "تسجيل الدخول", value(data, "loginUrl", "/login"))
      : renderEmail(locale, "Your Fahimni teacher registration was approved", "Welcome to Fahimni", ["Your teacher registration request was approved.", "You can sign in and start setting up your profile."], "Sign in", value(data, "loginUrl", "/login"));
  }

  if (template === "teacherRegistrationRejected") {
    const editAllowed = value(data, "rejectionMode") === "EDIT_ALLOWED";
    return locale === "ar"
      ? renderEmail(locale, "تحديث على طلب التسجيل في فاهمني", "تم رفض طلب التسجيل", [`حالة الطلب: ${TEACHER_REQUEST_STATUS_LABELS.ar.REJECTED}`, `السبب: ${reason}`, editAllowed ? "يمكنك تعديل الطلب وإرساله مرة أخرى." : "هذا الرفض نهائي ولا يمكن إعادة إرسال الطلب."], editAllowed ? "تعديل الطلب" : "عرض الحالة", value(data, "statusUrl", "/teacher/register/status"))
      : renderEmail(locale, "Update on your Fahimni registration request", "Registration request rejected", [`Request status: ${TEACHER_REQUEST_STATUS_LABELS.en.REJECTED}`, `Reason: ${reason}`, editAllowed ? "You can edit and resubmit your request." : "This rejection is final and the request cannot be resubmitted."], editAllowed ? "Edit request" : "View status", value(data, "statusUrl", "/teacher/register/status"));
  }

  if (template === "teacherRegistrationResubmitted") {
    return locale === "ar"
      ? renderEmail(locale, "تمت إعادة إرسال طلبك", "طلبك قيد المراجعة مرة أخرى", [`رقم المتابعة: ${ref}`, `الحالة: ${TEACHER_REQUEST_STATUS_LABELS.ar.PENDING_REVIEW}`], "متابعة الطلب", value(data, "statusUrl", "/teacher/register/status"))
      : renderEmail(locale, "Your request was resubmitted", "Your request is pending review again", [`Reference number: ${ref}`, `Status: ${TEACHER_REQUEST_STATUS_LABELS.en.PENDING_REVIEW}`], "Track request", value(data, "statusUrl", "/teacher/register/status"));
  }

  if (template === "studentWelcome") {
    const studentName = value(data, "studentName", locale === "ar" ? "Ø·Ø§Ù„Ø¨Ù†Ø§" : "student");
    return locale === "ar"
      ? renderEmail(locale, "Ù…Ø±Ø­Ø¨Ø§Ù‹ Ø¨Ùƒ ÙÙŠ ÙØ§Ù‡Ù…Ù†ÙŠ", "ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨Ùƒ Ø¨Ù†Ø¬Ø§Ø­", [`Ù…Ø±Ø­Ø¨Ø§Ù‹ ${studentName}.`, "ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨Ùƒ ÙˆÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¨Ø¯Ø¡ ÙÙŠ Ù…ØªØ§Ø¨Ø¹Ø© Ø¯Ø±ÙˆØ³Ùƒ."], "Ø§Ù„Ø°Ù‡Ø§Ø¨ Ù„Ù„ÙˆØ­Ø©", value(data, "dashboardUrl", "/student/dashboard"))
      : renderEmail(locale, "Welcome to Fahimni", "Your account is ready", [`Welcome ${studentName}.`, "Your account was created successfully and you can start following your lessons."], "Go to dashboard", value(data, "dashboardUrl", "/student/dashboard"));
  }

  if (template === "emailVerification") {
    const studentName = value(data, "studentName", locale === "ar" ? "طالبنا" : "student");
    const verifyUrl = `/verify-email?token=${encodeURIComponent(value(data, "token"))}`;
    const verifyAbsUrl = absUrl(verifyUrl);
    return locale === "ar"
      ? renderEmail(locale, "تأكيد بريدك الإلكتروني في فاهمني", "تأكيد البريد الإلكتروني", [`مرحباً ${studentName}.`, "اضغط الزر التالي لتأكيد بريدك الإلكتروني وتفعيل حسابك.", `إذا لم يعمل الزر، انسخ هذا الرابط والصقه في المتصفح: ${verifyAbsUrl}`, "هذا الرابط صالح لمدة 24 ساعة. إذا لم تطلب إنشاء هذا الحساب، تجاهل هذه الرسالة."], "تأكيد البريد الإلكتروني", verifyUrl)
      : renderEmail(locale, "Verify your Fahimni email address", "Verify your email", [`Hi ${studentName}.`, "Click the button below to verify your email address and activate your account.", `If the button doesn't work, copy and paste this link into your browser: ${verifyAbsUrl}`, "This link is valid for 24 hours. If you did not create this account, you can ignore this message."], "Verify email", verifyUrl);
  }

  if (template === "teacherWithdrawalRequested") {
    return locale === "ar"
      ? renderEmail(locale, "تم إنشاء طلب السحب", "طلب السحب قيد الانتظار", [`المبلغ: ${amount}`, `الحالة: ${WITHDRAWAL_STATUS_LABELS.ar.PENDING}`], "عرض السحوبات", value(data, "withdrawalsUrl", "/teacher/withdrawals"))
      : renderEmail(locale, "Withdrawal request created", "Withdrawal pending", [`Amount: ${amount}`, `Status: ${WITHDRAWAL_STATUS_LABELS.en.PENDING}`], "View withdrawals", value(data, "withdrawalsUrl", "/teacher/withdrawals"));
  }

  if (template === "teacherWithdrawalStatusChanged") {
    const oldStatus = statusLabel(WITHDRAWAL_STATUS_LABELS, locale, data.oldStatus);
    const newStatus = statusLabel(WITHDRAWAL_STATUS_LABELS, locale, data.newStatus);
    return locale === "ar"
      ? renderEmail(locale, "تم تحديث حالة السحب", "تحديث حالة طلب السحب", [`المبلغ: ${amount}`, `الحالة السابقة: ${oldStatus}`, `الحالة الجديدة: ${newStatus}`], "عرض السحوبات", value(data, "withdrawalsUrl", "/teacher/withdrawals"))
      : renderEmail(locale, "Withdrawal status changed", "Withdrawal request update", [`Amount: ${amount}`, `Old status: ${oldStatus}`, `New status: ${newStatus}`], "View withdrawals", value(data, "withdrawalsUrl", "/teacher/withdrawals"));
  }

  if (template === "studentPaymentSuccess") {
    return locale === "ar"
      ? renderEmail(locale, "تم الدفع بنجاح", "تم تفعيل الاشتراك", [`تم استلام دفعتك بنجاح.`, `المبلغ: ${amount}`, value(data, "planName") ? `الخطة: ${value(data, "planName")}` : "اشتراكك جاهز للاستخدام."], "الذهاب للوحة الطالب", value(data, "dashboardUrl", "/student"))
      : renderEmail(locale, "Payment successful", "Subscription activated", [`Your payment was received successfully.`, `Amount: ${amount}`, value(data, "planName") ? `Plan: ${value(data, "planName")}` : "Your subscription is ready to use."], "Go to dashboard", value(data, "dashboardUrl", "/student"));
  }

  if (template === "quizAttemptGraded") {
    return locale === "ar"
      ? renderEmail(locale, "تم تصحيح الاختبار", "نتيجة الاختبار جاهزة", [`الاختبار: ${value(data, "quizTitle", "-")}`, `النتيجة: ${value(data, "score", "-")}`], "مراجعة النتيجة", value(data, "reviewUrl", "/student/quizzes"))
      : renderEmail(locale, "Quiz attempt graded", "Your quiz result is ready", [`Quiz: ${value(data, "quizTitle", "-")}`, `Score/result: ${value(data, "score", "-")}`], "Review result", value(data, "reviewUrl", "/student/quizzes"));
  }

  if (template === "passwordReset") {
    return locale === "ar"
      ? renderEmail(locale, "إعادة تعيين كلمة المرور", "رابط إعادة تعيين كلمة المرور", ["استخدم الرابط التالي لإعادة تعيين كلمة المرور.", "إذا لم تطلب ذلك، تجاهل هذه الرسالة."], "إعادة تعيين كلمة المرور", value(data, "resetUrl", "/reset-password"))
      : renderEmail(locale, "Reset your password", "Password reset link", ["Use the link below to reset your password.", "If you did not request this, ignore this message."], "Reset password", value(data, "resetUrl", "/reset-password"));
  }

  return locale === "ar"
    ? renderEmail(locale, value(data, "subject", "تنبيه إداري من فاهمني"), value(data, "title", "تنبيه إداري"), [value(data, "message", "يوجد تحديث يحتاج إلى المراجعة.")], value(data, "ctaLabel", "فتح لوحة الإدارة"), value(data, "ctaUrl", "/admin"))
    : renderEmail(locale, value(data, "subject", "Fahimni admin notification"), value(data, "title", "Admin notification"), [value(data, "message", "There is an update that needs review.")], value(data, "ctaLabel", "Open admin"), value(data, "ctaUrl", "/admin"));
}
