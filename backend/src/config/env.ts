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
});

export const env = envSchema.parse(process.env);
