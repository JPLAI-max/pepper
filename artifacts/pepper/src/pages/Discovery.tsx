import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { 
  useCreateOpenaiConversation, 
  useSendDiscoveryMessage, 
  useSpeakText, 
  useUpdateProfile,
  useGetProfile
} from "@workspace/api-client-react";
import { Mic, Send, Volume2, Sparkles, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Discovery() {
  const [, setLocation] = useLocation();
  const { data: profile } = useGetProfile();
  
  const createConv = useCreateOpenaiConversation();
  const sendMsg = useSendDiscoveryMessage();
  const speakText = useSpeakText();
  const updateProfile = useUpdateProfile();
  
  const [convId, setConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{role: 'user'|'assistant', text: string}[]>([]);
  const [checklist, setChecklist] = useState<any>({});
  const [readyForReveal, setReadyForReveal] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!convId && !createConv.isPending) {
      createConv.mutate({ data: { title: "Discovery" } }, {
        onSuccess: (data) => setConvId(data.id)
      });
    }
  }, [convId, createConv]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !convId || sendMsg.isPending) return;
    
    const content = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: content }]);
    
    try {
      const res = await sendMsg.mutateAsync({ data: { conversationId: convId, content } });
      setMessages(prev => [...prev, { role: 'assistant', text: res.reply }]);
      setChecklist(res.checklist);
      if (res.readyForReveal) {
        setReadyForReveal(true);
      }
      
      // Attempt to speak reply
      if (profile?.preferredVoice) {
        try {
          const audioRes = await speakText.mutateAsync({ data: { text: res.reply, voice: profile.preferredVoice as any } });
          new Audio('data:audio/mp3;base64,' + audioRes.audio).play();
        } catch (e) {
          console.error("Audio failed", e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReveal = () => {
    setIsRevealing(true);
    setTimeout(() => {
      updateProfile.mutate({ data: { onboarded: true } }, {
        onSuccess: () => setLocation("/dashboard")
      });
    }, 2000);
  };

  if (isRevealing) {
    return (
      <div className="min-h-screen bg-bg0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.5 }}
          className="text-center"
        >
          <Sparkles className="w-16 h-16 text-gold mx-auto mb-6 animate-pulse" />
          <h1 className="text-4xl font-serif text-ink tracking-tight">Synthesizing your wealth roadmap...</h1>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg0 flex flex-col md:flex-row relative overflow-hidden">
      {/* Left pane: Conversation */}
      <div className="flex-1 flex flex-col p-6 md:p-12 relative z-10">
        <div className="mb-8 cursor-pointer" onClick={() => setLocation("/")}>
          <div className="text-muted text-sm tracking-[0.4em] font-medium"><b className="text-ink font-semibold">PEPPER</b></div>
        </div>
        
        <div className="flex-1 overflow-y-auto mb-8 pr-4 space-y-6" ref={scrollRef}>
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-ink font-serif text-2xl">
                Hello. Let's build your financial picture together. What are you looking to achieve?
              </motion.div>
            )}
            {messages.map((m, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-bg2 text-ink self-end ml-auto' : 'bg-transparent text-ink border border-line backdrop-blur-md'}`}
              >
                {m.role === 'assistant' && <Sparkles className="w-4 h-4 text-gold mb-2" />}
                <div className="font-sans text-lg font-light leading-relaxed">{m.text}</div>
              </motion.div>
            ))}
            {sendMsg.isPending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2 p-4 text-muted">
                <span className="animate-bounce">.</span><span className="animate-bounce" style={{animationDelay: '100ms'}}>.</span><span className="animate-bounce" style={{animationDelay: '200ms'}}>.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {readyForReveal ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-glass border border-line rounded-3xl backdrop-blur-xl text-center">
            <h3 className="font-serif text-2xl text-gold mb-4">Your picture is complete.</h3>
            <p className="text-ink font-light mb-6">I have analyzed your situation and prepared a customized roadmap.</p>
            <Button onClick={handleReveal} className="w-full h-14 rounded-full bg-gradient-to-r from-ember to-copper text-white font-medium text-lg hover:shadow-[0_0_30px_rgba(216,83,31,0.4)] transition-all">
              Reveal My Financial Picture
            </Button>
          </motion.div>
        ) : (
          <div className="flex items-center gap-2.5 w-full bg-glass border border-line rounded-full p-2 backdrop-blur-[14px]">
            <button className="flex-none w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all text-gold hover:bg-white/5">
              <Mic className="w-5 h-5" />
            </button>
            <input 
              className="flex-1 bg-transparent border-none outline-none text-ink text-base px-1"
              placeholder="Tell Pepper..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={sendMsg.isPending}
            />
            <button 
              className="flex-none w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all bg-gradient-to-b from-amber to-ember text-[#3a1606] hover:scale-105 disabled:opacity-50"
              onClick={handleSend}
              disabled={sendMsg.isPending || !input.trim()}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Right pane: Living Picture (subtle) */}
      <div className="hidden md:flex w-[400px] border-l border-line bg-bg1/50 backdrop-blur-sm p-10 flex-col items-center justify-center relative">
        <div className="w-[200px] h-[200px] rounded-full bg-primary/5 blur-3xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        
        <h3 className="text-muted text-sm tracking-widest uppercase mb-12 relative z-10">Assembling Profile</h3>
        
        <div className="space-y-4 w-full relative z-10">
          {[
            { key: 'goal', label: 'Primary Goal' },
            { key: 'income', label: 'Income Profile' },
            { key: 'expenses', label: 'Cash Outflows' },
            { key: 'savings', label: 'Cash Reserves' },
            { key: 'debt', label: 'Liabilities' },
            { key: 'credit', label: 'Credit Health' },
          ].map(item => (
            <div key={item.key} className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-700 ${checklist[item.key] ? 'bg-white/5 border border-white/10' : 'opacity-30'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${checklist[item.key] ? 'bg-gold/20 text-gold' : 'border border-muted text-transparent'}`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="font-medium text-ink">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
