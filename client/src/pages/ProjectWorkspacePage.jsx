import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";

import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  FileCode2,
  LoaderCircle,
  Sparkles,
  Eye,
  RefreshCw,
  Save,
  AlertCircle,
} from "lucide-react";

import {
  fetchGeneration,
  generateWebsite,
  requestWebsitePlan,
} from "../services/generationService.js";

import { saveGeneratedFile } from "../services/projectService.js";

import LivePreview from "../components/LivePreview.jsx";

function getLanguage(path = "") {
  const extension = path.split(".").pop()?.toLowerCase();

  const languages = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    md: "markdown",
    svg: "xml",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml",
  };

  return languages[extension] || "plaintext";
}

export default function ProjectWorkspacePage({ project, onBack }) {
  const [prompt, setPrompt] = useState("");
  const [generation, setGeneration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [activeFile, setActiveFile] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("code");

  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let alive = true;

    fetchGeneration(project.id)
      .then((data) => {
        if (!alive) return;

        setGeneration(data);
        setPrompt(data.prompt || "");

        if (data.files?.length) {
          setActiveFile(data.files[0].path);
        }

        setDrafts({});
      })
      .catch((requestError) => {
        if (alive) {
          setError(
            requestError.response?.data?.message ||
              "Could not load generation details.",
          );
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [project.id]);

  async function handlePlan(event) {
    event.preventDefault();

    setWorking(true);
    setError("");

    try {
      const plan = await requestWebsitePlan(project.id, prompt);

      setGeneration((current) => ({
        ...current,
        status: "planned",
        prompt,
        plan,
        files: [],
      }));

      setDrafts({});
      setActiveFile("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not create a website plan.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function handleGenerate() {
    setWorking(true);
    setError("");

    try {
      await generateWebsite(project.id);

      const updated = await fetchGeneration(project.id);

      setGeneration(updated);
      setDrafts({});

      if (updated.files?.length) {
        setActiveFile(updated.files[0].path);
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Website generation failed.",
      );

      try {
        setGeneration(await fetchGeneration(project.id));
      } catch {
        // Keep the original error visible.
      }
    } finally {
      setWorking(false);
    }
  }

  const selectedFile = generation?.files?.find(
    (file) => file.path === activeFile,
  );

  const hasFiles = (generation?.files?.length || 0) > 0;

  const editorValue = selectedFile
    ? (drafts[selectedFile.path] ?? selectedFile.content)
    : "";

  const isDirty = selectedFile
    ? Object.hasOwn(drafts, selectedFile.path) &&
      drafts[selectedFile.path] !== selectedFile.content
    : false;

  const dirtyCount = useMemo(() => {
    if (!generation?.files) return 0;

    return generation.files.filter(
      (file) =>
        Object.hasOwn(drafts, file.path) && drafts[file.path] !== file.content,
    ).length;
  }, [generation?.files, drafts]);

  function handleEditorChange(value) {
    if (!selectedFile) return;

    setDrafts((current) => ({
      ...current,
      [selectedFile.path]: value ?? "",
    }));

    setSaveMessage("");
    setSaveError("");
  }

  async function handleSave() {
    if (!selectedFile || !isDirty || saving) return;

    setSaving(true);
    setSaveMessage("");
    setSaveError("");

    try {
      const savedFile = await saveGeneratedFile(
        project.id,
        selectedFile.path,
        editorValue,
      );

      setGeneration((current) => ({
        ...current,
        files: current.files.map((file) =>
          file.path === savedFile.path
            ? { ...file, content: savedFile.content }
            : file,
        ),
      }));

      setDrafts((current) => {
        const updated = { ...current };
        delete updated[savedFile.path];
        return updated;
      });

      setSaveMessage("Saved successfully.");
    } catch (requestError) {
      setSaveError(
        requestError.response?.data?.message ||
          "Could not save this file. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="workspace-shell">
      <header className="workspace-topbar">
        <button className="back-button-inline" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          All projects
        </button>

        <span className="workspace-project-name">{project.name}</span>

        <span
          className={`generation-status status-${generation?.status || "draft"}`}
        >
          {generation?.status || "draft"}
        </span>
      </header>

      <section className="workspace-content">
        <div className="workspace-intro">
          <p className="auth-kicker">AI WEBSITE BUILDER</p>
          <h1>What are we building?</h1>
          <p>
            Describe your website. craftWebAIWebAI prepares a plan, generates source
            files and lets you inspect a live preview.
          </p>
        </div>

        <form className="prompt-panel" onSubmit={handlePlan}>
          <label htmlFor="website-prompt">Describe your website</label>

          <textarea
            id="website-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            minLength={20}
            maxLength={6000}
            rows={7}
            placeholder="Example: Build a modern portfolio website for a product designer. Include a hero section, selected projects, about section, testimonials and a contact form. Use a clean editorial style with a warm neutral palette."
            required
          />

          <div className="prompt-footer">
            <span>{prompt.length}/6000 characters</span>

            <button
              className="primary-button"
              type="submit"
              disabled={working || prompt.trim().length < 20}
            >
              <Sparkles size={16} />
              {working ? "Preparing plan…" : "Create website plan"}
            </button>
          </div>
        </form>

        {error && (
          <p className="form-error workspace-error" role="alert">
            {error}
          </p>
        )}

        {loading && (
          <p className="workspace-loading">Loading saved generation…</p>
        )}

        {!loading && generation?.plan && (
          <section className="plan-panel">
            <div className="section-title-row">
              <div>
                <p className="auth-kicker">REVIEW BEFORE GENERATING</p>
                <h2>{generation.plan.siteName}</h2>
              </div>

              <span className="plan-ready">
                <CheckCircle2 size={15} />
                Plan ready
              </span>
            </div>

            <p className="plan-summary">{generation.plan.summary}</p>

            <div className="plan-detail-grid">
              <div>
                <span>Visual style</span>
                <strong>{generation.plan.design.style}</strong>
              </div>

              <div>
                <span>Typography</span>
                <strong>{generation.plan.design.typography}</strong>
              </div>

              <div>
                <span>Layout</span>
                <strong>{generation.plan.design.layout}</strong>
              </div>
            </div>

            <div className="plan-subsection">
              <h3>Pages</h3>

              {generation.plan.pages.map((page) => (
                <div className="plan-list-row" key={page.path}>
                  <strong>{page.name}</strong>
                  <span>
                    {page.path} · {page.purpose}
                  </span>
                </div>
              ))}
            </div>

            <div className="plan-subsection">
              <h3>Files to generate ({generation.plan.fileManifest.length})</h3>

              <div className="manifest-list">
                {generation.plan.fileManifest.map((file) => (
                  <div key={file.path}>
                    <FileCode2 size={14} />
                    <span>{file.path}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="palette-row">
              <h3>Color palette</h3>

              {generation.plan.design.colorPalette.map((color) => (
                <span className="palette-chip" key={color}>
                  {color}
                </span>
              ))}
            </div>

            <button
              className="primary-button generate-files-button"
              type="button"
              onClick={handleGenerate}
              disabled={working}
            >
              {working ? (
                <>
                  <LoaderCircle className="spin" size={16} />
                  Generating files…
                </>
              ) : (
                <>
                  <Code2 size={16} />
                  Generate website files
                </>
              )}
            </button>
          </section>
        )}

        {!loading && hasFiles && (
          <section className="generated-panel">
            <div className="section-title-row">
              <div>
                <p className="auth-kicker">GENERATED WEBSITE</p>
                <h2>{generation.files.length} source files saved</h2>
              </div>

              <span className="plan-ready">
                <CheckCircle2 size={15} />
                Files saved
              </span>
            </div>

            <div
              className="workspace-view-tabs"
              role="tablist"
              aria-label="Workspace view"
            >
              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === "code"}
                className={
                  workspaceTab === "code"
                    ? "workspace-view-tab active"
                    : "workspace-view-tab"
                }
                onClick={() => setWorkspaceTab("code")}
              >
                <Code2 size={15} />
                Code
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={workspaceTab === "preview"}
                className={
                  workspaceTab === "preview"
                    ? "workspace-view-tab active"
                    : "workspace-view-tab"
                }
                onClick={() => setWorkspaceTab("preview")}
              >
                <Eye size={15} />
                Live preview
              </button>

              {workspaceTab === "preview" && (
                <button
                  type="button"
                  className="preview-refresh-inline"
                  onClick={() => setWorkspaceTab("preview")}
                >
                  <RefreshCw size={14} />
                  Reload preview
                </button>
              )}
            </div>

            {workspaceTab === "code" ? (
              <div className="code-browser">
                <aside className="file-list">
                  {generation.files.map((file) => {
                    const fileIsDirty =
                      Object.hasOwn(drafts, file.path) &&
                      drafts[file.path] !== file.content;

                    return (
                      <button
                        className={
                          activeFile === file.path
                            ? "file-item active"
                            : "file-item"
                        }
                        key={file.path}
                        onClick={() => {
                          setActiveFile(file.path);
                          setSaveMessage("");
                          setSaveError("");
                        }}
                        type="button"
                      >
                        <FileCode2 size={14} />
                        <span>{file.path}</span>
                        {fileIsDirty && <span className="editor-dirty-dot" />}
                      </button>
                    );
                  })}
                </aside>

                <div className="code-preview editor-panel">
                  <div className="code-preview-title editor-toolbar">
                    <span>{selectedFile?.path || "Select a file"}</span>

                    <div className="editor-actions">
                      {isDirty && (
                        <span className="editor-unsaved-label">
                          Unsaved changes
                        </span>
                      )}

                      {!isDirty && saveMessage && (
                        <span className="editor-saved-label">
                          <CheckCircle2 size={14} />
                          {saveMessage}
                        </span>
                      )}

                      <button
                        type="button"
                        className="primary-button editor-save-button"
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                      >
                        {saving ? (
                          <LoaderCircle className="spin" size={15} />
                        ) : (
                          <Save size={15} />
                        )}
                        {saving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>

                  {saveError && (
                    <p className="form-error editor-error" role="alert">
                      <AlertCircle size={14} />
                      {saveError}
                    </p>
                  )}

                  {selectedFile ? (
                    <Editor
                      height="620px"
                      language={getLanguage(selectedFile.path)}
                      theme="vs-dark"
                      value={editorValue}
                      onChange={handleEditorChange}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "Consolas, monospace",
                        automaticLayout: true,
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        tabSize: 2,
                        padding: { top: 16 },
                        readOnly: false,
                      }}
                    />
                  ) : (
                    <p className="workspace-loading">
                      Select a file from the list to edit its contents.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <LivePreview files={generation.files} />
            )}

            {dirtyCount > 0 && (
              <p className="next-step-note">
                {dirtyCount} file{dirtyCount === 1 ? "" : "s"} with unsaved
                changes. Save each edited file before using those changes in
                Live Preview.
              </p>
            )}

            <p className="next-step-note">
              Preview runs in a restricted development environment. Public
              deployments require stronger server-side isolation.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
