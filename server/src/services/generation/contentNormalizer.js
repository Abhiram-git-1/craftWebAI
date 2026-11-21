/**
 * Normalize common model formatting mistakes without changing source semantics.
 * This is deliberately conservative: it removes one outer Markdown fence and
 * decodes escaped line breaks only when the whole response is one-line text.
 */
export function normalizeGeneratedContent(value) {
  if (typeof value !== "string") return "";

  let content = value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();

  const fenced = content.match(
    /^```(?:jsx?|tsx?|css|html|json|javascript|typescript)?[ \t]*\n([\s\S]*?)\n```$/i,
  );
  if (fenced) content = fenced[1].trim();

  // Some providers return a JSON-encoded string instead of raw source.
  if (content.length >= 2 && content.startsWith('"') && content.endsWith('"')) {
    try {
      const decoded = JSON.parse(content);
      if (typeof decoded === "string") content = decoded;
    } catch {
      // Keep the source untouched if it is not a valid JSON string.
    }
  }

  if (!content.includes("\n") && /\\n|\\r|\\t/.test(content)) {
    content = content
      .replace(/\\r\\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }

  return content.trim();
}
