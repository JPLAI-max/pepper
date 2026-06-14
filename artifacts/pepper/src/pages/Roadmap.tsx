import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListRoadmapSteps, useCreateRoadmapStep, useUpdateRoadmapStep,
  getListRoadmapStepsQueryKey, getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { CheckCircle2, Circle, Clock, Plus, Loader2, ArrowRight } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[80px] w-1/3" />
        <div className="space-y-4">
          <Skeleton className="h-[100px]" />
          <Skeleton className="h-[100px]" />
          <Skeleton className="h-[100px]" />
        </div>
      </div>
    );
  }

  const sortedSteps = [...(steps || [])].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto space-y-10 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl font-serif mb-2">Your Roadmap</h1>
          <p className="text-muted-foreground max-w-2xl">
            A step-by-step personalized plan to reach your wealth building goals.
          </p>
        </div>
        <Button onClick={openNewStep} className="rounded-full"><Plus className="w-4 h-4 mr-2" /> Add Step</Button>
      </div>

      <div className="relative pl-6 md:pl-8 border-l-2 border-border/50 space-y-8 pb-12">
        {sortedSteps.map((step, index) => {
          const isDone = step.status === 'done';
          const isNext = !isDone && (index === 0 || sortedSteps[index-1].status === 'done');
          
          return (
            <motion.div 
              key={step.id} 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }} 
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {/* Timeline marker */}
              <div 
                className="absolute -left-[35px] md:-left-[43px] top-4 bg-background p-1 cursor-pointer hover:scale-110 transition-transform z-10"
                onClick={() => toggleStatus(step)}
              >
                {isDone ? (
                  <CheckCircle2 className="w-6 h-6 text-primary fill-primary/10" />
                ) : isNext ? (
                  <Clock className="w-6 h-6 text-accent animate-pulse" />
                ) : (
                  <Circle className="w-6 h-6 text-muted-foreground/50" />
                )}
              </div>

              <Card className={`overflow-hidden transition-all ${isDone ? 'opacity-60 bg-muted/30 border-transparent shadow-none' : isNext ? 'border-accent/30 shadow-md ring-1 ring-accent/10' : 'border-border/50 shadow-sm'}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div className="flex-1 space-y-1">
                      <h3 className={`text-xl font-serif ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {step.title}
                      </h3>
                      {step.description && (
                        <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 items-center shrink-0">
                      {step.actionLabel && !isDone && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href="#">{step.actionLabel} <ArrowRight className="w-3 h-3 ml-1" /></Link>
                        </Button>
                      )}
                      <Button 
                        variant={isDone ? "outline" : "default"} 
                        className={!isDone && isNext ? "bg-accent hover:bg-accent/90" : ""}
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
          <p className="text-muted-foreground text-center py-12">Your roadmap is currently empty. Talk to Pepper to generate a personalized plan.</p>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingStep?.id ? 'Edit Step' : 'Add Custom Step'}</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Step Title</Label>
                <Input id="title" value={editingStep.title} onChange={e => setEditingStep({...editingStep, title: e.target.value})} placeholder="e.g. Open a High-Yield Savings Account" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea id="desc" value={editingStep.description || ""} onChange={e => setEditingStep({...editingStep, description: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">Call to Action Button (Optional)</Label>
                <Input id="action" value={editingStep.actionLabel || ""} onChange={e => setEditingStep({...editingStep, actionLabel: e.target.value})} placeholder="e.g. Review Options" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createStep.isPending || updateStep.isPending || !editingStep?.title}>
              {(createStep.isPending || updateStep.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}