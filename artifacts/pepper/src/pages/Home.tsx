import React, { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetProfile, useListGoals, useGetReadinessScores, useListRoadmapSteps, getListGoalsQueryKey, getGetReadinessScoresQueryKey, getListRoadmapStepsQueryKey } from "@workspace/api-client-react";
import { Mic, Send } from "lucide-react";
import { usePepper } from "@/pepper";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
  const { data: profile, isLoading } = useGetProfile();
  const { data: goals } = useListGoals({ query: { enabled: !!profile?.onboarded, queryKey: getListGoalsQueryKey() } });
  const { data: readinessScores } = useGetReadinessScores({ query: { enabled: !!profile?.onboarded, queryKey: getGetReadinessScoresQueryKey() } });
  const { data: roadmapSteps } = useListRoadmapSteps({ query: { enabled: !!profile?.onboarded, queryKey: getListRoadmapStepsQueryKey() } });

  const [, setLocation] = useLocation();
  const { status, setOpen } = usePepper();

  const nextAction = useMemo(() => {
    if (roadmapSteps) {
      const nextStep = [...roadmapSteps].sort((a, b) => a.orderIndex - b.orderIndex).find(s => s.status !== "done");
      if (nextStep) return nextStep.title;
    }
    if (readinessScores) {
      const lowestScore = [...readinessScores].sort((a, b) => a.score - b.score)[0];
      if (lowestScore) return `Improve your ${lowestScore.label.toLowerCase()} readiness`;
    }
    return "Connect your main checking account to analyze cashflow.";
  }, [roadmapSteps, readinessScores]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  if (profile?.onboarded) {
    const primaryGoal = goals?.find(g => g.priority === 1) || goals?.[0];
    const progress = primaryGoal && primaryGoal.targetAmount > 0 
      ? Math.min(100, Math.round((primaryGoal.currentAmount / primaryGoal.targetAmount) * 100))
      : 0;

    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mb-12">
          <div className="w-24 h-24 relative flex items-center justify-center rounded-full bg-gradient-to-br from-ember/20 to-bg0 border border-primary/20 shadow-[0_0_30px_rgba(255,126,63,0.15)] cursor-pointer hover:scale-105 transition-transform shrink-0" onClick={() => setOpen(true)}>
             <div className="absolute inset-2 rounded-full bg-gradient-to-br from-amber to-copper opacity-80 blur-md"></div>
             <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-gold via-ember to-deep shadow-inner flex items-center justify-center">
               <div className={`w-full h-full rounded-full ${status === 'listening' ? 'animate-ping border border-white/50' : ''}`}></div>
             </div>
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-serif text-ink tracking-tight mb-2">
              Good Evening, {profile.displayName || "Wealth Builder"}
            </h1>
            <p className="text-muted text-lg">Your trajectory is steady. Welcome back to your command center.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-glass border border-line backdrop-blur-xl flex flex-col justify-between cursor-pointer group hover:bg-white/5 transition-colors" onClick={() => setLocation("/goals")}>
            <div>
              <h3 className="text-xl font-serif mb-4 text-gold">Current Mission</h3>
              {primaryGoal ? (
                <>
                  <p className="text-ink text-lg font-serif mb-4 leading-tight group-hover:text-primary transition-colors">{primaryGoal.title}</p>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-muted">Progress</span>
                    <span className="text-ink font-mono text-xl">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-bg2 overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-amber to-ember transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                  </div>
                  {primaryGoal.targetDate && <p className="text-xs text-muted uppercase tracking-wider text-right">Target: {new Date(primaryGoal.targetDate).toLocaleDateString()}</p>}
                </>
              ) : (
                <p className="text-muted">No active goals yet. Click to set one.</p>
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-glass border border-line backdrop-blur-xl flex flex-col justify-center cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setOpen(true)}>
            <p className="text-muted mb-2 text-sm uppercase tracking-wider">Next Action</p>
            <p className="text-xl text-ink font-serif leading-tight mb-4 group-hover:text-primary transition-colors">{nextAction}</p>
            <div className="flex items-center text-ember text-sm font-medium gap-2">
              Talk to Pepper <Send className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Magic Landing (not onboarded)
  const chips = [
    "Buy my first home",
    "Generate passive income",
    "Buy a rental property",
    "Improve my credit",
    "Build wealth"
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-bg0">
      <div className="absolute top-8 text-muted text-sm tracking-[0.4em] font-medium z-10">
        <b className="text-ink font-semibold">PEPPER</b>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="relative w-[268px] h-[268px] md:w-[320px] md:h-[320px] flex items-center justify-center cursor-pointer"
        onClick={() => setLocation("/discovery")}
      >
        <div className="absolute w-[115%] h-[115%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,150,80,0.55),rgba(255,120,60,0.12)_45%,transparent_70%)] blur-[26px] animate-[breathe-glow_6.5s_ease-in-out_infinite]" style={{ animationDuration: status === 'listening' ? '2.6s' : '6.5s' }} />
        <div className="relative w-[204px] h-[204px] md:w-[240px] md:h-[240px] rounded-full overflow-hidden isolate bg-[radial-gradient(circle_at_36%_30%,#ffe6bf_0%,var(--amber)_16%,var(--ember)_42%,var(--copper)_70%,var(--deep)_100%)] shadow-[inset_-22px_-26px_60px_rgba(60,18,4,0.85),inset_14px_16px_40px_rgba(255,225,180,0.55),0_24px_80px_rgba(216,83,31,0.32)] animate-[breathe_6.5s_ease-in-out_infinite]" style={{ animationDuration: status === 'listening' ? '2.6s' : '6.5s' }}>
          <div className="absolute w-[130px] h-[130px] left-[8%] top-[14%] rounded-full blur-[16px] mix-blend-screen opacity-90 bg-[radial-gradient(circle,var(--gold),transparent_68%)] animate-[drift1_11s_ease-in-out_infinite]" style={{ animationDuration: status === 'listening' ? '4.5s' : '11s' }} />
          <div className="absolute w-[150px] h-[150px] right-[2%] top-[30%] rounded-full blur-[16px] mix-blend-screen opacity-90 bg-[radial-gradient(circle,var(--ember),transparent_66%)] animate-[drift2_14s_ease-in-out_infinite]" style={{ animationDuration: status === 'listening' ? '5.5s' : '14s' }} />
          <div className="absolute w-[120px] h-[120px] left-[24%] bottom-[6%] rounded-full blur-[16px] mix-blend-screen opacity-90 bg-[radial-gradient(circle,#fff0d6,transparent_64%)] animate-[drift3_9s_ease-in-out_infinite]" style={{ animationDuration: status === 'listening' ? '3.5s' : '9s' }} />
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_26%,rgba(255,255,255,0.75),transparent_30%)] mix-blend-screen opacity-60" />
          <div className="absolute inset-0 rounded-full shadow-[inset_0_0_1px_1px_rgba(255,210,160,0.25)]" />
        </div>
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="font-serif font-light text-[1.78rem] md:text-[2.15rem] leading-tight text-center my-8 md:my-10 text-[#f3e3d2]"
      >
        How can I help you today?
      </motion.h1>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="w-full max-w-[560px]"
      >
        <div className="flex items-center gap-2.5 w-full bg-glass border border-line rounded-full p-2 backdrop-blur-[14px] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          <button className="flex-none w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all bg-[rgba(255,180,120,0.1)] text-gold hover:bg-[rgba(255,180,120,0.18)]" onClick={() => setLocation("/discovery")}>
            <Mic className="w-5 h-5" />
          </button>
          <input 
            className="flex-1 bg-transparent border-none outline-none text-ink text-base px-1 placeholder:text-muted"
            placeholder="Tell Pepper what you're working toward…"
            onFocus={() => setLocation("/discovery")}
          />
          <button className="flex-none w-[46px] h-[46px] rounded-full flex items-center justify-center transition-all bg-gradient-to-b from-amber to-ember text-[#3a1606] hover:scale-105" onClick={() => setLocation("/discovery")}>
            <Send className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2.5 mt-6">
          {chips.map(c => (
            <button key={c} onClick={() => setLocation("/discovery")} className="text-[0.84rem] text-muted border border-line rounded-full px-[15px] py-[8px] bg-[rgba(255,255,255,0.012)] hover:text-ink hover:border-[rgba(255,180,120,0.4)] hover:bg-[rgba(255,150,80,0.07)] transition-all">
              {c}
            </button>
          ))}
        </div>
      </motion.div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.045); } }
        @keyframes breathe-glow { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.08); opacity: 1; } }
        @keyframes drift1 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(18px, 22px); } }
        @keyframes drift2 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(-22px, -14px); } }
        @keyframes drift3 { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(10px, -20px); } }
      `}} />
    </div>
  );
}
