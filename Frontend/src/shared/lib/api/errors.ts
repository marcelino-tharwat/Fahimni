import type { AxiosError } from "axios";

interface ApiErrorData {
  message?: string | string[];
  errors?: Record<string, string[]>;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const axiosError = error as AxiosError<ApiErrorData>;
  const raw = axiosError.response?.data?.message;
  if (Array.isArray(raw)) return raw[0];
  return raw ?? fallback;
}

export function getApiFieldErrors(
  error: unknown,
): Record<string, string> {
  const axiosError = error as AxiosError<ApiErrorData>;
  const fieldErrors = axiosError.response?.data?.errors;
  if (!fieldErrors) return {};
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, msgs]) => [key, msgs[0]]),
  );
}
