import { Router } from "express";
import { StudentController } from "./student.controller.js";
import { validateRequest } from "../../shared/middlewares/validate.middleware.js";
import {
  createStudentSchema,
  updateStudentSchema,
} from "./student.validation.js";

const router = Router();
const controller = new StudentController();

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", validateRequest(createStudentSchema), controller.create);
router.patch("/:id", validateRequest(updateStudentSchema), controller.update);
router.delete("/:id", controller.delete);

export default router;
