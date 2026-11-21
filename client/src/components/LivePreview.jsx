import { useMemo, useState } from "react";
import {
  RefreshCw,
  Smartphone,
  Monitor,
  Tablet,
  AlertTriangle,
} from "lucide-react";

import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
} from "@codesandbox/sandpack-react";

/**
 * Normalize generated file paths.
 */
function normalizePath(path) {
  return String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^\.\//, "");
}

function cleanGeneratedSource(content, filePath) {
  let source = String(content || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");

  // Remove Markdown code fences if the AI included them.
  source = source.replace(
    /^\s*```(?:jsx?|tsx?|javascript|typescript)?\s*\n/i,
    "",
  );

  source = source.replace(/\n```\s*$/, "");

  // Remove a filename accidentally included as the first line.
  const firstLine = source.split("\n", 1)[0].trim();

  if (normalizePath(firstLine) === normalizePath(filePath)) {
    source = source.slice(source.indexOf("\n") + 1);
  }

  return source;
}

/**
 * Resolve a relative import against the generated file manifest.
 */
function resolveLocalImport(importerPath, importPath, filePaths) {
  let target;

  if (importPath.startsWith("@/")) {
    target = normalizePath(`src/${importPath.slice(2)}`);
  } else if (importPath.startsWith("/")) {
    target = normalizePath(importPath);
  } else {
    const parts = normalizePath(importerPath).split("/");
    parts.pop();

    for (const part of importPath.split("/")) {
      if (!part || part === ".") continue;

      if (part === "..") {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    target = parts.join("/");
  }

  const extensions = [
    "",
    ".jsx",
    ".js",
    ".tsx",
    ".ts",
    ".css",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
  ];

  const candidates = extensions.map((extension) => target + extension);

  candidates.push(
    `${target}/index.jsx`,
    `${target}/index.js`,
    `${target}/index.tsx`,
    `${target}/index.ts`,
  );

  // First, use the exact resolved path.
  const exact = candidates.find((candidate) => filePaths.has(candidate));

  if (exact) return exact;

  // Recovery for imports containing an incorrect number of ../ segments.
  const matches = [...filePaths].filter((filePath) =>
    candidates.some((candidate) => filePath.endsWith("/" + candidate)),
  );

  // Never guess if multiple assets match.
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Convert an absolute generated file path into a relative import.
 */
function makeRelativeImport(importerPath, targetPath) {
  const from = normalizePath(importerPath).split("/");
  from.pop();

  const to = normalizePath(targetPath).split("/");

  while (from.length && to.length && from[0] === to[0]) {
    from.shift();
    to.shift();
  }

  const result = [...from.map(() => ".."), ...to].join("/");

  return result.startsWith(".") ? result : `./${result}`;
}

/**
 * Repair local imports only when their target can be identified safely.
 */
function repairImports(source, importerPath, filePaths) {
  const replaceImport = (importPath) => {
    if (
      !importPath.startsWith(".") &&
      !importPath.startsWith("/") &&
      !importPath.startsWith("@/")
    ) {
      return importPath;
    }

    const resolved = resolveLocalImport(importerPath, importPath, filePaths);

    if (!resolved) {
      return importPath;
    }

    return makeRelativeImport(importerPath, resolved);
  };

  // Static imports and re-exports.
  let result = source.replace(
    /(\bfrom\s*|\bimport\s*)(['"])([^'"]+)\2/g,
    (match, prefix, quote, importPath) => {
      return `${prefix}${quote}${replaceImport(importPath)}${quote}`;
    },
  );

  // Dynamic imports.
  result = result.replace(
    /\bimport\(\s*(['"])([^'"]+)\1\s*\)/g,
    (match, quote, importPath) => {
      return `import(${quote}${replaceImport(importPath)}${quote})`;
    },
  );

  return result;
}

/**
 * Detect external npm dependencies from generated source files.
 */
function detectDependencies(files) {
  const dependencies = {};

  const importPattern = /(?:\bfrom\s*|\bimport\s*)(['"])([^'"]+)\1/g;

  for (const source of Object.values(files)) {
    let match;

    while ((match = importPattern.exec(source)) !== null) {
      const importPath = match[2];

      // Local imports are not npm packages.
      if (
        importPath.startsWith(".") ||
        importPath.startsWith("/") ||
        importPath.startsWith("@/") ||
        importPath.startsWith("http:")
      ) {
        continue;
      }

      const packageName = importPath.startsWith("@")
        ? importPath.split("/").slice(0, 2).join("/")
        : importPath.split("/")[0];

      if (
        packageName &&
        packageName !== "react" &&
        packageName !== "react-dom"
      ) {
        dependencies[packageName] = "latest";
      }
    }
  }

  return dependencies;
}

/**
 * Prepare generated files for Sandpack.
 */
function prepareSandpackFiles(generatedFiles) {
  const originalFiles = {};

  for (const file of generatedFiles) {
    if (
      !file ||
      typeof file.path !== "string" ||
      typeof file.content !== "string"
    ) {
      continue;
    }

    const path = normalizePath(file.path);

    if (!path) continue;

    originalFiles[path] = cleanGeneratedSource(file.content, path);
  }

  const filePaths = new Set(Object.keys(originalFiles));
  const preparedFiles = {};

  for (const [path, content] of Object.entries(originalFiles)) {
    const isJavaScript = /\.(jsx?|tsx?)$/i.test(path);

    const repairedContent = isJavaScript
      ? repairImports(content, path, filePaths)
      : content;

    preparedFiles[`/${path}`] = {
      code: repairedContent,
    };
  }

  // Sandpack's React template expects src/index.js.
  // Our generated Vite projects normally use src/main.jsx.
  if (
    !filePaths.has("src/index.js") &&
    !filePaths.has("src/index.jsx") &&
    !filePaths.has("src/index.tsx")
  ) {
    if (filePaths.has("src/main.jsx")) {
      preparedFiles["/src/index.js"] = {
        code: "import './main.jsx';",
      };
    } else if (filePaths.has("src/main.js")) {
      preparedFiles["/src/index.js"] = {
        code: "import './main.js';",
      };
    } else {
      throw new Error(
        "The generated website needs src/main.jsx or src/main.js.",
      );
    }
  }

  return preparedFiles;
}

export default function LivePreview({ files = [] }) {
  const [device, setDevice] = useState("desktop");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSafety, setShowSafety] = useState(false);

  const preparedFiles = useMemo(() => prepareSandpackFiles(files), [files]);

  const dependencies = useMemo(
    () =>
      detectDependencies(
        Object.fromEntries(
          Object.entries(preparedFiles).map(([path, file]) => [
            path,
            file.code,
          ]),
        ),
      ),
    [preparedFiles],
  );

  const deviceClass = `preview-${device}`;

  return (
    <section className="live-preview-panel">
      <div className="live-preview-toolbar">
        <div className="preview-toolbar-label">
          <span className="preview-live-dot" />
          <strong>Live preview</strong>
          <span className="preview-isolation-label">Sandpack runtime</span>
        </div>

        <div className="preview-toolbar-actions">
          <button
            type="button"
            className={
              device === "desktop" ? "preview-tool active" : "preview-tool"
            }
            onClick={() => setDevice("desktop")}
            aria-label="Desktop preview"
          >
            <Monitor size={16} />
          </button>

          <button
            type="button"
            className={
              device === "tablet" ? "preview-tool active" : "preview-tool"
            }
            onClick={() => setDevice("tablet")}
            aria-label="Tablet preview"
          >
            <Tablet size={16} />
          </button>

          <button
            type="button"
            className={
              device === "mobile" ? "preview-tool active" : "preview-tool"
            }
            onClick={() => setDevice("mobile")}
            aria-label="Mobile preview"
          >
            <Smartphone size={16} />
          </button>

          <button
            type="button"
            className="preview-tool"
            onClick={() => setRefreshKey((value) => value + 1)}
            aria-label="Refresh preview"
          >
            <RefreshCw size={16} />
          </button>

          <button
            type="button"
            className="preview-tool"
            onClick={() => setShowSafety((value) => !value)}
            aria-label="Preview safety information"
          >
            <AlertTriangle size={16} />
          </button>
        </div>
      </div>

      {showSafety && (
        <p className="preview-safety-note">
          Generated code runs in an isolated Sandpack preview environment. This
          is intended for development and testing, not as a production-grade
          security boundary. Public deployments should use stronger server-side
          isolation.
        </p>
      )}

      <div className="preview-stage">
        <div key={refreshKey} className={`preview-frame ${deviceClass}`}>
          <SandpackProvider
            template="react"
            files={preparedFiles}
            customSetup={{
              dependencies,
            }}
            options={{
              externalResources: [
                "https://cdn.tailwindcss.com",
                "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
              ],
              logLevel: 0,
            }}
          >
            <SandpackLayout>
              <SandpackPreview
                showNavigator={false}
                showRefreshButton={true}
                showOpenInCodeSandbox={false}
                showSandpackErrorOverlay={true}
                style={{
                  height: 680,
                  width: "100%",
                }}
              />
            </SandpackLayout>
          </SandpackProvider>
        </div>
      </div>
    </section>
  );
}
