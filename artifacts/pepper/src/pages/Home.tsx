import { useEffect, useRef } from "react";
import { usePepper } from "@/pepper";
import { useAuth, useAuthModal } from "@/auth";
import { useLocation } from "wouter";

export default function Home() {
  const ref = useRef<HTMLIFrameElement>(null);
  const { setOpen, sendText, startTour } = usePepper();
  const { open: openAuth } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    let wired = false;
    const wire = () => {
      if (wired) return;
      const doc = iframe.contentDocument;
      if (!doc) return;

      const field = doc.getElementById("field") as HTMLInputElement | null;
      const send = doc.getElementById("send");
      // The iframe's initial about:blank document reports readyState
      // "complete" before landing.html loads. Only wire up once the real
      // landing elements exist, otherwise we'd mark it wired against a blank
      // doc and never attach the handlers when the real page loads.
      if (!field || !send) return;
      wired = true;

      const submit = () => {
        const text = field.value.trim();
        // Open Pepper and start the conversation anonymously. The chat persists
        // and converts to an account later via the trust gate.
        setOpen(true);
        if (text) {
          // A resolved navigation/tour command acts here too — the server
          // short-circuits it past the coach, so consuming the result routes
          // or starts the tour; a normal message just streams into the panel.
          void sendText(text).then((result) => {
            if (result?.tour && result.tour.length > 0) startTour(result.tour);
            else if (result?.navigate) setLocation(result.navigate);
          });
          field.value = "";
        }
      };

      send.addEventListener("click", submit);
      field.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") submit();
      });
    };

    iframe.addEventListener("load", wire);
    wire();
    return () => iframe.removeEventListener("load", wire);
  }, [setOpen, sendText, startTour, setLocation]);

  return (
    <>
      <iframe
        ref={ref}
        src={`${import.meta.env.BASE_URL}landing.html`}
        title="Pepper"
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          border: "none",
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (isAuthenticated) {
            setLocation("/dashboard");
          } else {
            openAuth("login");
          }
        }}
        style={{
          position: "fixed",
          top: 20,
          right: 24,
          zIndex: 10,
          padding: "8px 18px",
          borderRadius: 999,
          border: "1px solid rgba(217, 164, 65, 0.35)",
          background: "rgba(18, 24, 33, 0.6)",
          backdropFilter: "blur(8px)",
          color: "#E8DCC8",
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.02em",
          cursor: "pointer",
        }}
      >
        {isAuthenticated ? "Command Center" : "Log in"}
      </button>
    </>
  );
}
