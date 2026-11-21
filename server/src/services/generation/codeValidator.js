/**
 * Generated source validation and conservative repairs.
 *
 * This follows the SiteSphere README's documented pipeline:
 * normalize content, repair JSX class/void-tag mistakes, and reconcile
 * relative imports against the known generated-file tree.
 *
 * Regex-based checks are diagnostics, not a substitute for a real Vite build.
 */

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function normalizeFilePath(value = "") {
  return String(value)
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/\/+/g, "/");
}

function dirname(filePath) {
  const path = normalizeFilePath(filePath);
  const index = path.lastIndexOf("/");
  return index < 0 ? "" : path.slice(0, index);
}

function resolveRelativePath(fromFile, specifier) {
  const segments = `${dirname(fromFile)}/${specifier}`.split("/");
  const resolved = [];
  for (const segment of segments) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (resolved.length) resolved.pop();
      else return null;
    } else {
      resolved.push(segment);
    }
  }
  return resolved.join("/");
}

function candidatesFor(target) {
  return [
    target,
    `${target}.js`,
    `${target}.jsx`,
    `${target}.mjs`,
    `${target}.cjs`,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}.json`,
    `${target}.css`,
    `${target}.scss`,
    `${target}/index.js`,
    `${target}/index.jsx`,
    `${target}/index.mjs`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ];
}

function stripSourceExtension(path) {
  return path.replace(/\.(?:jsx?|mjs|cjs|tsx?|json|css|scss)$/i, "");
}

function relativeSpecifier(fromFile, targetFile, originalSpecifier) {
  const from = dirname(fromFile).split("/").filter(Boolean);
  const to = normalizeFilePath(targetFile).split("/").filter(Boolean);
  while (from.length && to.length && from[0] === to[0]) {
    from.shift();
    to.shift();
  }
  const path = [...from.map(() => ".."), ...to].join("/");
  const hasExplicitExtension = /\.[a-z0-9]+$/i.test(originalSpecifier);
  const value = hasExplicitExtension ? path : stripSourceExtension(path);
  return value.startsWith(".") ? value : `./${value}`;
}

function resolveKnownFile(fromFile, specifier, pathSet) {
  const target = resolveRelativePath(fromFile, specifier);
  if (!target) return null;

  const exact = candidatesFor(target).find((candidate) =>
    pathSet.has(candidate),
  );
  if (exact) return exact;

  // AI models sometimes use the wrong directory but the correct filename.
  // Only repair when the basename is unique in the manifest.
  const requestedBase = target.split("/").pop().toLowerCase();
  const matches = [...pathSet].filter((candidate) => {
    const candidateBase = candidate.split("/").pop().toLowerCase();
    return (
      candidateBase === requestedBase ||
      stripSourceExtension(candidateBase) ===
        stripSourceExtension(requestedBase)
    );
  });
  return matches.length === 1 ? matches[0] : null;
}

function fixClassAttributes(content) {
  return content.replace(/\bclass\s*=/g, "className=");
}

function fixVoidElements(content) {
  return content.replace(
    /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^<>]*?)?>/gi,
    (match, tag, attributes = "") => `<${tag}${attributes} />`,
  );
}

function fixRelativeImports(content, filePath, pathSet, issues) {
  // Covers import/export-from, side-effect imports, dynamic import(), and require().
  const patterns = [
    /(\bfrom\s*)(['"])(\.{1,2}\/[^'"]+)(\2)/g,
    /(\bimport\s*)(['"])(\.{1,2}\/[^'"]+)(\2)/g,
    /(\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)(\2)(\s*\))/g,
    /(\brequire\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)(\2)(\s*\))/g,
  ];

  let output = content;
  for (const pattern of patterns) {
    output = output.replace(
      pattern,
      (match, before, quote, specifier, closingQuote, after = "") => {
        const actual = resolveKnownFile(filePath, specifier, pathSet);
        if (!actual) {
          issues.push({
            severity: "warning",
            code: "UNRESOLVED_RELATIVE_IMPORT",
            file: filePath,
            message: `Could not match relative import "${specifier}" in ${filePath} to a unique file in the generated manifest.`,
          });
          return match;
        }

        const corrected = relativeSpecifier(filePath, actual, specifier);
        if (corrected === specifier) return match;
        issues.push({
          severity: "info",
          code: "IMPORT_PATH_REPAIRED",
          file: filePath,
          message: `Corrected import "${specifier}" to "${corrected}" in ${filePath}.`,
        });
        return `${before}${quote}${corrected}${closingQuote}${after}`;
      },
    );
  }
  return output;
}

function validateFileShape(path, content, issues) {
  if (!content.trim()) {
    issues.push({
      severity: "error",
      code: "EMPTY_FILE",
      file: path,
      message: `${path} is empty.`,
    });
    return;
  }

  if (/\.json$/i.test(path)) {
    try {
      JSON.parse(content);
    } catch (error) {
      issues.push({
        severity: "error",
        code: "INVALID_JSON",
        file: path,
        message: `${path} contains invalid JSON: ${error.message}`,
      });
    }
  }

  if (/\.(?:jsx|tsx)$/i.test(path)) {
    // A conservative diagnostic only; JSX syntax needs a compiler for certainty.
    const openTags = (
      content.match(/<[A-Za-z][\w.-]*(?:\s[^<>]*?)?>/g) || []
    ).filter(
      (tag) =>
        !/\/>$/.test(tag) &&
        !new RegExp(`^<(${[...VOID_TAGS].join("|")})(\\s|>)`, "i").test(tag),
    );
    const closeTags = content.match(/<\/[A-Za-z][\w.-]*\s*>/g) || [];
    if (openTags.length > closeTags.length + 2) {
      issues.push({
        severity: "warning",
        code: "POSSIBLE_UNCLOSED_JSX",
        file: path,
        message: `The JSX tag count in ${path} looks unbalanced. Confirm this file in the live preview.`,
      });
    }
  }
}

export function validateAndFixCode(file, allFiles = []) {
  const path = normalizeFilePath(file?.path || "unknown.js");
  const original = String(file?.content ?? "");
  const issues = [];
  let content = original;

  if (!content.trim()) {
    validateFileShape(path, content, issues);
    return { path, content, issues, changed: false, valid: false };
  }

  content = fixClassAttributes(content);
  content = fixVoidElements(content);

  const pathSet = new Set(
    (Array.isArray(allFiles) ? allFiles : [])
      .map((item) =>
        normalizeFilePath(typeof item === "string" ? item : item?.path),
      )
      .filter(Boolean),
  );
  if (pathSet.size)
    content = fixRelativeImports(content, path, pathSet, issues);

  validateFileShape(path, content, issues);

  return {
    path,
    content,
    issues,
    changed: content !== original,
    valid: !issues.some((issue) => issue.severity === "error"),
  };
}

export function validateGeneratedFiles(files = [], manifest = []) {
  const safeFiles = Array.isArray(files) ? files : [];
  const normalized = safeFiles.map((file) => ({
    path: normalizeFilePath(file?.path || ""),
    content: String(file?.content ?? ""),
  }));
  const manifestPaths = (Array.isArray(manifest) ? manifest : [])
    .map((entry) =>
      normalizeFilePath(typeof entry === "string" ? entry : entry?.path),
    )
    .filter(Boolean);
  const pathSet = new Set(normalized.map((file) => file.path));

  const results = normalized.map((file) =>
    validateAndFixCode(file, manifestPaths.length ? manifestPaths : normalized),
  );
  const issues = results.flatMap((result) => result.issues);

  for (const requiredPath of manifestPaths) {
    if (!pathSet.has(requiredPath)) {
      issues.push({
        severity: "error",
        code: "MISSING_MANIFEST_FILE",
        file: requiredPath,
        message: `The planned file ${requiredPath} was not generated.`,
      });
    }
  }

  const repairedFiles = results.map(({ path, content }) => ({ path, content }));
  const changedFiles = results
    .filter((result) => result.changed)
    .map((result) => result.path);
  const errorCount = issues.filter(
    (issue) => issue.severity === "error",
  ).length;
  const warningCount = issues.filter(
    (issue) => issue.severity === "warning",
  ).length;

  return {
    files: repairedFiles,
    issues,
    changedFiles,
    valid: errorCount === 0,
    summary: {
      fileCount: repairedFiles.length,
      changedFileCount: changedFiles.length,
      errorCount,
      warningCount,
      infoCount: issues.filter((issue) => issue.severity === "info").length,
    },
  };
}
