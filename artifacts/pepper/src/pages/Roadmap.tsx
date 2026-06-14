import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListRoadmapSteps, useCreateRoadmapStep, useUpdateRoadmapStep, useGenerateRoadmap,
  getListRoadmapStepsQueryKey, getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { CheckCircle2, Circle, Clock, Plus, Loader2, ArrowRight, Map, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Link } from "wouter";

export default function Roadmap() {
  const { data: steps, isLoading } = useListRoadmapSteps();
  const createStep = useCreateRoadmapStep();
  const updateStep = useUpdateRoadmapStep();
  const generateRoadmap = useGenerateRoadmap();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<any>(null);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListRoadmapStepsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const toggleStatus = (step: any) => {
    const newStatus = step.status === 'done' ? 'todo' : 'done';
    updateStep.mutate({ id: step.id, data: { status: newStatus as any } }, { onSuccess: invalidateQueries });
  };

  const handleSave = () => {
    if (!editingStep?.title) return;
    
    if (editingStep.id) {
      updateStep.mutate({
        id: editingStep.id,
        data: {
          title: editingStep.title,
          description: editingStep.description,
          status: editingStep.status,
          actionLabel: editingStep.actionLabel
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    } else {
      createStep.mutate({
        data: {
          title: editingStep.title,
          description: editingStep.description,
          status: "todo",
          orderIndex: (steps?.length || 0) + 1,
          actionLabel: editingStep.actionLabel
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    }
  };

  const openNewStep = () => {
    setEditingStep({ title: "", description: "", actionLabel: "" });
    setIsDialogOpen(true);
  };

  const handleGenerate = () => {
    generateRoadmap.mutate(undefined, { onSuccess: invalidateQueries });
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

  const sortedSteps = [...(steps || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto space-y-12 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Your Roadmap</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            A step-by-step personalized plan to reach your wealth building goals.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="flex gap-3">
          <Button onClick={handleGenerate} disabled={generateRoadmap.isPending} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-11 px-6">
            {generateRoadmap.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {steps?.length ? "Regenerate" : "Generate my roadmap"}
          </Button>
          <Button variant="outline" onClick={openNewStep} className="rounded-full border-white/10 bg-secondary/50 hover:bg-secondary text-foreground transition-all h-11 px-6"><Plus className="w-4 h-4 mr-2" /> Add Step</Button>
        </motion.div>
      </div>

      <div className="relative pl-8 md:pl-12 border-l border-white/10 space-y-8 pb-12 ml-4">
        {sortedSteps.map((step, index) => {
          const isDone = step.status === 'done';
          const isNext = !isDone && (index === 0 || sortedSteps[index-1].status === 'done');
          
          return (
            <motion.div 
              key={step.id} 
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
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className={`leading-relaxed text-sm md:text-base ${isDone ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>{step.description}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-3 items-center shrink-0 w-full md:w-auto mt-2 md:mt-0">
                      {step.actionLabel && !isDone && (
                        <Button variant="outline" className="rounded-full border-white/10 bg-secondary/50 hover:bg-secondary text-foreground backdrop-blur-sm transition-all h-10 px-5 w-full md:w-auto" asChild>
                          <Link href="#">{step.actionLabel} <ArrowRight className="w-4 h-4 ml-2" /></Link>
                        </Button>
                      )}
                      <Button 
                        variant={isDone ? "ghost" : "default"} 
                        className={`rounded-full h-10 px-6 transition-all w-full md:w-auto ${!isDone && isNext ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_15px_rgba(232,93,63,0.4)]" : !isDone ? "bg-secondary text-foreground hover:bg-secondary/80" : ""}`}
                        onClick={() => toggleStatus(step)}
                        disabled={updateStep.isPending}
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
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto font-light">Let Pepper build a personalized, step-by-step plan from your financial picture and primary goal.</p>
            <Button onClick={handleGenerate} disabled={generateRoadmap.isPending} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-12 px-8 text-base">
              {generateRoadmap.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
              Generate my roadmap
            </Button>
          </motion.div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl">
          <DialogHeader className="pb-4 border-b border-white/5">
            <DialogTitle className="text-2xl font-serif tracking-tight">{editingStep?.id ? 'Edit Step' : 'Add Custom Step'}</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="grid gap-6 py-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Step Title</Label>
                <Input id="title" className="bg-secondary/50 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl h-12" value={editingStep.title} onChange={e => setEditingStep({...editingStep, title: e.target.value})} placeholder="e.g. Open a High-Yield Savings Account" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="desc" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Description</Label>
                <Textarea id="desc" className="bg-secondary/50 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl min-h-[100px] resize-none" value={editingStep.description || ""} onChange={e => setEditingStep({...editingStep, description: e.target.value})} placeholder="What needs to be done?" />
              </div>
              <div className="space-y-3">
                <Label htmlFor="action" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Call to Action Button (Optional)</Label>
                <Input id="action" className="bg-secondary/50 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl h-12" value={editingStep.actionLabel || ""} onChange={e => setEditingStep({...editingStep, actionLabel: e.target.value})} placeholder="e.g. Review Options" />
              </div>
            </div>
          )}
          <DialogFooter className="pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button onClick={handleSave} disabled={createStep.isPending || updateStep.isPending || !editingStep?.title} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              {(createStep.isPending || updateStep.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
