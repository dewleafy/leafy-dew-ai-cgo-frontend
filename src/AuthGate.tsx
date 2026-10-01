import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AUTH_REQUIRED_EVENT, authApi, setAuthToken } from "./api";

type Phase = "checking" | "open" | "login";

/**
 * Shows a sign-in screen when the server requires a login. If the server has login switched
 * off (APP_PASSWORD not set) or is an older version without /api/auth, the app opens as before.
 * The server is what actually enforces access; this component only collects the password.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [enabled, setEnabled] = useState(false);
  const [session, setSession] = useState(0);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    authApi
      .status()
      .then((status) => {
        if (!alive) return;
        setEnabled(status.enabled);
        setPhase(status.authenticated ? "open" : "login");
      })
      .catch(() => {
        // Old server without /api/auth, or a network blip: open the app; its own screens report problems.
        if (alive) setPhase("open");
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onAuthRequired = () => {
      setEnabled(true);
      setPhase("login");
    };
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    return () => window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  }, []);

  const signOut = useCallback(() => {
    setAuthToken(null);
    setPassword("");
    setError("");
    setPhase("login");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await authApi.login(password);
      if (result.token) setAuthToken(result.token);
      setPassword("");
      setSession((value) => value + 1); // remount the app so every page loads with the new token
      setPhase("open");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "checking") {
    return <div style={{ padding: 32 }}>Loading…</div>;
  }

  if (phase === "login") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
        <form
          onSubmit={submit}
          style={{ width: "100%", maxWidth: 360, display: "grid", gap: 14, padding: 28, borderRadius: 12, border: "1px solid #d9ded9", background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
        >
          <img src="/ld-logo.png" alt="Leafy Dew" style={{ height: 44, justifySelf: "start" }} onError={(e) => (e.currentTarget.style.display = "none")} />
          <h1 style={{ margin: 0, fontSize: 22 }}>Sign in</h1>
          <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
            Password
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: "10px 12px", fontSize: 16, borderRadius: 8, border: "1px solid #b9c2ba" }}
            />
          </label>
          {error && (
            <div role="alert" style={{ color: "#a32121", fontSize: 14 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={busy || !password} style={{ padding: "10px 12px", fontSize: 16, borderRadius: 8, border: 0, background: "#2f6f4f", color: "#fff", cursor: busy ? "wait" : "pointer" }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <div key={session}>{children}</div>
      {enabled && (
        <button
          type="button"
          onClick={signOut}
          style={{ position: "fixed", right: 12, bottom: 12, zIndex: 50, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid #b9c2ba", background: "#fff", cursor: "pointer", opacity: 0.85 }}
        >
          Sign out
        </button>
      )}
    </>
  );
}
