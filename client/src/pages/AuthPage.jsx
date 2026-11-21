import { useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthPage({ mode, onBack, onAuthenticated }) {
  const isRegister = mode === "register";
  const { register, login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (isRegister) await register({ name, email, password });
      else await login({ email, password });
      onAuthenticated();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to complete your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <button className="back-button" onClick={onBack} type="button">
        <ArrowLeft size={16} /> Back
      </button>
      <section className="auth-card">
        <div className="auth-symbol">
          <Sparkles size={22} />
        </div>
        <p className="auth-kicker">carftWebAI account</p>
        <h1>{isRegister ? "Create your account." : "Welcome back."}</h1>
        <p className="auth-description">
          {isRegister
            ? "Start building something remarkable."
            : "Sign in to continue to your workspace."}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              <span>Your name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                minLength={2}
                maxLength={60}
                required
              />
            </label>
          )}
          <label>
            <span>Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete={isRegister ? "new-password" : "current-password"}
              minLength={isRegister ? 8 : 1}
              maxLength={72}
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button auth-submit"
            disabled={submitting}
            type="submit"
          >
            {submitting
              ? "Please wait…"
              : isRegister
                ? "Create account"
                : "Sign in"}{" "}
            <ArrowRight size={17} />
          </button>
        </form>
        <p className="auth-security">
          <LockKeyhole size={13} /> Your password is securely hashed before
          storage.
        </p>
      </section>
    </main>
  );
}
