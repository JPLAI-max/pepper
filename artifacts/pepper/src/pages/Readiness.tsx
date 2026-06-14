import React from "react";
import { useGetReadinessScores } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Shield, Sparkles, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { usePepper } from "@/pepper";

export default function Readiness() {
  const { data: scores, isLoading } = useGetReadinessScores();
  const { setOpen } = usePepper();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-2">Readiness Scores</h1>
          <p className="text-muted-foreground max-w-2xl">
            Understand where you stand. These scores reflect your current financial foundation and readiness for specific real estate moves.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {scores?.map((score, i) => (
          <motion.div key={score.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-col md:flex-row">
                <div className="p-6 md:w-1/3 bg-muted/20 border-b md:border-b-0 md:border-r border-border/50 flex flex-col justify-center items-center text-center">
                  <div className="relative mb-4">
                    <svg className="w-32 h-32 transform -rotate-90">
                      <circle cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      <circle 
                        cx="64" cy="64" r="56" fill="transparent" stroke="currentColor" strokeWidth="8" 
                        strokeDasharray={2 * Math.PI * 56} 
                        strokeDashoffset={2 * Math.PI * 56 * (1 - score.score / 100)} 
                        className={score.score >= 80 ? "text-primary" : score.score >= 50 ? "text-accent" : "text-destructive"} 
                        strokeLinecap="round" 
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold">{score.score}</span>
                    </div>
                  </div>
                  <h3 className="font-medium text-lg">{score.label}</h3>
                  <span className="text-sm px-2 py-1 bg-background border rounded-md mt-2 capitalize font-medium text-muted-foreground">
                    {score.tier.replace('_', ' ')}
                  </span>
                </div>
                <div className="p-6 md:w-2/3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      {score.score >= 80 ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-accent" />
                      )}
                      <h4 className="font-semibold text-lg">What this means</h4>
                    </div>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {score.summary}
                    </p>
                  </div>
                  <div className="flex justify-end mt-auto pt-4 border-t border-border/50">
                    <Button variant="ghost" onClick={() => setOpen(true)} className="text-primary hover:text-primary hover:bg-primary/5">
                      <Sparkles className="w-4 h-4 mr-2" /> Discuss how to improve
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}

        {!scores?.length && (
          <div className="text-center py-16 px-4 bg-muted/20 rounded-2xl border border-dashed border-border">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No scores available yet</h3>
            <p className="text-muted-foreground">Complete your financial profile in the onboarding to generate your readiness scores.</p>
          </div>
        )}
      </div>
    </div>
  );
}