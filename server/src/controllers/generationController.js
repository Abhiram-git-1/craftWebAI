import mongoose from "mongoose";
import Project from "../models/Project.js";
import {
  createWebsitePlan,
  generateWebsiteFiles,
} from "../services/generation/generationService.js";

async function findOwnedProject(projectId, ownerId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  return Project.findOne({ _id: projectId, owner: ownerId });
}

export async function generatePlan(req, res, next) {
  try {
    const prompt = String(req.body.prompt ?? "").trim();
    if (prompt.length < 20 || prompt.length > 6000) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Describe your website in at least 20 characters (maximum 6,000).",
        });
    }

    const project = await findOwnedProject(req.params.projectId, req.user._id);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });

    const plan = await createWebsitePlan(prompt);
    project.generationPrompt = prompt;
    project.generationPlan = plan;
    project.generatedFiles = [];
    project.generationError = "";
    project.generationIssues = [];
    project.status = "planned";
    project.generatedAt = null;
    await project.save();

    return res.json({
      success: true,
      message: "Website plan created. Review it before generating files.",
      plan,
    });
  } catch (error) {
    next(error);
  }
}

export async function generateFiles(req, res, next) {
  try {
    const project = await findOwnedProject(req.params.projectId, req.user._id);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });
    if (!project.generationPrompt || !project.generationPlan) {
      return res
        .status(409)
        .json({
          success: false,
          message: "Create a website plan before generating files.",
        });
    }

    project.status = "generating";
    project.generationError = "";
    project.generationIssues = [];
    await project.save();

    try {
      const { files, validation } = await generateWebsiteFiles(
        project.generationPrompt,
        project.generationPlan,
        {
          existingFiles: project.generatedFiles,
          onBatchSaved: async (savedFiles) => {
            project.generatedFiles = savedFiles;
            project.generationError = "";
            await project.save();
          },
        },
      );

      project.generatedFiles = files;
      project.status = "generated";
      project.generationError = "";
      project.generationIssues = validation.issues;
      project.generatedAt = new Date();
      await project.save();

      return res.json({
        success: true,
        message: "Website source files generated and saved.",
        fileCount: files.length,
        validation: {
          ...validation.summary,
          valid: validation.valid,
          changedFiles: validation.changedFiles,
          issues: validation.issues,
        },
        files: files.map(({ path, content }) => ({
          path,
          size: Buffer.byteLength(content, "utf8"),
        })),
      });
    } catch (error) {
      // Keep any files saved by completed batches. A later retry resumes with only missing files.
      project.status = "generation_failed";
      project.generationError = String(
        error.message || "Generation failed",
      ).slice(0, 1000);
      await project.save();
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

export async function getGeneration(req, res, next) {
  try {
    const project = await findOwnedProject(req.params.projectId, req.user._id);
    if (!project)
      return res
        .status(404)
        .json({ success: false, message: "Project not found." });

    return res.json({
      success: true,
      generation: {
        status: project.status,
        prompt: project.generationPrompt,
        plan: project.generationPlan,
        files: project.generatedFiles.map(({ path, content }) => ({
          path,
          content,
          size: Buffer.byteLength(content, "utf8"),
        })),
        error: project.generationError,
        issues: project.generationIssues || [],
        generatedAt: project.generatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}
