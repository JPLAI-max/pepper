import React, { useRef, useEffect, useState } from "react";
import { usePepper } from "@/pepper";
import { X, Mic, Send, Volume2, SquareSquare, VolumeX, MicOff } from "lucide-react";
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
  } = usePepper();

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
        className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] bg-card border shadow-2xl rounded-2xl flex flex-col z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="h-14 border-b flex items-center justify-between px-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <span className="font-bold text-sm">P</span>
              {status === "listening" && <span className="absolute -inset-1 rounded-full border-2 border-primary animate-ping" />}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">Pepper</span>
              <span className="text-[10px] text-muted-foreground capitalize leading-tight">{status}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setVoice(voice === "female" ? "male" : "female")} title="Toggle Voice" className="w-8 h-8">
              {voice === "female" ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="w-8 h-8">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm mt-10">
                Hi! I'm Pepper. How can I help you build wealth today?
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {status === "thinking" && (
              <div className="flex justify-start">
                <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-primary/80 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Controls */}
        <div className="p-3 bg-muted/20 border-t">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() && !busy) {
                sendText(input.trim());
                setInput("");
              }
            }}
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant={status === "listening" ? "destructive" : "secondary"}
              size="icon"
              className={`shrink-0 rounded-full w-10 h-10 ${status === "listening" ? "animate-pulse" : ""}`}
              onClick={toggleListening}
              disabled={busy && status !== "listening" && status !== "speaking"}
            >
              {status === "speaking" ? <SquareSquare className="w-4 h-4" onClick={(e) => { e.stopPropagation(); stopSpeaking(); }} /> : 
               status === "listening" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pepper anything..."
              className="flex-1 bg-background border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              disabled={busy}
            />
            <Button type="submit" size="icon" disabled={!input.trim() || busy} className="shrink-0 rounded-full w-10 h-10">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          {wakeWordSupported && (
            <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wakeWordEnabled}
                  onChange={(e) => setWakeWordEnabled(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
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
