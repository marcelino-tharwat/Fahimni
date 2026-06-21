import { Router } from "express";
import { StudentController } from "./student.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  createStudentSchema,
  updateStudentSchema,
} from "./student.validation.js";

const router = Router();
const controller = new StudentController();

router.get(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.list,
);
router.get(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getById,
);
router.post(
  "/",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(createStudentSchema),
  controller.create,
);
router.patch(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  validateRequest(updateStudentSchema),
  controller.update,
);
router.delete(
  "/:id",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.delete,
);

export default router;
