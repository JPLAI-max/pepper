import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/auth";

// Income Units is a pure simulation prototype, served verbatim from
// public/pepper-trading-desk-demo.html and embedded full-screen the same way the
// Reveal screen is. It touches no real money, securities, or app engines — it is
// illustrative only. We only gate access and offer a way back to the app.
export default function Market() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/");
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <>
      <button
        onClick={() => setLocation("/dashboard")}
        style={{
          position: "fixed",
          top: 14,
          left: 16,
          zIndex: 50,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid rgba(255,180,120,.24)",
          background: "rgba(11,9,8,.72)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "#f6ece1",
          fontSize: ".85rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <iframe
        src={`${import.meta.env.BASE_URL}pepper-trading-desk-demo.html`}
        title="Income Units (Simulation)"
        sandbox="allow-scripts"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
    </>
  );
}
