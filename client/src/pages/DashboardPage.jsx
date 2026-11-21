import { useEffect, useState } from "react";
import {
  FolderOpen,
  LogOut,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Pencil,
  X,
  Check,
} from "lucide-react";
import {
  createProject,
  fetchProjects,
  removeProject,
  renameProject,
} from "../services/projectService.js";

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default function DashboardPage({ user, onLogout, onOpenProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState("");

  async function loadProjects() {
    setError("");
    try {
      setProjects(await fetchProjects());
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not load your projects.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleCreate(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const project = await createProject({ name, description });
      setProjects((current) => [project, ...current]);
      setName("");
      setDescription("");
      setShowCreate(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not create the project.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRename(projectId) {
    if (!editingName.trim()) return;
    setBusyId(projectId);
    setError("");
    try {
      const updated = await renameProject(projectId, { name: editingName });
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? updated : project,
        ),
      );
      setEditingId("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not rename the project.",
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleDelete(projectId) {
    if (!window.confirm("Delete this project? This action cannot be undone."))
      return;
    setBusyId(projectId);
    setError("");
    try {
      await removeProject(projectId);
      setProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Could not delete the project.",
      );
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-topbar">
        <a className="brand" href="/">
          <span className="brand-mark">c</span>
          <span>carftWebAI</span>
        </a>
        <div className="account-area">
          <span className="account-name">{user.name}</span>
          <button
            className="icon-action"
            type="button"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <section className="dashboard-welcome">
        <div className="dashboard-heading-row">
          <div>
            <p className="auth-kicker">YOUR WORKSPACE</p>
            <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
            <p>Your ideas and website projects, all in one place.</p>
          </div>
          <button
            className="primary-button create-project-button"
            type="button"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={17} /> New project
          </button>
        </div>

        {error && (
          <p className="form-error dashboard-error" role="alert">
            {error}
          </p>
        )}

        {showCreate && (
          <form className="project-form" onSubmit={handleCreate}>
            <div className="project-form-heading">
              <h2>Create a project</h2>
              <button
                className="icon-action small-icon-action"
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <label>
              Project name
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Portfolio website"
                maxLength={80}
                required
              />
            </label>
            <label>
              Description <span className="optional-label">Optional</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are you planning to build?"
                maxLength={500}
                rows={3}
              />
            </label>
            <div className="project-form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={saving || !name.trim()}
              >
                {saving ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        )}

        <div className="projects-section-heading">
          <div>
            <h2>Your projects</h2>
            <span>
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="projects-empty">
            <p>Loading your projects…</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="projects-empty">
            <div className="empty-icon">
              <FolderOpen size={24} />
            </div>
            <h2>Your workspace is ready.</h2>
            <p>
              Create your first project to keep your website ideas organized. AI
              generation will be added in a later phase.
            </p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              <Plus size={16} /> Create your first project
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <div className="project-card-top">
                  <div className="project-card-icon">
                    <Sparkles size={18} />
                  </div>
                  <span className="project-status">Draft</span>
                </div>
                {editingId === project.id ? (
                  <div className="rename-row">
                    <input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      maxLength={80}
                      autoFocus
                    />
                    <button
                      className="icon-action"
                      type="button"
                      disabled={busyId === project.id}
                      onClick={() => handleRename(project.id)}
                      aria-label="Save name"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => setEditingId("")}
                      aria-label="Cancel rename"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <h3>{project.name}</h3>
                )}
                <p className="project-description">
                  {project.description || "No description added."}
                </p>
                <div className="project-card-bottom">
                  <span>Updated {formatDate(project.updatedAt)}</span>
                  <div className="project-actions">
                    <button
                      className="icon-action open-project-action"
                      type="button"
                      onClick={() => onOpenProject(project)}
                      aria-label={`Open ${project.name}`}
                      title="Open project"
                    >
                      <FolderOpen size={15} />
                    </button>
                    <button
                      className="icon-action"
                      type="button"
                      onClick={() => {
                        setEditingId(project.id);
                        setEditingName(project.name);
                      }}
                      aria-label={`Rename ${project.name}`}
                      title="Rename"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-action danger-action"
                      type="button"
                      disabled={busyId === project.id}
                      onClick={() => handleDelete(project.id)}
                      aria-label={`Delete ${project.name}`}
                      title="Delete"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
