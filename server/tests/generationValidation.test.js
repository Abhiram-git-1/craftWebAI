import test from "node:test";
import assert from "node:assert/strict";
import { normalizeGeneratedContent } from "../src/services/generation/contentNormalizer.js";
import {
  validateAndFixCode,
  validateGeneratedFiles,
} from "../src/services/generation/codeValidator.js";

test("normalizer removes one outer markdown fence", () => {
  assert.equal(
    normalizeGeneratedContent("```jsx\nconst App = () => <div />;\n```"),
    "const App = () => <div />;",
  );
});

test("validator fixes JSX class and void element syntax", () => {
  const result = validateAndFixCode(
    {
      path: "src/App.jsx",
      content: '<div class="app"><img src="/logo.png"></div>',
    },
    ["src/App.jsx"],
  );
  assert.match(result.content, /className="app"/);
  assert.match(result.content, /<img src="\/logo\.png" \/>/);
  assert.equal(result.changed, true);
});

test("validator repairs a wrong relative directory when filename is unique", () => {
  const files = [
    {
      path: "src/App.jsx",
      content: "import Hero from './pages/Hero'; export default Hero;",
    },
    {
      path: "src/components/Hero.jsx",
      content: "export default function Hero() { return null; }",
    },
  ];
  const result = validateGeneratedFiles(
    files,
    files.map(({ path }) => ({ path })),
  );
  assert.match(result.files[0].content, /from '\.\/components\/Hero'/);
  assert.ok(result.changedFiles.includes("src/App.jsx"));
  assert.ok(
    result.issues.some((issue) => issue.code === "IMPORT_PATH_REPAIRED"),
  );
});

test("validator warns instead of guessing when an import cannot be matched", () => {
  const files = [
    {
      path: "src/App.jsx",
      content: "import Home from './pages/Home'; export default Home;",
    },
  ];
  const result = validateGeneratedFiles(files, [{ path: "src/App.jsx" }]);
  assert.ok(
    result.issues.some((issue) => issue.code === "UNRESOLVED_RELATIVE_IMPORT"),
  );
  assert.equal(result.valid, true);
});

test("validator reports missing manifest files and invalid JSON", () => {
  const result = validateGeneratedFiles(
    [{ path: "package.json", content: "{ invalid json" }],
    [{ path: "package.json" }, { path: "src/main.jsx" }],
  );
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_JSON"));
  assert.ok(
    result.issues.some((issue) => issue.code === "MISSING_MANIFEST_FILE"),
  );
});
