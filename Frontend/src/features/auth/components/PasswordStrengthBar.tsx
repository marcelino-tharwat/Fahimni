import { cn } from "@/shared/lib/utils/cn";

function getPasswordStrength(
  password: string,
): { score: number; label: string; color: string; bg: string } | null {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return null;
  if (score === 2)
    return { score: 25, label: "Weak", color: "text-danger", bg: "bg-danger" };
  if (score === 3)
    return {
      score: 50,
      label: "Fair",
      color: "text-warning",
      bg: "bg-warning",
    };
  if (score === 4)
    return { score: 75, label: "Good", color: "text-accent", bg: "bg-accent" };
  return {
    score: 100,
    label: "Strong",
    color: "text-success",
    bg: "bg-success",
  };
}

interface PasswordStrengthBarProps {
  password: string;
}

export function PasswordStrengthBar({ password }: PasswordStrengthBarProps) {
  const strength = getPasswordStrength(password);
  if (!strength) return null;

  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-300", strength.bg)}
          style={{ width: `${strength.score}%` }}
        />
      </div>
      <span className={cn("font-cairo text-xs font-medium", strength.color)}>
        {strength.label}
      </span>
    </div>
  );
}
