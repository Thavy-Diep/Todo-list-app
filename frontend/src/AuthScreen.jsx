import { useState } from "react";
import { API_BASE, responseError, setAccessToken } from "./api.js";

export default function AuthScreen({ onAuthenticated, statusMessage = "" }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const endpoint = mode === "login" ? "login" : "signup";
      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error(await responseError(response, "Unable to continue"));
      }

      const result = await response.json();
      if (mode === "signup") {
        setMode("login");
        setPassword("");
        setNotice("Account created. Sign in with your new account.");
        return;
      }

      setAccessToken(result.accessToken);
      await onAuthenticated(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <a className="brand auth-brand" href="#" aria-label="Daylight">
          <span className="brand-mark">✓</span>
          <span>daylight<span className="brand-period">.</span></span>
        </a>
        <p className="eyebrow">YOUR PERSONAL TASK SPACE</p>
        <h1>{mode === "login" ? "Welcome back." : "Create your account."}</h1>
        <p className="auth-description">
          {mode === "login"
            ? "Sign in to see and manage your tasks."
            : "Sign up to keep your tasks private and organized."}
        </p>
        {statusMessage && (
          <p className="auth-message auth-error" role="alert">{statusMessage}</p>
        )}

        <label className="form-label" htmlFor="auth-email">Email</label>
        <input
          autoComplete="email"
          id="auth-email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <label className="form-label" htmlFor="auth-password">Password</label>
        <input
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          id="auth-password"
          maxLength={72}
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />

        {error && <p className="auth-message auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}

        <button className="primary-button auth-submit" disabled={isSubmitting} type="submit">
          {isSubmitting
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
        <p className="auth-switch">
          {mode === "login" ? "New to Daylight?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setNotice("");
            }}
            type="button"
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </main>
  );
}
