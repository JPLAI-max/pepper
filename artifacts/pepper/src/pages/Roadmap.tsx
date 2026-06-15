import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetRoadmap, useUpdateRoadmapStep,
  getGetRoadmapQueryKey, getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { CheckCircle2, Circle, Clock, Map } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function Roadmap() {
  const { data: plan, isLoading } = useGetRoadmap();
  const steps = plan?.steps;
  const updateStep = useUpdateRoadmapStep();
  const queryClient = useQueryClient();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const toggleStatus = (step: any) => {
    if (step.id == null) return;
    const newStatus = step.status === 'done' ? 'todo' : 'done';
    updateStep.mutate({ id: step.id, data: { status: newStatus as any } }, { onSuccess: invalidateQueries });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[100px] w-1/3 rounded-2xl bg-secondary/50" />
        <div className="space-y-6 mt-10">
          <Skeleton className="h-[120px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[120px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[120px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  const sortedSteps = [...(steps || [])].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-4xl mx-auto space-y-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Your Roadmap</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            A step-by-step personalized plan to reach your wealth building goals.
          </p>
        </motion.div>
      </div>

      <div className="relative pl-8 md:pl-12 border-l border-white/10 space-y-8 pb-12 ml-4">
        {sortedSteps.map((step, index) => {
          const isDone = step.status === 'done';
          const isNext = !isDone && (index === 0 || sortedSteps[index-1].status === 'done');
          
          return (
            <motion.div 
              key={step.id ?? index} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: index * 0.1, duration: 0.4 }}
              className="relative group"
            >
              {/* Timeline marker */}
              <div 
                className="absolute -left-[45px] md:-left-[61px] top-6 bg-background rounded-full p-1 cursor-pointer z-10 transition-transform duration-300 group-hover:scale-110"
                onClick={() => toggleStatus(step)}
              >
                {isDone ? (
                  <CheckCircle2 className="w-7 h-7 text-success fill-success/20 drop-shadow-[0_0_10px_rgba(63,163,125,0.4)]" />
                ) : isNext ? (
                  <div className="relative flex items-center justify-center w-7 h-7">
                    <span className="absolute inset-0 rounded-full border border-primary animate-ping opacity-50" />
                    <Clock className="w-7 h-7 text-primary relative z-10 drop-shadow-[0_0_10px_rgba(232,93,63,0.6)]" />
                  </div>
                ) : (
                  <Circle className="w-7 h-7 text-white/20" />
                )}
              </div>

              <Card className={`overflow-hidden transition-all duration-300 rounded-3xl ${isDone ? 'opacity-50 grayscale bg-card/20 border-white/5 shadow-none hover:opacity-80' : isNext ? 'border-primary/30 shadow-[0_0_30px_rgba(232,93,63,0.1)] ring-1 ring-primary/20 bg-card/80 backdrop-blur-xl' : 'border-white/5 bg-card/40 backdrop-blur-md shadow-lg hover:bg-card/60'}`}>
                {isNext && <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[50px] pointer-events-none" />}
                <CardContent className="p-6 md:p-8 relative z-10">
                  <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex-1 space-y-2">
                      <h3 className={`text-2xl font-serif tracking-tight ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {step.action}
                      </h3>
                      {step.detail && (
                        <p className={`leading-relaxed text-sm md:text-base ${isDone ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{step.detail}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-3 items-center shrink-0 w-full md:w-auto mt-2 md:mt-0">
                      <Button 
                        variant={isDone ? "ghost" : "default"} 
                        className={`rounded-full h-10 px-6 transition-all w-full md:w-auto ${!isDone && isNext ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(232,93,63,0.4)]" : !isDone ? "bg-secondary text-foreground hover:bg-secondary/80" : ""}`}
                        onClick={() => toggleStatus(step)}
                        disabled={updateStep.isPending || step.id == null}
                      >
                        {isDone ? "Undo" : "Mark Complete"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {!sortedSteps.length && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 px-4 bg-card/30 backdrop-blur-md rounded-3xl border border-white/5 shadow-lg ml-[-1rem]">
            <Map className="w-16 h-16 text-primary/40 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(232,93,63,0.3)]" />
            <h3 className="text-2xl font-serif tracking-tight mb-3">Roadmap is empty</h3>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto font-light">Your roadmap is currently empty. Talk to Pepper to generate a personalized plan.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
