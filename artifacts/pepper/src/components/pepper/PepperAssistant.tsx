import React, { useRef, useEffect, useState } from "react";
import { usePepper } from "@/pepper";
import { useAuth, TrustGate } from "@/auth";
import { X, Mic, Send, Volume2, SquareSquare, VolumeX, MicOff, Sparkles, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";

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

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed md:bottom-8 md:right-8 md:w-[400px] md:h-[650px] inset-0 w-full h-full md:rounded-3xl bg-background/80 md:bg-card/80 backdrop-blur-2xl border-x-0 border-y-0 md:border md:border-border/50 md:shadow-[0_8px_40px_rgba(0,0,0,0.5)] flex flex-col z-50 overflow-hidden"
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-24 bg-primary/10 blur-[50px] pointer-events-none rounded-full" />

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