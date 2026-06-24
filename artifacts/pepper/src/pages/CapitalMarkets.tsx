import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/auth";

// Capital Markets is a pure simulation prototype, served verbatim from
// public/pepper-capital-markets-demo.html and embedded full-screen the same way
// the Reveal screen is. It makes no real funding, trades, settlement, loans,
// securities, or digital-asset/blockchain calls — every figure, balance, and
// token is illustrative. It is public so the guided tour can showcase it without
// an account; we only offer a way back to the app.
export default function CapitalMarkets() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <>
      <button
        onClick={() => setLocation(isAuthenticated ? "/dashboard" : "/")}
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
        src={`${import.meta.env.BASE_URL}pepper-capital-markets-demo.html`}
        title="Capital Markets (Simulation)"
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
