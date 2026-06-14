import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListGoals, useCreateGoal, useUpdateGoal, useDeleteGoal, 
  getListGoalsQueryKey, getGetDashboardSummaryQueryKey 
} from "@workspace/api-client-react";
import { usePepper } from "@/pepper";
import { Plus, Target, CheckCircle2, PauseCircle, Trash2, Pencil, Mic, MicOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";

type GoalData = {
  id?: number;
  title: string;
  category: any;
  targetAmount: number;
  currentAmount: number;
  status: any;
  priority: number;
  note: string;
};

export default function Goals() {
  const { data: goals, isLoading } = useListGoals();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const queryClient = useQueryClient();
  const { dictateStart, dictateStop, dictating, setOpen: openPepper } = usePepper();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalData | null>(null);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getListGoalsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const handleSave = () => {
    if (!editingGoal || !editingGoal.title) return;
    
    if (editingGoal.id) {
      updateGoal.mutate({
        id: editingGoal.id,
        data: {
          title: editingGoal.title,
          category: editingGoal.category,
          targetAmount: editingGoal.targetAmount,
          currentAmount: editingGoal.currentAmount,
          status: editingGoal.status,
          priority: editingGoal.priority,
          note: editingGoal.note
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    } else {
      createGoal.mutate({
        data: {
          title: editingGoal.title,
          category: editingGoal.category || "wealth",
          targetAmount: editingGoal.targetAmount || 0,
          currentAmount: editingGoal.currentAmount || 0,
          status: editingGoal.status || "active",
          priority: editingGoal.priority || 1,
          note: editingGoal.note || ""
        }
      }, { onSuccess: () => { invalidateQueries(); setIsDialogOpen(false); } });
    }
  };

  const handleDelete = (id: number) => {
    deleteGoal.mutate({ id }, { onSuccess: invalidateQueries });
  };

  const handleStatusChange = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "achieved" : currentStatus === "achieved" ? "paused" : "active";
    updateGoal.mutate({ id, data: { status: newStatus as any } }, { onSuccess: invalidateQueries });
  };

  const openNewGoal = () => {
    setEditingGoal({
      title: "",
      category: "wealth",
      targetAmount: 10000,
      currentAmount: 0,
      status: "active",
      priority: 1,
      note: ""
    });
    setIsDialogOpen(true);
  };

  const openEditGoal = (goal: any) => {
    setEditingGoal({ ...goal });
    setIsDialogOpen(true);
  };

  const handleDictate = async () => {
    if (dictating) {
      const text = await dictateStop();
      if (text && editingGoal) {
        setEditingGoal({ ...editingGoal, note: (editingGoal.note ? editingGoal.note + " " : "") + text });
      }
    } else {
      await dictateStart();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-[100px] w-1/3 rounded-2xl bg-secondary/50" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
          <Skeleton className="h-[300px] rounded-3xl bg-secondary/50" />
        </div>
      </div>
    );
  }

  const activeGoals = goals?.filter(g => g.status === 'active') || [];
  const achievedGoals = goals?.filter(g => g.status === 'achieved') || [];
  const pausedGoals = goals?.filter(g => g.status === 'paused') || [];

  const GoalCard = ({ goal, delay }: { goal: any, delay: number }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
      <Card className={`h-full flex flex-col border-white/5 bg-card/60 backdrop-blur-md shadow-lg hover:shadow-xl hover:bg-card/80 transition-all rounded-3xl overflow-hidden relative group ${goal.status === 'achieved' ? 'opacity-80 grayscale-[20%]' : ''}`}>
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardDescription className="flex items-center gap-2 text-muted-foreground uppercase tracking-wider text-xs font-semibold">
              <Target className="w-4 h-4 text-primary" />
              {goal.category.replace('_', ' ')}
            </CardDescription>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors" onClick={() => openEditGoal(goal)}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors" onClick={() => handleDelete(goal.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <CardTitle className="text-2xl font-serif tracking-tight mt-2 line-clamp-1">{goal.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 mt-4">
          {goal.targetAmount > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="font-serif text-3xl text-foreground">${goal.currentAmount.toLocaleString()}</span>
                <span className="text-muted-foreground font-medium text-sm mb-1">of ${goal.targetAmount.toLocaleString()}</span>
              </div>
              <Progress value={Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)} className="h-2 bg-secondary/50 [&>div]:bg-primary" />
            </div>
          )}
          {goal.note && <p className="text-sm text-muted-foreground mt-6 leading-relaxed line-clamp-2">{goal.note}</p>}
        </CardContent>
        <CardFooter className="pt-4 pb-6 px-6 mt-4 border-t border-white/5 flex justify-between bg-card/40">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`font-medium transition-colors ${goal.status === 'active' ? 'text-primary hover:text-primary-foreground hover:bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => handleStatusChange(goal.id, goal.status)}
          >
            {goal.status === 'active' && <><Target className="w-4 h-4 mr-2" /> Active</>}
            {goal.status === 'achieved' && <><CheckCircle2 className="w-4 h-4 mr-2 text-success" /> Achieved</>}
            {goal.status === 'paused' && <><PauseCircle className="w-4 h-4 mr-2" /> Paused</>}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-4xl md:text-5xl font-serif mb-3 tracking-tight text-foreground">Wealth Goals</h1>
          <p className="text-muted-foreground text-lg max-w-2xl font-light">
            Track your milestones and wealth targets. Break big dreams into achievable numbers.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }} className="flex gap-3">
          <Button variant="outline" onClick={() => openPepper(true)} className="rounded-full border-white/10 bg-secondary/30 hover:bg-secondary text-foreground backdrop-blur-sm transition-all h-11 px-6">Ask Pepper</Button>
          <Button onClick={openNewGoal} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-11 px-6"><Plus className="w-4 h-4 mr-2" /> New Goal</Button>
        </motion.div>
      </div>

      {!goals?.length && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24 px-4 bg-card/30 backdrop-blur-md rounded-3xl border border-white/5 shadow-lg">
          <Target className="w-16 h-16 text-primary/40 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(232,93,63,0.3)]" />
          <h3 className="text-2xl font-serif tracking-tight mb-3">No goals set yet</h3>
          <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto font-light">Setting clear financial targets is the first step to building wealth.</p>
          <Button onClick={openNewGoal} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(232,93,63,0.4)] transition-all h-12 px-8 text-base"><Plus className="w-5 h-5 mr-2" /> Create Your First Goal</Button>
        </motion.div>
      )}

      {activeGoals.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-serif tracking-tight flex items-center text-foreground"><Target className="w-5 h-5 mr-2 text-primary" /> Active Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={0.1 + (i * 0.1)} />)}
          </div>
        </div>
      )}

      {(achievedGoals.length > 0 || pausedGoals.length > 0) && (
        <div className="space-y-10 pt-10 mt-10 border-t border-white/5">
          {achievedGoals.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-serif tracking-tight flex items-center text-foreground">
                <CheckCircle2 className="w-5 h-5 mr-2 text-success" /> Achieved
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {achievedGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={0.1 + (i * 0.1)} />)}
              </div>
            </div>
          )}
          {pausedGoals.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-serif tracking-tight flex items-center text-muted-foreground">
                <PauseCircle className="w-5 h-5 mr-2" /> Paused
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60">
                {pausedGoals.map((g, i) => <GoalCard key={g.id} goal={g} delay={0.1 + (i * 0.1)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-card/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl">
          <DialogHeader className="pb-4 border-b border-white/5">
            <DialogTitle className="text-2xl font-serif tracking-tight">{editingGoal?.id ? 'Edit Goal' : 'Create Goal'}</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <div className="grid gap-6 py-6">
              <div className="space-y-3">
                <Label htmlFor="title" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Goal Title</Label>
                <Input id="title" className="bg-secondary/50 border-white/5 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl h-12" value={editingGoal.title} onChange={e => setEditingGoal({...editingGoal, title: e.target.value})} placeholder="e.g. Save for Down Payment" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <Label htmlFor="category" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Category</Label>
                  <Select value={editingGoal.category} onValueChange={(val) => setEditingGoal({...editingGoal, category: val})}>
                    <SelectTrigger className="bg-secondary/50 border-white/5 rounded-xl h-12"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent className="bg-card border-white/10 rounded-xl">
                      <SelectItem value="homeownership">Homeownership</SelectItem>
                      <SelectItem value="investing">Investing</SelectItem>
                      <SelectItem value="passive_income">Passive Income</SelectItem>
                      <SelectItem value="debt">Debt Reduction</SelectItem>
                      <SelectItem value="credit">Credit Building</SelectItem>
                      <SelectItem value="wealth">General Wealth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label htmlFor="status" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Status</Label>
                  <Select value={editingGoal.status} onValueChange={(val) => setEditingGoal({...editingGoal, status: val})}>
                    <SelectTrigger className="bg-secondary/50 border-white/5 rounded-xl h-12"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent className="bg-card border-white/10 rounded-xl">
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="achieved">Achieved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-3">
                  <Label htmlFor="target" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Target Amount ($)</Label>
                  <Input id="target" type="number" className="bg-secondary/50 border-white/5 font-mono rounded-xl h-12" value={editingGoal.targetAmount} onChange={e => setEditingGoal({...editingGoal, targetAmount: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="current" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Current Amount ($)</Label>
                  <Input id="current" type="number" className="bg-secondary/50 border-white/5 font-mono rounded-xl h-12" value={editingGoal.currentAmount} onChange={e => setEditingGoal({...editingGoal, currentAmount: parseInt(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-3 relative">
                <div className="flex justify-between items-end mb-2">
                  <Label htmlFor="note" className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">Notes & Strategy</Label>
                  <Button type="button" variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${dictating ? 'bg-primary/20 text-primary animate-pulse' : 'text-muted-foreground hover:bg-secondary/80'}`} onClick={handleDictate}>
                    {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </div>
                <Textarea 
                  id="note" 
                  value={editingGoal.note} 
                  onChange={e => setEditingGoal({...editingGoal, note: e.target.value})} 
                  placeholder="Why is this important? What's your plan?"
                  className="min-h-[120px] bg-secondary/50 border-white/5 rounded-xl resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="pt-4 border-t border-white/5">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-full px-6">Cancel</Button>
            <Button onClick={handleSave} disabled={createGoal.isPending || updateGoal.isPending || !editingGoal?.title} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              {(createGoal.isPending || updateGoal.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
