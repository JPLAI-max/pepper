import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const ref = useRef<HTMLIFrameElement>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    let wired = false;
    const wire = () => {
      if (wired) return;
      const doc = iframe.contentDocument;
      if (!doc) return;
      wired = true;
      const go = () => setLocation("/dashboard");
      const send = doc.getElementById("send");
      const field = doc.getElementById("field") as HTMLInputElement | null;
      send?.addEventListener("click", go);
      field?.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") go();
      });
    };

    iframe.addEventListener("load", wire);
    if (iframe.contentDocument?.readyState === "complete") wire();
    return () => iframe.removeEventListener("load", wire);
  }, [setLocation]);

  return (
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
  );
}
