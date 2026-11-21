import mongoose from "mongoose";
import Project from "../models/Project.js";

function serializeProject(project) {
  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function listProjects(req, res, next) {
  try {
    const projects = await Project.find({ owner: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({
      success: true,
      projects: projects.map(serializeProject),
    });
  } catch (error) {
    next(error);
  }
}

export async function createProject(req, res, next) {
  try {
    const name = String(req.body.name ?? "").trim();
    const description = String(req.body.description ?? "").trim();

    if (!name || name.length > 80) {
      return res.status(400).json({
        success: false,
        message: "Project name must be between 1 and 80 characters.",
      });
    }

    if (description.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description must be 500 characters or fewer.",
      });
    }

    const project = await Project.create({
      owner: req.user._id,
      name,
      description,
    });

    return res.status(201).json({
      success: true,
      project: serializeProject(project),
    });
  } catch (error) {
    next(error);
  }
}

export async function getProject(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    }).lean();

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.json({
      success: true,
      project: serializeProject(project),
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const updates = {};

    if (Object.hasOwn(req.body, "name")) {
      const name = String(req.body.name ?? "").trim();

      if (!name || name.length > 80) {
        return res.status(400).json({
          success: false,
          message: "Project name must be between 1 and 80 characters.",
        });
      }

      updates.name = name;
    }

    if (Object.hasOwn(req.body, "description")) {
      const description = String(req.body.description ?? "").trim();

      if (description.length > 500) {
        return res.status(400).json({
          success: false,
          message: "Description must be 500 characters or fewer.",
        });
      }

      updates.description = description;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a project name or description to update.",
      });
    }

    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.projectId,
        owner: req.user._id,
      },
      { $set: updates },
      { new: true, runValidators: true },
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.json({
      success: true,
      project: serializeProject(project),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const project = await Project.findOneAndDelete({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    return res.json({
      success: true,
      message: "Project deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
}

export async function saveGeneratedFile(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    const path = String(req.body.path ?? "");
    const content = req.body.content;

    if (
      !path ||
      path.length > 180 ||
      path.startsWith("/") ||
      path.includes("\\") ||
      path.split("/").some((part) => part === ".." || part === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid generated file path.",
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        success: false,
        message: "File content must be a string.",
      });
    }

    if (content.length > 300000) {
      return res.status(413).json({
        success: false,
        message: "File content exceeds the 300,000 character limit.",
      });
    }

    const project = await Project.findOne({
      _id: req.params.projectId,
      owner: req.user._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const file = project.generatedFiles.find((item) => item.path === path);

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "Generated file not found in this project.",
      });
    }

    file.content = content;

    await project.save();

    return res.json({
      success: true,
      message: "File saved successfully.",
      file: {
        path: file.path,
        content: file.content,
      },
    });
  } catch (error) {
    next(error);
  }
}
