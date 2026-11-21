import mongoose from "mongoose";

const generatedFileSchema = new mongoose.Schema(
  {
    path: { type: String, required: true, maxlength: 180 },
    content: { type: String, required: true, maxlength: 300000 },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    status: {
      type: String,
      enum: [
        "draft",
        "planned",
        "generating",
        "generated",
        "generation_failed",
      ],
      default: "draft",
    },
    generationPrompt: { type: String, maxlength: 6000, default: "" },
    generationPlan: { type: mongoose.Schema.Types.Mixed, default: null },
    generatedFiles: { type: [generatedFileSchema], default: [] },
    generationError: { type: String, maxlength: 1000, default: "" },
    generationIssues: { type: [mongoose.Schema.Types.Mixed], default: [] },
    generatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ owner: 1, updatedAt: -1 });

const Project = mongoose.model("Project", projectSchema);
export default Project;
