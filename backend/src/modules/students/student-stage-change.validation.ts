import { z } from "zod";

export const changeStageSchema = z.object({
  stageId: z.string().uuid("Invalid stage ID format"),
});

export type ChangeStageInput = z.infer<typeof changeStageSchema>;
