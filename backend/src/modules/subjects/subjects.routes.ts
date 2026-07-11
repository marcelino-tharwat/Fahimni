import { Router, type Request, type Response } from "express";
import { getActiveSubjects } from "./subjects.js";

const router = Router();

/**
 * GET /api/subjects
 *
 * Public endpoint — no authentication required.
 * Returns the list of active subjects for use in dropdowns.
 */
router.get("/", (_req: Request, res: Response) => {
  res.json({ data: getActiveSubjects() });
});

export default router;
