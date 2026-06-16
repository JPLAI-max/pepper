import React, { useRef, useEffect, useState } from "react";
import { usePepper } from "@/pepper";
import { useAuth, TrustGate } from "@/auth";
import {
  Mic, Send, Volume2, SquareSquare, VolumeX, MicOff, Sparkles, ChevronDown,
  Paperclip, FileText, Check, X as XIcon, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import {
  requestUploadUrl,
  ingestDocument,
  confirmDocumentExtraction,
  getGetProfileQueryKey,
  getListDocumentsQueryKey,
  getGetRoadmapQueryKey,
  getGetReadinessScoresQueryKey,
  getGetDashboardSummaryQueryKey,
  type IngestDocumentOutput,
} from "@workspace/api-client-react";

const ACCEPTED_DOC_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_DOC_BYTES = 15 * 1024 * 1024;

export function PepperAssistant() {
  const {
    open, setOpen,
    messages,
    status,
    busy,
    voice, setVoice,
    sendText,
    startListening, stopListening, toggleListening,
    stopSpeaking,
    wakeWordEnabled, setWakeWordEnabled, wakeWordSupported,
    reset,
    authRequired, clearAuthRequired,
  } = usePepper();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document upload flow is local to this component: usePepper has no card
  // concept. `uploadPhase` drives the inline progress note, `card` holds the
  // server-parsed proposals awaiting confirmation, and `edited` mirrors the
  // user's (possibly changed) values keyed by field key.
  const [uploadPhase, setUploadPhase] = useState<null | "uploading" | "parsing">(null);
  const [card, setCard] = useState<IngestDocumentOutput | null>(null);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const uploadBusy = uploadPhase !== null || confirming;

  async function handleFile(file: File) {
    setUploadError(null);
    if (!ACCEPTED_DOC_TYPES.includes(file.type)) {
      setUploadError("Only PDF, PNG, or JPG files are supported.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setUploadError("That file is too large (15MB max).");
      return;
    }
    setCard(null);
    setEdited({});
    setUploadPhase("uploading");
    try {
      const { uploadURL, objectPath } = await requestUploadUrl({
        name: file.name,
        size: file.size,
        contentType: file.type,
      });
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("upload failed");

      setUploadPhase("parsing");
      const result = await ingestDocument({
        objectPath,
        name: file.name,
        contentType: file.type,
        size: file.size,
      });
      // The document is now filed regardless of whether figures were read.
      void queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
      setCard(result);
      setEdited(
        Object.fromEntries(result.fields.map((f) => [f.key, String(f.value)])),
      );
    } catch {
      setUploadError("Something went wrong reading that file. Please try again.");
    } finally {
      setUploadPhase(null);
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!isAuthenticated || uploadBusy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  async function confirmCard() {
    if (!card) return;
    setConfirming(true);
    setUploadError(null);
    try {
      const payload: Record<string, number> = {};
      for (const f of card.fields) {
        const raw = edited[f.key];
        const n = Number(raw);
        if (raw != null && raw !== "" && Number.isFinite(n)) {
          payload[f.key] = Math.round(n);
        }
      }
      await confirmDocumentExtraction(payload);
      // Confirmed values flow into the profile → refresh everything they touch.
      void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetReadinessScoresQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setCard(null);
      setEdited({});
    } catch {
      setUploadError("Could not save those values. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  function discardCard() {
    setCard(null);
    setEdited({});
    setUploadError(null);
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status, card, uploadPhase]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed md:bottom-8 md:right-8 md:w-[400px] md:h-[650px] inset-0 w-full h-full md:rounded-3xl bg-background/80 md:bg-card/80 backdrop-blur-2xl border-x-0 border-y-0 md:border md:border-border/50 md:shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col z-50 overflow-hidden"
        onDragOver={(e) => {
          if (!isAuthenticated || uploadBusy) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-primary/10 blur-[50px] pointer-events-none rounded-full" />

        {/* Drag-and-drop overlay (authenticated users only) */}
        {dragging && isAuthenticated && (
          <div className="absolute inset-0 z-30 m-3 rounded-2xl border-2 border-dashed border-primary/60 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
            <FileText className="w-10 h-10 text-primary mb-3" />
            <p className="text-sm font-medium text-foreground">Drop your document</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, PNG, or JPG — up to 15MB</p>
          </div>
        )}

        {/* Header */}
        <div className="h-16 flex items-center justify-between px-5 relative z-10 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(232,93,63,0.15)]">
              <Sparkles className="w-5 h-5" />
              {status === "listening" && <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping" />}
              {status === "speaking" && <span className="absolute -inset-1 rounded-full border border-primary opacity-50 animate-pulse" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-wide text-foreground">Pepper</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${status === 'idle' ? 'bg-muted-foreground' : 'bg-primary animate-pulse'}`} />
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  {status === "idle" ? "Ready" : status}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setVoice(voice === "female" ? "male" : "female")} title="Toggle Voice" className="w-9 h-9 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5">
              {voice === "female" ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="w-9 h-9 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/5">
              <ChevronDown className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-5 relative z-10">
          <div className="space-y-6">
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mt-12 flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-serif text-foreground mb-2">How can I help you build wealth today?</h3>
                <p className="text-sm text-muted-foreground max-w-[250px]">
                  I can analyze your cashflow, suggest roadmap steps, or help you find opportunities.
                </p>
              </motion.div>
            )}
            {messages.map((msg) => (
              <motion.div 
                initial={{ opacity: 0, y: 5 }} 
                animate={{ opacity: 1, y: 0 }} 
                key={msg.id} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-sm ${
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-secondary/50 border border-white/5 text-foreground rounded-bl-sm backdrop-blur-sm"
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {status === "thinking" && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 border border-white/5 px-5 py-4 rounded-2xl rounded-bl-sm flex items-center gap-1.5 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
            {/* Inline trust gate: fires in-conversation the moment an anonymous
                guest is about to share financial specifics. Real WebAuthn; the
                conversation resumes seamlessly on success. */}
            {authRequired && !isAuthenticated && (
              <div className="pt-1">
                <TrustGate
                  variant="gate"
                  onSuccess={clearAuthRequired}
                  onDismiss={clearAuthRequired}
                />
              </div>
            )}

            {/* Upload progress note */}
            {uploadPhase && (
              <div className="flex justify-start">
                <div className="bg-secondary/50 border border-white/5 px-5 py-3 rounded-2xl rounded-bl-sm flex items-center gap-2.5 backdrop-blur-sm text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  {uploadPhase === "uploading" ? "Uploading your document…" : "Reading your document…"}
                </div>
              </div>
            )}

            {/* Editable confirmation card — proposals from the parsed document.
                Nothing is saved to the profile until the user confirms. */}
            {card && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 backdrop-blur-sm shadow-[0_0_24px_rgba(232,93,63,0.08)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    I read your {card.docTypeLabel}
                  </span>
                </div>

                {card.fields.length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      Review and edit these before I save them. I only filled in what I could read.
                    </p>
                    <div className="space-y-2.5">
                      {card.fields.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-3">
                          <label className="text-xs text-muted-foreground">{f.label}</label>
                          <div className="relative">
                            {f.key !== "creditScore" && (
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">$</span>
                            )}
                            <input
                              type="number"
                              inputMode="numeric"
                              value={edited[f.key] ?? ""}
                              onChange={(e) =>
                                setEdited((prev) => ({ ...prev, [f.key]: e.target.value }))
                              }
                              className={`w-28 bg-background/60 border border-border/60 rounded-lg py-1.5 text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-primary/50 ${f.key === "creditScore" ? "px-2.5" : "pl-5 pr-2.5"}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-4">
                      <Button
                        type="button"
                        size="sm"
                        onClick={confirmCard}
                        disabled={confirming}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl"
                      >
                        {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                        Save to my profile
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={discardCard}
                        disabled={confirming}
                        className="text-muted-foreground hover:text-foreground rounded-xl"
                      >
                        <XIcon className="w-4 h-4 mr-1" />
                        Discard
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      {card.message ?? "I filed it, but couldn't read any clear figures. You can tell me the numbers directly."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={discardCard}
                      className="text-muted-foreground hover:text-foreground rounded-xl"
                    >
                      Dismiss
                    </Button>
                  </>
                )}
              </motion.div>
            )}

            {uploadError && (
              <div className="flex justify-start">
                <div className="bg-destructive/10 border border-destructive/30 text-destructive-foreground px-4 py-2.5 rounded-2xl rounded-bl-sm text-xs">
                  {uploadError}
                </div>
              </div>
            )}

            <div ref={scrollRef} className="h-4" />
          </div>
        </ScrollArea>

        {/* Controls */}
        <div className="p-4 bg-background/50 border-t border-border/30 backdrop-blur-md relative z-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !busy) {
                sendText(input.trim());
                setInput("");
              }
            }}
            className="flex items-end gap-2"
          >
            {isAuthenticated && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  onChange={onPickFile}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  title="Attach a financial document"
                  className="shrink-0 rounded-full w-12 h-12 shadow-sm border border-white/5 hover:bg-white/10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadBusy}
                >
                  {uploadPhase ? (
                    <Loader2 className="w-5 h-5 text-foreground animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5 text-foreground" />
                  )}
                </Button>
              </>
            )}
            <Button
              type="button"
              variant={status === "listening" ? "destructive" : "secondary"}
              size="icon"
              className={`shrink-0 rounded-full w-12 h-12 shadow-sm border border-white/5 ${status === "listening" ? "shadow-[0_0_15px_rgba(255,0,0,0.3)] animate-pulse" : "hover:bg-white/10"}`}
              onClick={toggleListening}
              disabled={busy && status !== "listening" && status !== "speaking"}
            >
              {status === "speaking" ? <SquareSquare className="w-5 h-5" onClick={(e) => { e.stopPropagation(); stopSpeaking(); }} /> : 
               status === "listening" ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-foreground" />}
            </Button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Pepper..."
                className="w-full bg-secondary/30 border border-border/50 rounded-2xl px-5 py-3.5 pr-12 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:bg-secondary/50 transition-all placeholder:text-muted-foreground/60"
                disabled={busy}
              />
              <Button 
                type="submit" 
                size="icon" 
                variant="ghost"
                disabled={!input.trim() || busy} 
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-xl w-9 h-9 text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
          {wakeWordSupported && (
            <div className="mt-3 flex items-center justify-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors group">
                <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${wakeWordEnabled ? 'bg-primary' : 'bg-secondary border border-border/50'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white transition-transform ${wakeWordEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled(e.target.checked)}
                  className="sr-only"
                />
                Listen for "Hey Pep"
              </label>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}