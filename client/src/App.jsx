import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Code2,
  Layers3,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ProjectWorkspacePage from "./pages/ProjectWorkspacePage.jsx";

const features = [
  {
    icon: Sparkles,
    title: "From idea to website",
    description:
      "Describe what you want to create. Your workspace will bring the idea to life.",
  },
  {
    icon: Code2,
    title: "Your code, in your hands",
    description:
      "Inspect and edit the files behind your website as your project takes shape.",
  },
  {
    icon: Layers3,
    title: "One focused workspace",
    description:
      "Keep your projects, iterations and previews together in one place.",
  },
];

function getInitialTheme() {
  try {
    return localStorage.getItem("carftwebai-theme") || "dark";
  } catch {
    return "dark";
  }
}

function AppContent() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [page, setPage] = useState("home");
  const [activeProject, setActiveProject] = useState(null);
  const { user, loading, logout } = useAuth();
  const dark = theme === "dark";

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#000000" : "#FFFFFF");
    try {
      localStorage.setItem("carftwebai-theme", theme);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [theme, dark]);

  useEffect(() => {
    // Restore the dashboard when an existing session is detected.
    if (!loading && user && page === "home") {
      setPage("dashboard");
    }

    // Return to the home page if the user is no longer authenticated.
    if (!loading && !user && (page === "dashboard" || page === "workspace")) {
      setActiveProject(null);
      setPage("home");
    }
  }, [loading, user, page]);

  async function handleLogout() {
    try {
      await logout();
      setPage("home");
    } catch {
      /* Keep the session UI in place if the server cannot process logout. */
    }
  }

  if (loading)
    return <main className="loading-screen">Loading your workspace…</main>;

  if (user && page === "workspace" && activeProject) {
    return (
      <>
        <ThemeToggle dark={dark} setTheme={setTheme} />
        <ProjectWorkspacePage
          project={activeProject}
          onBack={() => setPage("dashboard")}
        />
      </>
    );
  }

  if (user && page === "dashboard") {
    return (
      <>
        <ThemeToggle dark={dark} setTheme={setTheme} />
        <DashboardPage
          user={user}
          onLogout={handleLogout}
          onOpenProject={(project) => {
            setActiveProject(project);
            setPage("workspace");
          }}
        />
      </>
    );
  }

  if (page === "login" || page === "register") {
    return (
      <>
        <ThemeToggle dark={dark} setTheme={setTheme} />
        <AuthPage
          mode={page}
          onBack={() => setPage("home")}
          onAuthenticated={() => setPage("dashboard")}
        />
      </>
    );
  }

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="carftWebAI home">
          <span className="brand-mark">c</span>
          <span>carftWebAI</span>
        </a>
        <div className="topbar-actions">
          <button
            className="text-button"
            type="button"
            onClick={() => setPage("login")}
          >
            Sign in
          </button>
          <button
            className="small-primary-button"
            type="button"
            onClick={() => setPage("register")}
          >
            Get started <ArrowUpRight size={15} />
          </button>
          <ThemeToggle dark={dark} setTheme={setTheme} />
        </div>
      </header>
      <section className="hero">
        <div className="eyebrow">
          <span className="eyebrow-dot" /> A new way to build for the web
        </div>
        <h1>
          Ideas become
          <br />
          <span>websites.</span>
        </h1>
        <p className="hero-copy">
          Create, shape and refine your next website with an AI-powered
          workspace designed to keep the creative process simple.
        </p>
        <div className="hero-actions">
          <button
            className="primary-button"
            type="button"
            onClick={() => setPage("register")}
          >
            Create your account <ArrowUpRight size={17} />
          </button>
        </div>
        <p className="phase-note">Your creative workspace starts here.</p>
      </section>
      <section className="feature-grid" aria-label="Product capabilities">
        {features.map(({ icon: Icon, title, description }) => (
          <article className="feature-card" key={title}>
            <div className="feature-icon">
              <Icon size={20} strokeWidth={1.8} />
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
      <footer className="footer">
        <span>carftWebAI</span>
        <span>Built for ideas worth making.</span>
      </footer>
    </main>
  );
}

function ThemeToggle({ dark, setTheme }) {
  return (
    <button
      className="appearance-button floating-theme-toggle"
      type="button"
      onClick={() =>
        setTheme((current) => (current === "dark" ? "light" : "dark"))
      }
      aria-label={
        dark ? "Switch to light appearance" : "Switch to dark appearance"
      }
      title={dark ? "Light appearance" : "Dark appearance"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
