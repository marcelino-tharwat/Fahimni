import { EmailService } from "../src/modules/email/email.service.js";
import { getEmailConfig, getSafeEmailConfigSummary } from "../src/modules/email/email.provider.js";

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
  console.info("[email-smoke] config", getSafeEmailConfigSummary(config));

  const result = await new EmailService(undefined, config).sendEmail({
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

  console.info("[email-smoke] result", {
    sent: result.sent,
    skipped: result.skipped,
    dryRun: result.dryRun,
    template: result.template,
    ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}),
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
