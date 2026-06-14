import React from "react";
import { useGetReadinessScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { usePepper } from "@/pepper";

export default function Readiness() {
  const { data: scores, isLoading } = useGetReadinessScores();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[100px] w-1/3 rounded-2xl bg-secondary/50" />
        <div className="space-y-6 mt-8">
          <Skeleton className="h-[250px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[250px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Readiness Scores</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            Understand where you stand. These scores reflect your current financial foundation and readiness for specific real estate moves.
          </p>
        </motion.div>
      </div>

      <div className="space-y-6">
        {scores?.map((score, i) => {
          const isHigh = score.score >= 80;
          const isMed = score.score >= 50 && score.score < 80;
          const colorClass = isHigh ? "text-primary" : isMed ? "text-gold" : "text-destructive";
          const glowClass = isHigh ? "bg-primary/5" : isMed ? "bg-gold/5" : "bg-destructive/5";
          const dropShadowClass = isHigh ? "drop-shadow-[0_0_15px_rgba(232,93,63,0.5)]" : isMed ? "drop-shadow-[0_0_15px_rgba(217,164,65,0.4)]" : "drop-shadow-[0_0_15px_rgba(200,50,50,0.4)]";

          return (
            <motion.div key={score.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1, duration: 0.4 }}>
              <Card className="overflow-hidden border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80 transition-all rounded-3xl group relative">
                <div className={`absolute top-0 left-0 w-48 h-48 rounded-full blur-[60px] pointer-events-none transition-colors duration-500 group-hover:opacity-100 opacity-50 ${glowClass}`} />
                <div className="flex flex-col md:flex-row relative z-10">
                  <div className="p-8 md:w-1/3 bg-white/[0.02] border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center items-center text-center">
                    <div className="relative mb-6">
                      <svg className={`w-36 h-36 transform -rotate-90 ${dropShadowClass}`}>
                        <circle cx="72" cy="72" r="64" fill="transparent" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                        <circle 
                          cx="72" cy="72" r="64" fill="transparent" stroke="currentColor" strokeWidth="6" 
                          strokeDasharray={2 * Math.PI * 64} 
                          strokeDashoffset={2 * Math.PI * 64 * (1 - score.score / 100)} 
                          className={colorClass} 
                          strokeLinecap="round" 
                          style={{ transition: "stroke-dashoffset 1s ease-out" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-4xl font-serif tracking-tight ${colorClass}`}>{score.score}</span>
                      </div>
                    </div>
                    <h3 className="font-serif text-2xl tracking-tight mb-2">{score.label}</h3>
                    <span className="text-xs px-3 py-1.5 bg-secondary/50 border border-white/5 rounded-full uppercase tracking-wider font-semibold text-muted-foreground">
                      {score.tier.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="p-8 md:w-2/3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-4">
                        {isHigh ? (
                          <CheckCircle2 className="w-6 h-6 text-primary" />
                        ) : (
                          <AlertCircle className="w-6 h-6 text-gold" />
                        )}
                        <h4 className="font-serif text-2xl text-foreground">What this means</h4>
                      </div>
                      <p className="text-muted-foreground text-base md:text-lg mb-8 leading-relaxed font-light">
                        {score.summary}
                      </p>
                    </div>
                    <div className="flex justify-start md:justify-end mt-auto pt-6 border-t border-white/5">
                      <Button variant="outline" onClick={() => setOpen(true)} className="rounded-full border-white/10 bg-secondary/30 hover:bg-secondary text-foreground backdrop-blur-sm transition-all h-11 px-6">
                        <Sparkles className="w-4 h-4 mr-2 text-primary" /> Discuss how to improve
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}

        {!scores?.length && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 px-4 bg-card/30 backdrop-blur-md rounded-3xl border border-white/5 shadow-lg">
            <Shield className="w-16 h-16 text-primary/40 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(232,93,63,0.3)]" />
            <h3 className="text-2xl font-serif tracking-tight mb-3">No scores available yet</h3>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto font-light">Complete your financial profile in the onboarding to generate your readiness scores.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
