import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(64, "JWT_SECRET must be at least 64 characters"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(64, "JWT_REFRESH_SECRET must be at least 64 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  ADMIN_EMAIL: z.string().email().default("admin@example.com"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin@123456"),
  ADMIN_FULL_NAME: z.string().min(2).default("System Administrator"),
  ADMIN_MOBILE: z
    .string()
    .regex(/^01[0-9]{9}$/)
    .default("01000000000"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),
  SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_BUCKET_NAME: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_GENERATION_MODEL: z.string().default("gemini-2.0-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  // STORY-64: max accepted AI-tutor questions per student per UTC calendar day.
  AI_TUTOR_DAILY_QUERY_LIMIT: z.coerce.number().int().positive().default(20),
  // STORY-69: bounded tutor chat persistence and context windows.
  TUTOR_CHAT_MAX_MESSAGE_CHARS: z.coerce.number().int().positive().default(500),
  TUTOR_CHAT_RECENT_MESSAGE_LIMIT: z.coerce.number().int().positive().default(16),
  TUTOR_CHAT_CONVERSATION_PAGE_SIZE: z.coerce.number().int().positive().default(20),
  TUTOR_CHAT_MESSAGE_PAGE_SIZE: z.coerce.number().int().positive().default(30),
  // STORY-45 canonical quiz-generation budgets: total 25s, Gemini call 20s
  // (Gemini timeout must stay < total). Configurable for ops tuning.
  QUIZ_GENERATION_TIMEOUT_MS: z.coerce.number().int().positive().default(25_000),
  QUIZ_GENERATION_GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  PAYMOB_API_KEY: z.string().min(1),
  PAYMOB_INTEGRATION_ID: z.coerce.number().positive(),
  PAYMOB_IFRAME_ID: z.string().min(1),
  PAYMOB_HMAC_SECRET: z.string().min(1),
  PAYMOB_CURRENCY: z.string().min(1).default("EGP"),
  PAYMOB_BASE_URL: z.string().url().default("https://accept.paymob.com"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  FRONTEND_BASE_URL: z.string().url().default("http://localhost:5173"),
  TUTOR_RAG_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0),
  TUTOR_RAG_MAX_CHUNKS: z.coerce.number().int().positive().default(5),
});

export const env = envSchema.parse(process.env);
