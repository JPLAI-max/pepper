import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/auth";

// The Reveal screen is served verbatim from public/pepper-reveal.html, embedded
// full-screen the same way the public landing is. The static file wires its own
// live data via the auth-scoped API; here we only gate access and route the
// "Continue to your dashboard" CTA through the parent SPA router.
export default function Reveal() {
  const ref = useRef<HTMLIFrameElement>(null);
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Auth gate: only the logged-in user can view their own reveal.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) setLocation("/");
  }, [isLoading, isAuthenticated, setLocation]);

  // The reveal's CTA must drive the parent router, not navigate the iframe.
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let wired = false;
    const wire = () => {
      if (wired) return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      const cta = doc.querySelector(".cta") as HTMLButtonElement | null;
      if (!cta) return;
      wired = true;
      cta.onclick = (e) => {
        e.preventDefault();
        setLocation("/dashboard");
      };
    };
    iframe.addEventListener("load", wire);
    wire();
    return () => iframe.removeEventListener("load", wire);
  }, [setLocation]);

  if (isLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <iframe
      ref={ref}
      src={`${import.meta.env.BASE_URL}pepper-reveal.html`}
      title="Your Position"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
