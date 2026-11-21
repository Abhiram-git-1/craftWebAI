import { requestAIJson, requestAIText } from "../ai/aiClient.js";
import { planSchema } from "../../validators/generationSchemas.js";
import { normalizeGeneratedContent } from "./contentNormalizer.js";
import { validateGeneratedFiles } from "./codeValidator.js";

const PLAN_SYSTEM = `You are a senior product designer and frontend architect. Create a practical implementation plan for a responsive React + Vite website. Return only JSON with this shape: {"siteName":"string","summary":"string","design":{"style":"string","colorPalette":["string","string"],"typography":"string","layout":"string"},"pages":[{"name":"string","path":"string","purpose":"string"}],"components":[{"name":"string","purpose":"string"}],"features":["string"],"fileManifest":[{"path":"string","purpose":"string"}]}. Use JavaScript/JSX, safe relative paths, include package.json, index.html, src/main.jsx, src/App.jsx and src/index.css, maximum 20 files. Avoid unnecessary files and external image dependencies.`;

function fail(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validatePath(path) {
  return (
    typeof path === "string" &&
    path.length > 0 &&
    path.length <= 180 &&
    !path.startsWith("/") &&
    !path.includes("\\") &&
    !path.includes("\0") &&
    path.split("/").every((part) => part && part !== "." && part !== "..")
  );
}

function buildRelevantContext(file, manifest, fileMap) {
  const allPaths = manifest.map((entry) => entry.path);
  const generated = [...fileMap.entries()];
  // Include short, structurally important files first, then the most recent files.
  const priority = [
    "package.json",
    "src/main.jsx",
    "src/App.jsx",
    "src/index.css",
    "index.html",
  ];
  generated.sort(([a], [b]) => {
    const ai = priority.indexOf(a);
    const bi = priority.indexOf(b);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });
  let budget = 14000;
  const context = [];
  for (const [path, fileEntry] of generated) {
    if (path === file.path || budget <= 0) continue;
    // fileMap stores { path, content } objects, not raw strings.
    const content =
      typeof fileEntry === "string" ? fileEntry : fileEntry?.content;
    if (typeof content !== "string") continue;
    const snippet = content.slice(0, Math.min(content.length, budget));
    context.push(`--- ${path} ---\n${snippet}`);
    budget -= snippet.length;
  }
  return `Planned project files:\n${allPaths.join("\n")}\n\nExisting source context (may be truncated):\n${context.join("\n\n") || "No files generated yet."}`;
}

async function generateOneFile(file, prompt, plan, manifest, fileMap) {
  const system = `You are a senior React and Vite engineer. Write exactly one complete source file. Return raw file contents only, not JSON, not Markdown fences, and do not explain your answer. The backend already knows the file path. Keep implementation focused and concise while fully implementing the file purpose. Match existing imports, exports, component names, props, design palette and conventions. Never import a file that is not in the planned manifest. Do not use TODOs, placeholder text, or omit required code. For JSX use valid React JavaScript. For CSS provide valid CSS. For package.json provide valid JSON.`;
  const context = buildRelevantContext(file, manifest, fileMap);
  const userPrompt = `WEBSITE REQUEST:\n${prompt}\n\nAPPROVED PLAN:\n${JSON.stringify(plan)}\n\nFILE TO WRITE: ${file.path}\nPURPOSE: ${file.purpose}\n\n${context}\n\nReturn the complete contents of ${file.path} only.`;

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const raw = await requestAIText({
        system:
          attempt === 1
            ? system
            : `${system}\nRetry instruction: produce a smaller, simpler complete implementation. Avoid verbose comments and decorative complexity.`,
        prompt:
          attempt === 1
            ? userPrompt
            : `${userPrompt}\n\nThis is retry ${attempt}. Keep the file concise and ensure the output is complete.`,
        maxTokens: attempt === 1 ? 12000 : 8000,
      });
      const content = normalizeGeneratedContent(raw);
      if (!content)
        throw fail(`The model returned empty source for ${file.path}.`);
      if (content.length > 280000)
        throw fail(`Generated file ${file.path} exceeds the allowed size.`);
      if (
        content.includes("Generation failed") ||
        content.includes("TODO: implement")
      ) {
        throw fail(
          `Generated file ${file.path} contains an incomplete placeholder.`,
        );
      }
      if (file.path.endsWith(".json")) {
        try {
          JSON.parse(content);
        } catch {
          throw fail(`Generated ${file.path} is not valid JSON.`);
        }
      }
      return { path: file.path, content };
    } catch (error) {
      lastError = error;
      console.warn(
        `[Generation] ${file.path} attempt ${attempt}/3 failed: ${error.message}`,
      );
      if (attempt < 3)
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  throw fail(
    `Could not generate ${file.path} after 3 attempts. Last error: ${lastError?.message || "Unknown error"}`,
  );
}

export async function createWebsitePlan(prompt) {
  const raw = await requestAIJson({
    system: PLAN_SYSTEM,
    prompt: `Create a website implementation plan for:\n${prompt}`,
    maxTokens: 5000,
  });
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success)
    throw fail(
      `AI plan failed validation: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
    );
  const paths = parsed.data.fileManifest.map((file) => file.path);
  if (new Set(paths).size !== paths.length)
    throw fail(
      "The plan contains duplicate file paths. Create the plan again.",
    );
  if (paths.some((path) => !validatePath(path)))
    throw fail("The plan contains an unsafe file path. Create the plan again.");
  return parsed.data;
}

export async function generateWebsiteFiles(prompt, plan, options = {}) {
  const { existingFiles = [], onBatchSaved = async () => {} } = options;
  const manifest = plan.fileManifest;
  if (!Array.isArray(manifest) || manifest.length === 0)
    throw fail("The website plan has no files to generate.", 400);
  const fileMap = new Map();
  for (const file of existingFiles) {
    if (
      manifest.some((entry) => entry.path === file.path) &&
      typeof file.content === "string" &&
      file.content.trim()
    ) {
      fileMap.set(file.path, { path: file.path, content: file.content });
    }
  }

  // Sequential generation is deliberate: each completed file becomes context for the next file,
  // and the provider is not flooded with parallel requests on a free endpoint.
  for (const file of manifest) {
    if (fileMap.has(file.path)) continue;
    if (!validatePath(file.path))
      throw fail(`Unsafe file path in plan: ${file.path}`);
    console.log(
      `[Generation] Creating ${file.path} (${fileMap.size + 1}/${manifest.length})`,
    );
    const generated = await generateOneFile(
      file,
      prompt,
      plan,
      manifest,
      fileMap,
    );
    fileMap.set(generated.path, generated);
    const saved = manifest
      .filter((entry) => fileMap.has(entry.path))
      .map((entry) => fileMap.get(entry.path));
    await onBatchSaved(saved);
  }

  const missing = manifest
    .filter((entry) => !fileMap.has(entry.path))
    .map((entry) => entry.path);
  if (missing.length)
    throw fail(`Generation incomplete. Missing files: ${missing.join(", ")}`);

  const generatedFiles = manifest.map((entry) => fileMap.get(entry.path));
  const validation = validateGeneratedFiles(generatedFiles, manifest);

  // Persist the normalized and repaired version, not the unvalidated model output.
  await onBatchSaved(validation.files);
  return { files: validation.files, validation };
}
