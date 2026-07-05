-- Additive, backward-compatible quiz result-visibility settings.
-- Existing quizzes keep result_settings_configured = false and therefore
-- retain the exact legacy result behavior (nothing is hidden). The nullable
-- boolean columns and the pending-essay mode only take effect after a teacher
-- explicitly saves settings. No existing column is dropped, renamed, or altered.

CREATE TYPE "PendingEssayResultMode" AS ENUM (
  'HIDE_ALL_RESULTS',
  'SHOW_OBJECTIVE_ONLY',
  'SHOW_OBJECTIVE_WITH_PENDING_MESSAGE'
);

ALTER TABLE "quizzes"
  ADD COLUMN "result_settings_configured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "show_correct_answers" BOOLEAN,
  ADD COLUMN "show_per_question_scores" BOOLEAN,
  ADD COLUMN "show_final_score" BOOLEAN,
  ADD COLUMN "show_student_answers" BOOLEAN,
  ADD COLUMN "show_explanations" BOOLEAN,
  ADD COLUMN "pending_essay_result_mode" "PendingEssayResultMode";
