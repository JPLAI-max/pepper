import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { usePepper } from "@/pepper";

type AuthMode = "login" | "signup";
type AuthTrigger = "manual" | "gate";

interface AuthModalContextValue {
  open: (mode?: AuthMode) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

const GATE_HEADLINE = "Save your progress";
const GATE_SUBTITLE =
  "To save your roadmap and keep it private, let's set up your account.";

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const { signup, login, isAuthenticated } = useAuth();
  const { authRequired, clearAuthRequired } = usePepper();
  const [, setLocation] = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [trigger, setTrigger] = useState<AuthTrigger>("manual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const open = useCallback((m: AuthMode = "signup") => {
    setMode(m);
    setTrigger("manual");
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    setPassword("");
  }, []);

  // Trust gate: the anonymous chat shared financial specifics. Surface account
  // setup without interrupting the in-progress conversation.
  useEffect(() => {
    if (authRequired && !isAuthenticated && !isOpen) {
      setMode("signup");
      setTrigger("gate");
      setError(null);
      setIsOpen(true);
    }
  }, [authRequired, isAuthenticated, isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setError(null);
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      setSubmitting(true);
      try {
        if (mode === "signup") {
          await signup(email.trim(), password);
        } else {
          await login(email.trim(), password);
        }
        // Conversation continuity: the anon conversation is now linked to the
        // account server-side, so we simply dismiss the gate and stay in chat.
        clearAuthRequired();
        setIsOpen(false);
        setPassword("");
        if (trigger === "manual") {
          setLocation("/dashboard");
        }
      } catch (err) {
        const message =
          err instanceof Error && "data" in err
            ? extractError(err)
            : "Something went wrong. Please try again.";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting,
      password,
      mode,
      email,
      signup,
      login,
      clearAuthRequired,
      trigger,
      setLocation,
    ],
  );

  const value = useMemo<AuthModalContextValue>(() => ({ open }), [open]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      {isOpen && (
        <div
          style={overlayStyle}
          onClick={() => {
            if (!submitting) close();
          }}
        >
          <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div style={orbStyle} />
            <h2 style={titleStyle}>
              {trigger === "gate"
                ? GATE_HEADLINE
                : mode === "signup"
                  ? "Create your account"
                  : "Welcome back"}
            </h2>
            <p style={subtitleStyle}>
              {trigger === "gate"
                ? GATE_SUBTITLE
                : mode === "signup"
                  ? "Set up your private Pepper workspace."
                  : "Log in to pick up where you left off."}
            </p>
            <form onSubmit={handleSubmit} style={formStyle}>
              <input
                type="email"
                required
                autoFocus
                placeholder="Email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
              <input
                type="password"
                required
                placeholder="Password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
              />
              {error && <div style={errorStyle}>{error}</div>}
              <button type="submit" disabled={submitting} style={submitStyle}>
                {submitting
                  ? "Just a moment…"
                  : mode === "signup"
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>
            <div style={switchRowStyle}>
              {mode === "signup" ? (
                <button
                  type="button"
                  style={linkStyle}
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Already have an account? Log in
                </button>
              ) : (
                <button
                  type="button"
                  style={linkStyle}
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                  }}
                >
                  New here? Create an account
                </button>
              )}
            </div>
            {trigger === "gate" && (
              <button
                type="button"
                style={dismissStyle}
                onClick={() => {
                  clearAuthRequired();
                  close();
                }}
              >
                Keep chatting for now
              </button>
            )}
          </div>
        </div>
      )}
    </AuthModalContext.Provider>
  );
}

function extractError(err: unknown): string {
  const data = (err as { data?: unknown }).data;
  if (data && typeof data === "object" && "error" in data) {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string") return msg;
  }
  return "Something went wrong. Please try again.";
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return ctx;
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "rgba(7, 5, 4, 0.72)",
  backdropFilter: "blur(8px)",
};

const cardStyle: React.CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: 400,
  borderRadius: 22,
  padding: "40px 30px 30px",
  background:
    "linear-gradient(180deg, rgba(34, 24, 19, 0.92), rgba(18, 13, 10, 0.96))",
  border: "1px solid rgba(255, 180, 120, 0.16)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
  color: "#f6ece1",
  textAlign: "center",
};

const orbStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  margin: "0 auto 18px",
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 36% 30%, #ffe6bf 0%, #ffb454 16%, #ff7e3f 42%, #d8531f 70%, #5e2410 100%)",
  boxShadow:
    "inset -8px -10px 22px rgba(60,18,4,.85), inset 5px 6px 16px rgba(255,225,180,.55), 0 12px 36px rgba(216,83,31,.4)",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: "1.5rem",
  fontWeight: 400,
  margin: "0 0 8px",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.92rem",
  color: "#a8978a",
  lineHeight: 1.5,
  margin: "0 0 22px",
};

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 15px",
  borderRadius: 12,
  border: "1px solid rgba(255, 180, 120, 0.18)",
  background: "rgba(11, 9, 8, 0.6)",
  color: "#f6ece1",
  fontSize: "0.95rem",
  outline: "none",
};

const submitStyle: React.CSSProperties = {
  marginTop: 4,
  padding: "13px 15px",
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  fontSize: "0.98rem",
  fontWeight: 600,
  color: "#1a0f08",
  background: "linear-gradient(180deg, #ffb454, #d8531f)",
  boxShadow: "0 10px 30px rgba(216,83,31,.35)",
};

const switchRowStyle: React.CSSProperties = {
  marginTop: 18,
};

const linkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#ffb454",
  cursor: "pointer",
  fontSize: "0.88rem",
};

const dismissStyle: React.CSSProperties = {
  marginTop: 10,
  background: "none",
  border: "none",
  color: "#a8978a",
  cursor: "pointer",
  fontSize: "0.84rem",
};

const errorStyle: React.CSSProperties = {
  color: "#ff9b7a",
  fontSize: "0.85rem",
  textAlign: "left",
};
