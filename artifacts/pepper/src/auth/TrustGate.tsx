import { useState, type CSSProperties, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./AuthProvider";

interface TrustGateProps {
  /** "gate" = new account (register a passkey); "returning" = unlock an account. */
  variant?: "gate" | "returning";
  /** Called once the session is established (after the brief "You're in." beat). */
  onSuccess?: () => void;
  /** Called when the user chooses to keep chatting without signing up. */
  onDismiss?: () => void;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/**
 * The inline trust gate. Rendered verbatim from pepper-trust-gate.html (orb,
 * copy, animations) with the simulated success swapped for real WebAuthn:
 *  - "Continue with Face ID" runs navigator.credentials.create()/get() against
 *    a server-generated, single-use challenge that is verified server-side.
 *  - "Use a password instead" keeps the existing email + password path intact.
 */
export function TrustGate({
  variant = "gate",
  onSuccess,
  onDismiss,
}: TrustGateProps) {
  const {
    registerPasskey,
    loginWithPasskey,
    signup,
    login,
    passkeySupported,
  } = useAuth();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [done, setDone] = useState(false);

  const returning = variant === "returning";

  function finish() {
    setDone(true);
    // Hold the "You're in." beat, then resume the conversation seamlessly.
    setTimeout(() => onSuccess?.(), 850);
  }

  async function handleBiometric() {
    setError(null);
    if (!returning && !EMAIL_RE.test(email.trim())) {
      setError("Enter your email to continue.");
      return;
    }
    setWorking(true);
    try {
      if (returning) {
        await loginWithPasskey();
      } else {
        await registerPasskey(email.trim());
      }
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setWorking(true);
    try {
      if (returning) {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), password);
      }
      finish();
    } catch (err) {
      setError(
        err instanceof Error && "data" in err
          ? extractError(err)
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={cardStyle}>
      <style>{KEYFRAMES}</style>

      <div style={orbWrapStyle} aria-hidden>
        <div style={orbStyle} />
        <span style={orbRingStyle} />
      </div>

      {done ? (
        <div style={doneWrapStyle}>
          <div style={checkStyle}>✓</div>
          <h2 style={titleStyle}>You're in.</h2>
          <p style={subtitleStyle}>Picking up right where we left off…</p>
        </div>
      ) : (
        <>
          <h2 style={titleStyle}>
            {returning ? "Welcome back" : "Keep this yours"}
          </h2>
          <p style={subtitleStyle}>
            {returning
              ? "Unlock your private workspace to continue."
              : "Before we talk numbers, let's lock this to you alone — so only you can ever see it."}
          </p>

          {!returning && (
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={working}
              style={inputStyle}
            />
          )}

          {showPassword && (
            <form onSubmit={handlePasswordSubmit} style={formStyle}>
              {returning && (
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={working}
                  style={inputStyle}
                />
              )}
              <input
                type="password"
                autoComplete={returning ? "current-password" : "new-password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={working}
                style={inputStyle}
              />
              <button type="submit" disabled={working} style={primaryBtnStyle}>
                {working
                  ? "Just a moment…"
                  : returning
                    ? "Log in"
                    : "Create account"}
              </button>
            </form>
          )}

          {!showPassword && (
            <button
              type="button"
              onClick={handleBiometric}
              disabled={working || !passkeySupported}
              style={biometricStyle}
            >
              <FaceIdGlyph />
              {working
                ? "Waiting for your device…"
                : returning
                  ? "Unlock with Face ID"
                  : "Continue with Face ID"}
            </button>
          )}

          {error && <div style={errorStyle}>{error}</div>}

          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowPassword((s) => !s);
            }}
            disabled={working}
            style={altStyle}
          >
            {showPassword ? "Use Face ID instead" : "Use a password instead"}
          </button>

          <div style={trustStyle}>
            <span>Encrypted and private to you. We never sell your data.</span>
            <button
              type="button"
              onClick={() => setLocation("/privacy")}
              style={privacyLinkStyle}
            >
              How we protect it →
            </button>
          </div>

          {onDismiss && !returning && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={working}
              style={dismissStyle}
            >
              Keep chatting for now
            </button>
          )}
        </>
      )}
    </div>
  );
}

function FaceIdGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M9 10v1" />
      <path d="M15 10v1" />
      <path d="M12 9v4" />
      <path d="M9 15s1 1 3 1 3-1 3-1" />
    </svg>
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

const KEYFRAMES = `
@keyframes pepperOrbPulse {
  0%, 100% { transform: scale(1); opacity: 0.55; }
  50% { transform: scale(1.18); opacity: 0; }
}
@keyframes pepperGateIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`;

const cardStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  borderRadius: 20,
  padding: "26px 22px 22px",
  background:
    "linear-gradient(180deg, rgba(34, 24, 19, 0.92), rgba(18, 13, 10, 0.96))",
  border: "1px solid rgba(255, 180, 120, 0.16)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.5)",
  color: "#f6ece1",
  textAlign: "center",
  animation: "pepperGateIn 0.4s ease both",
};

const orbWrapStyle: CSSProperties = {
  position: "relative",
  width: 56,
  height: 56,
  margin: "0 auto 16px",
};

const orbStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background:
    "radial-gradient(circle at 36% 30%, #ffe6bf 0%, #ffb454 16%, #ff7e3f 42%, #d8531f 70%, #5e2410 100%)",
  boxShadow:
    "inset -8px -10px 22px rgba(60,18,4,.85), inset 5px 6px 16px rgba(255,225,180,.55), 0 12px 36px rgba(216,83,31,.4)",
};

const orbRingStyle: CSSProperties = {
  position: "absolute",
  inset: -6,
  borderRadius: "50%",
  border: "2px solid rgba(255, 180, 84, 0.6)",
  animation: "pepperOrbPulse 2.4s ease-in-out infinite",
};

const titleStyle: CSSProperties = {
  fontFamily: "'Fraunces', Georgia, serif",
  fontSize: "1.4rem",
  fontWeight: 400,
  margin: "0 0 8px",
};

const subtitleStyle: CSSProperties = {
  fontSize: "0.9rem",
  color: "#a8978a",
  lineHeight: 1.5,
  margin: "0 0 18px",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255, 180, 120, 0.18)",
  background: "rgba(11, 9, 8, 0.6)",
  color: "#f6ece1",
  fontSize: "0.95rem",
  outline: "none",
  marginBottom: 12,
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const biometricStyle: CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
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

const primaryBtnStyle: CSSProperties = {
  ...biometricStyle,
  marginTop: 2,
};

const altStyle: CSSProperties = {
  marginTop: 14,
  background: "none",
  border: "none",
  color: "#ffb454",
  cursor: "pointer",
  fontSize: "0.88rem",
};

const trustStyle: CSSProperties = {
  marginTop: 18,
  paddingTop: 16,
  borderTop: "1px solid rgba(255, 180, 120, 0.12)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: "0.78rem",
  color: "#8c7d71",
  lineHeight: 1.5,
};

const privacyLinkStyle: CSSProperties = {
  background: "none",
  border: "none",
  color: "#a8978a",
  cursor: "pointer",
  fontSize: "0.78rem",
  textDecoration: "underline",
  textUnderlineOffset: 2,
};

const dismissStyle: CSSProperties = {
  marginTop: 12,
  background: "none",
  border: "none",
  color: "#8c7d71",
  cursor: "pointer",
  fontSize: "0.82rem",
};

const errorStyle: CSSProperties = {
  marginTop: 12,
  color: "#ff9b7a",
  fontSize: "0.84rem",
  textAlign: "left",
};

const doneWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const checkStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  margin: "0 0 12px",
  fontSize: "1.3rem",
  color: "#1a0f08",
  fontWeight: 700,
  background: "linear-gradient(180deg, #ffd79a, #d8531f)",
};
