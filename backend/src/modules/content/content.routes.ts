import { Router } from "express";
import { ContentController } from "./content.controller.js";
import { authenticateMiddleware } from "../../shared/middlewares/authenticate.middleware.js";
import { authorizeMiddleware } from "../../shared/middlewares/authorize.middleware.js";

const router = Router();
const controller = new ContentController();

router.get(
  "/tree",
  authenticateMiddleware,
  authorizeMiddleware("OPERATION"),
  controller.getTree,
);

export default router;
