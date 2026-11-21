import { Router } from "express";
import {
  generateFiles,
  generatePlan,
  getGeneration,
} from "../controllers/generationController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router({ mergeParams: true });
router.use(requireAuth);
router.post("/plan", generatePlan);
router.post("/generate", generateFiles);
router.get("/", getGeneration);
export default router;
