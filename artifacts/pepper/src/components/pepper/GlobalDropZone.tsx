import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth";
import { useDocumentUpload } from "./useDocumentUpload";
import { DocumentConfirmCard } from "./DocumentConfirmCard";

/**
 * Page-level drag-and-drop layer for authenticated app screens.
 *
 * Dragging a file anywhere over the page raises a "Drop to share with Pepper"
 * overlay (ember glass + orb); dropping it routes the file straight into the
 * shared upload + parse flow (useDocumentUpload) — no need to find an upload
 * button. The resulting progress / editable confirmation card / error render in
 * a floating ember surface, since on these screens the chat panel is suppressed
 * in favour of the "Hey Pep" overlay.
 *
 * Auth + type/size validation are enforced by useDocumentUpload exactly as the
 * chat-panel entry point. Guests never see the overlay (this component returns
 * null when unauthenticated, and its window listeners are not attached).
 */
export function GlobalDropZone() {
  const { isAuthenticated } = useAuth();
  const upload = useDocumentUpload();
  const [dragging, setDragging] = useState(false);

  // Latest upload helpers, read inside window listeners without resubscribing.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;
  // Counts dragenter/dragleave so nested elements don't prematurely hide it.
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) {
        dragDepth.current = 0;
        setDragging(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file && !uploadRef.current.uploadBusy) {
        void uploadRef.current.handleFile(file);
      }
    };

    // If a drag leaves the browser window entirely (no balanced dragleave) the
    // overlay could otherwise stick — reset it on blur / tab switch.
    const reset = () => {
      dragDepth.current = 0;
      setDragging(false);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  const showSurface = upload.uploadPhase || upload.card || upload.uploadError;

  return (
    <>
      {/* Full-page "Drop to share with Pepper" overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 pointer-events-none"
          >
            <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />
            <div className="relative flex flex-col items-center text-center">
              {/* Jarvis-style ember orb */}
              <div className="relative mb-6">
                <div
                  className="w-24 h-24 rounded-full animate-pulse"
                  style={{
                    background:
                      "radial-gradient(circle at 36% 30%, #ffe6bf, #ffb454 18%, #ff7e3f 48%, #d8531f 78%, #5e2410)",
                    boxShadow: "0 0 60px rgba(255,126,63,0.5)",
                  }}
                />
                <div className="absolute -inset-3 rounded-full border border-primary/40 animate-ping" />
              </div>
              <div className="rounded-3xl border border-primary/30 bg-card/70 backdrop-blur-2xl px-10 py-8 shadow-[0_0_50px_rgba(232,93,63,0.18)]">
                <h3 className="text-2xl font-serif text-foreground">
                  Drop to share with Pepper
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  PDF, PNG, or JPG — up to 15MB. I'll read it and show you what I find.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating ember surface: progress / confirmation card / error */}
      <AnimatePresence>
        {showSurface && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed z-50 bottom-6 right-6 md:bottom-8 md:right-8 w-[calc(100%-3rem)] sm:w-[380px] max-w-[380px]"
          >
            {upload.uploadPhase && (
              <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-2xl px-5 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex items-center gap-2.5 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
                {upload.uploadPhase === "uploading"
                  ? "Uploading your document…"
                  : "Reading your document…"}
              </div>
            )}

            {!upload.uploadPhase && upload.card && (
              <DocumentConfirmCard
                card={upload.card}
                edited={upload.edited}
                setEdited={upload.setEdited}
                confirming={upload.confirming}
                onConfirm={upload.confirmCard}
                onDiscard={upload.discardCard}
              />
            )}

            {!upload.uploadPhase && !upload.card && upload.uploadError && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive-foreground px-5 py-4 text-xs shadow-[0_8px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                {upload.uploadError}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
