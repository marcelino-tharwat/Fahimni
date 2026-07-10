export type EmailLocale = "ar" | "en";

export type EmailTemplateName =
  | "teacherRegistrationSubmitted"
  | "teacherRegistrationApproved"
  | "teacherRegistrationRejected"
  | "teacherRegistrationResubmitted"
  | "teacherWithdrawalRequested"
  | "teacherWithdrawalStatusChanged"
  | "studentPaymentSuccess"
  | "quizAttemptGraded"
  | "passwordReset"
  | "genericAdminNotification";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailInput {
  to: string;
  template: EmailTemplateName;
  locale?: string | null;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  critical?: boolean;
}

export interface EmailProvider {
  send(input: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

export interface EmailSendResult {
  sent: boolean;
  dryRun: boolean;
  skipped: boolean;
  template: EmailTemplateName;
  locale: EmailLocale;
  subject: string;
}
