import { Router } from "express";

import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
  saveGeneratedFile,
} from "../controllers/projectController.js";

import { requireAuth } from "../middleware/requireAuth.js";
import generationRoutes from "./generationRoutes.js";

const router = Router();

router.use(requireAuth);

router.route("/").get(listProjects).post(createProject);

router.use("/:projectId/generation", generationRoutes);

// Save an existing generated file.
router.patch("/:projectId/files", saveGeneratedFile);

router
  .route("/:projectId")
  .get(getProject)
  .patch(updateProject)
  .delete(deleteProject);

export default router;
