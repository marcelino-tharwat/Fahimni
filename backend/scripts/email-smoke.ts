import { EmailService } from "../src/modules/email/email.service.js";
import { getEmailConfig, getSafeEmailConfigSummary, SmtpEmailProvider } from "../src/modules/email/email.provider.js";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const to = argValue("to") ?? process.env.EMAIL_SMOKE_TO;
  if (!to) {
    console.error("EMAIL_SMOKE_TO or --to=<email> is required");
    process.exitCode = 1;
    return;
  }

  const config = getEmailConfig();
  const provider = new SmtpEmailProvider(config);
  console.info("[email-smoke] mode", getSafeEmailConfigSummary(config));
  console.info("[email-smoke] transport", provider.getSafeTransportSummary());

  let verifyResult = "skipped";
  let verifyError: unknown;
  if (config.enabled && !config.dryRun) {
    try {
      await provider.verify();
      verifyResult = "ok";
    } catch (error) {
      verifyResult = "failed";
      verifyError = error;
    }
  }
  console.info("[email-smoke] verify", {
    result: verifyResult,
    ...(verifyError instanceof Error ? { errorName: verifyError.name, message: verifyError.message } : {}),
  });

  if (verifyError) {
    console.info("[email-smoke] send", { result: "skipped", reason: "verify_failed", messageId: null });
    throw verifyError;
  }

  const result = await new EmailService(provider, config).sendEmail({
    to,
    template: "passwordReset",
    locale: "en",
    critical: true,
    data: {
      otp: "000000",
      expiresIn: "5 minutes",
      resetUrl: "/reset-password",
    },
    metadata: { source: "email-smoke" },
  });

  console.info("[email-smoke] send", {
    sent: result.sent,
    skipped: result.skipped,
    dryRun: result.dryRun,
    template: result.template,
    messageId: result.providerMessageId ?? null,
  });
  process.exit(0);
}

main().catch((error) => {
  console.error("[email-smoke] failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
